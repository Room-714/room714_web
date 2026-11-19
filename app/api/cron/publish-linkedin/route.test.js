import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ninguna llamada real: la BD y el webhook de Make están simulados.
const prismaMock = vi.hoisted(() => ({
  post: { findMany: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("@/app/lib/prisma", () => ({ prisma: prismaMock }));

const { GET } = await import("./route");

const WEBHOOK_SIMULADO = "https://hook.example.test/simulado";

const peticion = (query = "", secret = "secreto") =>
  new Request(`http://x/api/cron/publish-linkedin${query}`, {
    headers: { authorization: `Bearer ${secret}` },
  });

const postAprobado = (id, slug) => ({
  id,
  date: new Date("2026-11-16T06:30:00Z"),
  image: "https://img/portada.jpg",
  published: true,
  linkedinEstado: "APROBADO",
  linkedinPublicadoAt: null,
  translations: [
    { lang: "es", slug, title: `Post ${id}`, tags: [], content: "<p>Texto</p>" },
  ],
  linkedinVariants: [
    { id: id * 10 + 2, variant: 2, angle: "data", text: "Texto empresa", hashtags: [], imageBlobUrl: "https://img/t.jpg" },
  ],
});

let fetchMock;

beforeEach(() => {
  process.env.CRON_SECRET = "secreto";
  process.env.MAKE_WEBHOOK_URL = WEBHOOK_SIMULADO;
  prismaMock.post.findMany.mockReset();
  prismaMock.post.updateMany.mockReset().mockResolvedValue({ count: 1 });
  fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/cron/publish-linkedin", () => {
  it("sin el secreto del cron responde 401 y no consulta nada", async () => {
    const res = await GET(peticion("", "otro"));
    expect(res.status).toBe(401);
    expect(prismaMock.post.findMany).not.toHaveBeenCalled();
  });

  it("solo busca posts aprobados, ya en la web y sin publicar en LinkedIn", async () => {
    prismaMock.post.findMany.mockResolvedValue([]);
    await GET(peticion());
    const { where } = prismaMock.post.findMany.mock.calls[0][0];
    expect(where).toMatchObject({
      linkedinEstado: "APROBADO",
      linkedinPublicadoAt: null,
      published: true,
    });
    expect(where.date.lte).toBeInstanceOf(Date);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envía cada aprobado a la página de empresa con UTM y los marca en una sola escritura", async () => {
    prismaMock.post.findMany.mockResolvedValue([postAprobado(1, "uno"), postAprobado(2, "dos")]);
    const res = await GET(peticion());
    const body = await res.json();

    expect(body.sent).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK_SIMULADO);
    const payload = JSON.parse(init.body);
    expect(payload.canal).toBe("empresa");
    expect(payload.url).toBe(
      "https://www.room714.com/es/blog/uno?utm_source=linkedin&utm_medium=social&utm_campaign=blog&utm_content=uno",
    );
    expect(payload.link_for_first_comment).toBe(payload.url);

    expect(prismaMock.post.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.post.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.post.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: [1, 2] }, linkedinEstado: "APROBADO" },
      data: { linkedinEstado: "PUBLICADO" },
    });
  });

  it("si Make falla, ese post no se marca como publicado", async () => {
    prismaMock.post.findMany.mockResolvedValue([postAprobado(1, "uno"), postAprobado(2, "dos")]);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await GET(peticion());
    expect(prismaMock.post.updateMany.mock.calls[0][0].where.id.in).toEqual([2]);
  });

  it("si no sale ninguno, no escribe nada", async () => {
    prismaMock.post.findMany.mockResolvedValue([postAprobado(1, "uno")]);
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await GET(peticion());
    expect(prismaMock.post.updateMany).not.toHaveBeenCalled();
  });

  it("en preview no envía ni marca nada", async () => {
    prismaMock.post.findMany.mockResolvedValue([postAprobado(1, "uno")]);
    const body = await (await GET(peticion("?preview=1"))).json();
    expect(body.mode).toBe("preview");
    expect(body.results[0].payload.canal).toBe("empresa");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prismaMock.post.updateMany).not.toHaveBeenCalled();
  });
});
