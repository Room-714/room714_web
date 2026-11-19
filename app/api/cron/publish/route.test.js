import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  post: { findMany: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("@/app/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/app/lib/seo/indexingApi", () => ({
  buildPostUrls: () => [],
  notifyUrlUpdated: vi.fn(),
}));
vi.mock("@/app/lib/time/madrid", async (importOriginal) => ({
  ...(await importOriginal()),
  getMadridHour: () => 17,
}));

const { GET } = await import("./route");

let fetchMock;

beforeEach(() => {
  process.env.CRON_SECRET = "secreto";
  process.env.MAKE_WEBHOOK_URL = "https://hook.example.test/simulado";
  prismaMock.post.findMany.mockReset();
  prismaMock.post.updateMany.mockReset().mockResolvedValue({ count: 1 });
  fetchMock = vi.fn(async () => ({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/cron/publish (17:00, posts manuales)", () => {
  it("publica en la web sin llamar a LinkedIn, en una sola escritura", async () => {
    prismaMock.post.findMany.mockResolvedValue([
      {
        id: 7,
        source: "MANUAL",
        date: new Date("2026-11-19T07:00:00Z"),
        linkedinEstado: "SOLO_WEB",
        translations: [{ lang: "es", slug: "manual", title: "Manual", tags: [], content: "" }],
      },
      {
        id: 8,
        source: "MANUAL",
        date: new Date("2026-11-19T07:00:00Z"),
        linkedinEstado: "PENDIENTE",
        translations: [{ lang: "es", slug: "otro", title: "Otro", tags: [], content: "" }],
      },
    ]);

    const res = await GET(
      new Request("http://x/api/cron/publish", {
        headers: { authorization: "Bearer secreto" },
      }),
    );
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prismaMock.post.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.post.updateMany.mock.calls[0][0]).toEqual({
      where: { id: { in: [7, 8] } },
      data: { published_sent: true },
    });
  });
});
