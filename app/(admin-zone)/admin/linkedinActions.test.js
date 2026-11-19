import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  post: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  linkedInVariant: { findMany: vi.fn() },
  postTranslation: { findFirst: vi.fn() },
}));
const getToken = vi.hoisted(() => vi.fn());
const generarBorradorPerfil = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth/jwt", () => ({ getToken }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [] }),
  headers: async () => new Headers(),
}));
vi.mock("@/app/lib/linkedin/borradorPerfil", () => ({ generarBorradorPerfil }));

const {
  aprobarLinkedIn,
  borradorPerfilJose,
  configLinkedInPanel,
  marcarLinkedIn,
  retirarAprobacionLinkedIn,
} = await import("./linkedinActions");

const JUEVES_0730 = new Date("2026-11-19T06:30:00Z");

const todasLasLlamadas = () =>
  [
    prismaMock.post.findUnique,
    prismaMock.post.findMany,
    prismaMock.post.updateMany,
    prismaMock.linkedInVariant.findMany,
    prismaMock.postTranslation.findFirst,
  ].reduce((n, fn) => n + fn.mock.calls.length, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  for (const modelo of Object.values(prismaMock)) {
    for (const fn of Object.values(modelo)) fn.mockReset();
  }
  prismaMock.post.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.post.findMany.mockResolvedValue([]);
  prismaMock.linkedInVariant.findMany.mockResolvedValue([]);
  getToken.mockResolvedValue({ sub: "admin" });
  generarBorradorPerfil.mockReset();
  // Estas pruebas son del flujo de aprobación, que va detrás del flag.
  process.env.LINKEDIN_APPROVAL_FLOW = "true";
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.LINKEDIN_APPROVAL_FLOW;
});

describe("flag LINKEDIN_APPROVAL_FLOW", () => {
  it("apagado (por defecto), ninguna acción toca la base de datos ni genera nada", async () => {
    delete process.env.LINKEDIN_APPROVAL_FLOW;
    for (const r of [
      await marcarLinkedIn(3, true),
      await aprobarLinkedIn(3, { confirmarSegunda: true }),
      await retirarAprobacionLinkedIn(3),
      await borradorPerfilJose(3),
    ]) {
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/desactivado/);
    }
    expect(todasLasLlamadas()).toBe(0);
    expect(generarBorradorPerfil).not.toHaveBeenCalled();
  });

  it("el panel sabe si tiene que enseñar la parte de LinkedIn", async () => {
    expect(await configLinkedInPanel()).toEqual({ success: true, flujoAprobacion: true });
    process.env.LINKEDIN_APPROVAL_FLOW = "false";
    expect(await configLinkedInPanel()).toEqual({ success: true, flujoAprobacion: false });
  });
});

describe("sesión", () => {
  it("sin sesión de admin no toca la base de datos", async () => {
    getToken.mockResolvedValue(null);
    const r = await aprobarLinkedIn(1, { confirmarSegunda: true });
    expect(r).toEqual({ success: false, error: "No autorizado" });
    expect(todasLasLlamadas()).toBe(0);
  });
});

describe("marcarLinkedIn", () => {
  it("marcar deja el post pendiente, sin aprobarlo", async () => {
    prismaMock.post.findUnique.mockResolvedValue({ linkedinEstado: "SOLO_WEB" });
    const r = await marcarLinkedIn(3, true);
    expect(r).toEqual({ success: true, estado: "PENDIENTE" });
    expect(prismaMock.post.updateMany).toHaveBeenCalledWith({
      where: { id: 3, linkedinEstado: "SOLO_WEB" },
      data: { linkedinEstado: "PENDIENTE", linkedinAprobadoAt: null },
    });
  });

  it("no cambia nada de un post ya publicado en LinkedIn", async () => {
    prismaMock.post.findUnique.mockResolvedValue({ linkedinEstado: "PUBLICADO" });
    const r = await marcarLinkedIn(3, false);
    expect(r.success).toBe(false);
    expect(prismaMock.post.updateMany).not.toHaveBeenCalled();
  });
});

