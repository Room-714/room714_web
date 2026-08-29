import { describe, expect, it } from "vitest";
import { deriveRules, ruleStats, TITLE_STRIKES, SIZE_STRIKES } from "./rules";

const no = (extra) => ({ decision: "no", reasonCode: "role", ...extra });
const si = (extra) => ({ decision: "yes", reasonCode: null, ...extra });

describe("deriveRules — cargos", () => {
  it("excluye un cargo tras tres descartes por cargo", () => {
    const decisiones = Array.from({ length: TITLE_STRIKES }, () =>
      no({ title: "Director Comercial" }),
    );
    expect(deriveRules(decisiones).excludedTitles).toContain("Director Comercial");
  });

  it("no lo excluye con dos", () => {
    const decisiones = [no({ title: "CEO" }), no({ title: "CEO" })];
    expect(deriveRules(decisiones).excludedTitles).toEqual([]);
  });

  it("no cuenta los descartes por otros motivos", () => {
    const decisiones = Array.from({ length: TITLE_STRIKES }, () =>
      no({ title: "CEO", reasonCode: "sector" }),
    );
    expect(deriveRules(decisiones).excludedTitles).toEqual([]);
  });

  it("ignora los motivos legacy de la migración", () => {
    const decisiones = Array.from({ length: 10 }, () =>
      no({ title: "CEO", reasonCode: "legacy" }),
    );
    expect(deriveRules(decisiones).excludedTitles).toEqual([]);
  });

  it("un sí posterior no salva un cargo ya excluido: manda el recuento", () => {
    const decisiones = [
      ...Array.from({ length: TITLE_STRIKES }, () => no({ title: "CIO" })),
      si({ title: "CIO" }),
    ];
    expect(deriveRules(decisiones).excludedTitles).toContain("CIO");
  });

  it("normaliza mayúsculas y espacios al contar", () => {
    const decisiones = [
      no({ title: "  director de it " }),
      no({ title: "Director de IT" }),
      no({ title: "DIRECTOR DE IT" }),
    ];
    expect(deriveRules(decisiones).excludedTitles).toHaveLength(1);
  });
});

describe("deriveRules — tramos de plantilla", () => {
  it("excluye un tramo con cinco descartes por tamaño y ningún sí", () => {
    const decisiones = Array.from({ length: SIZE_STRIKES }, () =>
      no({ sizeQuery: "101,250", reasonCode: "size" }),
    );
    expect(deriveRules(decisiones).excludedSizes).toContain("101,250");
  });

  it("un solo sí en ese tramo lo salva", () => {
    const decisiones = [
      ...Array.from({ length: SIZE_STRIKES }, () =>
        no({ sizeQuery: "101,250", reasonCode: "size" }),
      ),
      si({ sizeQuery: "101,250" }),
    ];
    expect(deriveRules(decisiones).excludedSizes).toEqual([]);
  });
});

describe("deriveRules — orden de sectores", () => {
  it("ordena por tasa de acierto, de mejor a peor", () => {
    const decisiones = [
      si({ sectorQuery: "Industria y fabricación" }),
      si({ sectorQuery: "Industria y fabricación" }),
      no({ sectorQuery: "Industria y fabricación", reasonCode: "sector" }),
      no({ sectorQuery: "Educación", reasonCode: "sector" }),
      no({ sectorQuery: "Educación", reasonCode: "sector" }),
      no({ sectorQuery: "Educación", reasonCode: "sector" }),
    ];
    const orden = deriveRules(decisiones).sectorsByHitRate.map((s) => s.sector);
    expect(orden[0]).toBe("Industria y fabricación");
    expect(orden[orden.length - 1]).toBe("Educación");
  });

  it("cuenta los descartes por equipo propio como fallo del sector", () => {
    const decisiones = Array.from({ length: 3 }, () =>
      no({ sectorQuery: "Servicios profesionales", reasonCode: "in_house_team" }),
    );
    const s = deriveRules(decisiones).sectorsByHitRate.find(
      (x) => x.sector === "Servicios profesionales",
    );
    expect(s.hits).toBe(0);
    expect(s.total).toBe(3);
  });

  it("devuelve listas vacías sin decisiones", () => {
    const r = deriveRules([]);
    expect(r.excludedTitles).toEqual([]);
    expect(r.excludedSizes).toEqual([]);
    expect(r.sectorsByHitRate).toEqual([]);
  });

  it("no cuenta las decisiones pendientes", () => {
    const decisiones = [
      { decision: "pending", sectorQuery: "Educación", title: "CEO" },
      { decision: "pending", sectorQuery: "Educación", title: "CEO" },
    ];
    expect(deriveRules(decisiones).sectorsByHitRate).toEqual([]);
  });

  it("un descarte legacy no cuenta como fallo de sector ni de tramo", () => {
    // Trazando el 'no'+legacy por los tres acumuladores: si sectorStats y
    // sizeStats no comprueban reasonCode === 'legacy', una migración masiva
    // de filas antiguas ensuciaría las tasas de acierto y podría excluir
    // tramos de plantilla que nadie ha descartado de verdad.
    const decisiones = Array.from({ length: 10 }, () =>
      no({
        title: "CEO",
        sectorQuery: "Educación",
        sizeQuery: "101,250",
        reasonCode: "legacy",
      }),
    );
    const r = deriveRules(decisiones);
    expect(r.excludedTitles).toEqual([]);
    expect(r.excludedSizes).toEqual([]);
    expect(r.sectorsByHitRate).toEqual([]);
  });
});

describe("ruleStats", () => {
  it("cuenta los motivos de descarte correctamente", () => {
    const decisiones = [
      no({ reasonCode: "role", title: "CEO" }),
      no({ reasonCode: "role", title: "CEO" }),
      no({ reasonCode: "sector", sectorQuery: "Educación" }),
      si({ sectorQuery: "Educación" }),
    ];
    const stats = ruleStats(decisiones);
    expect(stats.reasonCounts).toEqual({ role: 2, sector: 1 });
  });

  it("excluye legacy del recuento de motivos", () => {
    const decisiones = [
      no({ reasonCode: "legacy", title: "CEO" }),
      no({ reasonCode: "legacy", title: "CEO" }),
      no({ reasonCode: "role", title: "CFO" }),
    ];
    const stats = ruleStats(decisiones);
    expect(stats.reasonCounts).toEqual({ role: 1 });
  });

  it("decided y accepted cuadran con las decisiones tomadas", () => {
    const decisiones = [
      si({ sectorQuery: "Educación" }),
      no({ title: "CEO" }),
      no({ title: "CFO" }),
      { decision: "pending", sectorQuery: "Educación", title: "CEO" },
    ];
    const stats = ruleStats(decisiones);
    expect(stats.decided).toBe(3);
    expect(stats.accepted).toBe(1);
  });

  it("incluye también las reglas derivadas (excludedTitles, etc.)", () => {
    const decisiones = Array.from({ length: TITLE_STRIKES }, () =>
      no({ title: "Director Comercial" }),
    );
    const stats = ruleStats(decisiones);
    expect(stats.excludedTitles).toContain("Director Comercial");
  });
});
