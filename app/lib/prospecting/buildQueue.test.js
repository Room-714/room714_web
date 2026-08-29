import { describe, expect, it, vi } from "vitest";
import {
  collectFreshCandidates,
  startPageFor,
  QUEUE_SIZE,
  MAX_SEARCH_PAGES,
  PER_PAGE,
} from "./buildQueue";

const persona = (id, company) => ({
  id,
  first_name: "N",
  last_name_obfuscated: "N.",
  title: "COO",
  organization: { name: company ?? `Empresa ${id}` },
});

describe("startPageFor", () => {
  it("empieza por la primera si no hemos visto a nadie de esa combinación", () => {
    expect(startPageFor(0)).toBe(1);
    expect(startPageFor(undefined)).toBe(1);
  });

  it("no retrocede de la primera con pocos vistos", () => {
    expect(startPageFor(10)).toBe(1);
  });

  it("avanza conforme se agota la combinación, con una página de solape", () => {
    expect(startPageFor(2 * PER_PAGE)).toBe(2);
    expect(startPageFor(5 * PER_PAGE)).toBe(5);
  });
});

describe("collectFreshCandidates", () => {
  it("para de paginar en cuanto reúne los que necesita", async () => {
    let n = 0;
    const search = vi.fn(async () => ({
      people: Array.from({ length: 25 }, () => persona(`p${n++}`)),
      totalEntries: 500,
    }));

    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(),
    });

    expect(r.candidates).toHaveLength(QUEUE_SIZE);
    expect(search).toHaveBeenCalledTimes(1);
    expect(r.exhausted).toBe(false);
  });

  it("avanza de página si la primera no basta", async () => {
    let page = 0;
    const search = vi.fn(async () => {
      page += 1;
      return {
        people: Array.from({ length: 25 }, (_, i) =>
          persona(i < 20 ? `conocido-${page}-${i}` : `nuevo-${page}-${i}`),
        ),
        totalEntries: 500,
      };
    });
    const knownIds = new Set();
    for (let p = 1; p <= 10; p++) {
      for (let i = 0; i < 20; i++) knownIds.add(`conocido-${p}-${i}`);
    }

    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds,
    });

    expect(search.mock.calls.length).toBeGreaterThan(1);
    expect(r.candidates.length).toBeGreaterThan(0);
  });

  it("se rinde al llegar al tope de páginas y lo dice", async () => {
    const search = vi.fn(async () => ({ people: [persona("repetido")], totalEntries: 10 }));

    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(["repetido"]),
    });

    expect(search).toHaveBeenCalledTimes(MAX_SEARCH_PAGES);
    expect(r.exhausted).toBe(true);
    expect(r.candidates).toHaveLength(0);
  });

  it("para si una página vuelve vacía", async () => {
    const search = vi.fn(async () => ({ people: [], totalEntries: 0 }));
    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(),
    });
    expect(search).toHaveBeenCalledTimes(1);
    expect(r.exhausted).toBe(true);
  });

  it("empieza por la página que le digan", async () => {
    const search = vi.fn(async () => ({ people: [], totalEntries: 0 }));
    await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(),
      startPage: 4,
    });
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ page: 4 }));
  });

  it("recorre MAX_SEARCH_PAGES páginas aunque empiece tarde", async () => {
    const search = vi.fn(async () => ({ people: [persona("repe")], totalEntries: 10 }));
    await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(["repe"]),
      startPage: 3,
    });
    expect(search).toHaveBeenCalledTimes(MAX_SEARCH_PAGES);
    const paginas = search.mock.calls.map((c) => c[0].page);
    expect(paginas[0]).toBe(3);
    expect(paginas[paginas.length - 1]).toBe(3 + MAX_SEARCH_PAGES - 1);
  });

  it("no repite a la misma persona entre páginas", async () => {
    const search = vi.fn(async () => ({
      people: [persona("mismo", "Empresa A"), persona("otro", "Empresa B")],
      totalEntries: 100,
    }));
    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(),
    });
    const ids = r.candidates.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no devuelve más de los que se le piden", async () => {
    let n = 0;
    const search = vi.fn(async () => ({
      people: Array.from({ length: 25 }, () => persona(`q${n++}`)),
      totalEntries: 500,
    }));
    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: 7,
      rules: {},
      knownIds: new Set(),
    });
    expect(r.candidates).toHaveLength(7);
  });

  it("acumula los descartes del filtro para poder diagnosticar", async () => {
    const search = vi.fn(async () => ({
      people: [persona("a", "Acme Software SL"), persona("b", "Envases Ruiz")],
      totalEntries: 100,
    }));
    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(),
    });
    expect(r.dropped.some((d) => d.reason.includes("sector que ya resuelve"))).toBe(true);
  });
});