describe("aprobarLinkedIn", () => {
  const pendiente = {
    id: 1,
    date: JUEVES_0730,
    linkedinEstado: "PENDIENTE",
    linkedinPublicadoAt: null,
  };

  it("no aprueba un post que no está marcado", async () => {
    prismaMock.post.findUnique.mockResolvedValue({ ...pendiente, linkedinEstado: "SOLO_WEB" });
    const r = await aprobarLinkedIn(1);
    expect(r.success).toBe(false);
    expect(prismaMock.post.updateMany).not.toHaveBeenCalled();
  });

  it("si es la única de la semana, aprueba", async () => {
    prismaMock.post.findUnique.mockResolvedValue(pendiente);
    const r = await aprobarLinkedIn(1);
    expect(r).toMatchObject({ success: true, estado: "APROBADO" });
    expect(prismaMock.post.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 1, linkedinEstado: "PENDIENTE" },
      data: { linkedinEstado: "APROBADO" },
    });
  });

  it("con otra publicación esa semana, pide confirmación y no aprueba", async () => {
    prismaMock.post.findUnique.mockResolvedValue(pendiente);
    prismaMock.post.findMany.mockResolvedValue([
      {
        id: 2,
        date: new Date("2026-11-17T06:30:00Z"),
        linkedinEstado: "APROBADO",
        linkedinPublicadoAt: null,
        translations: [{ lang: "es", title: "El del martes" }],
      },
    ]);
    const r = await aprobarLinkedIn(1);
    expect(r.necesitaConfirmacion).toBe(true);
    expect(r.conflictos[0].titulo).toBe("El del martes");
    expect(prismaMock.post.updateMany).not.toHaveBeenCalled();
  });

  it("con la confirmación explícita, aprueba la segunda", async () => {
    prismaMock.post.findUnique.mockResolvedValue(pendiente);
    prismaMock.post.findMany.mockResolvedValue([
      {
        id: 2,
        date: new Date("2026-11-17T06:30:00Z"),
        linkedinEstado: "APROBADO",
        linkedinPublicadoAt: null,
        translations: [],
      },
    ]);
    const r = await aprobarLinkedIn(1, { confirmarSegunda: true });
    expect(r.success).toBe(true);
    expect(prismaMock.post.updateMany).toHaveBeenCalledTimes(1);
  });

  it("consulta la semana del post, no todo el histórico", async () => {
    prismaMock.post.findUnique.mockResolvedValue(pendiente);
    await aprobarLinkedIn(1);
    const filtro = prismaMock.linkedInVariant.findMany.mock.calls[0][0].where;
    expect(filtro.sent).toBe(true);
    expect(filtro.sentAt).toEqual({
      gte: new Date("2026-11-15T23:00:00Z"),
      lt: new Date("2026-11-22T23:00:00Z"),
    });
  });
});

describe("retirarAprobacionLinkedIn", () => {
  it("vuelve a pendiente solo si estaba aprobado", async () => {
    await retirarAprobacionLinkedIn(4);
    expect(prismaMock.post.updateMany).toHaveBeenCalledWith({
      where: { id: 4, linkedinEstado: "APROBADO" },
      data: { linkedinEstado: "PENDIENTE", linkedinAprobadoAt: null },
    });
  });
});

describe("borradorPerfilJose", () => {
  it("devuelve el texto sin escribir nada en la base de datos", async () => {
    prismaMock.postTranslation.findFirst.mockResolvedValue({ title: "T", content: "<p>C</p>" });
    generarBorradorPerfil.mockResolvedValue("Borrador");
    const r = await borradorPerfilJose(5);
    expect(r).toEqual({ success: true, texto: "Borrador" });
    expect(prismaMock.post.updateMany).not.toHaveBeenCalled();
  });
});
