import { describe, expect, it, vi } from "vitest";
import { textoDeDecision, esMemorizabe, vectorLiteral, nearest } from "./memory";

describe("textoDeDecision", () => {
  it("mete la decisión al final, que es la etiqueta que se aprende", () => {
    const texto = textoDeDecision({
      title: "Director de Operaciones",
      company: "Herrajes Nordeste",
      sectorQuery: "Industria y fabricación",
      sizeQuery: "101,250",
      decision: "yes",
      dossier: { summary: "Fabricante que monta portal B2B" },
    });
    expect(texto).toContain("Director de Operaciones");
    expect(texto).toContain("Herrajes Nordeste");
    expect(texto).toContain("Fabricante que monta portal B2B");
    expect(texto).toMatch(/ACEPTADO$/);
  });

  it("un descarte lleva el motivo pegado a la etiqueta", () => {
    const texto = textoDeDecision({
      company: "Clínicas Vitalis",
      decision: "no",
      reasonCode: "revenue",
    });
    expect(texto).toMatch(/DESCARTADO por revenue$/);
  });

  it("aguanta una fila sin dossier: las de antes de esta fase no lo tienen", () => {
    expect(() => textoDeDecision({ company: "X", decision: "yes" })).not.toThrow();
  });
});

describe("esMemorizabe", () => {
  it("una decisión humana sí", () => {
    expect(esMemorizabe({ decision: "yes", reasonCode: null })).toBe(true);
    expect(esMemorizabe({ decision: "no", reasonCode: "revenue" })).toBe(true);
  });

  it("las filas legacy NO: nadie las decidió", () => {
    // 48 de las 52 filas decididas de producción son legacy, puestas por la
    // migración de B1. Meterlas en la memoria sería enseñarle al sistema un
    // criterio que ninguna persona ha tenido nunca.
    expect(esMemorizabe({ decision: "yes", reasonCode: "legacy" })).toBe(false);
    expect(esMemorizabe({ decision: "no", reasonCode: "legacy" })).toBe(false);
  });

  it("lo pendiente todavía no", () => {
    expect(esMemorizabe({ decision: "pending" })).toBe(false);
  });
});

describe("vectorLiteral", () => {
  it("serializa como literal de pgvector", () => {
    expect(vectorLiteral([0.1, -0.2, 0])).toBe("[0.1,-0.2,0]");
  });

  it("rechaza lo que no es un vector de números finitos", () => {
    expect(() => vectorLiteral([0.1, NaN])).toThrow(/vector/i);
    expect(() => vectorLiteral(null)).toThrow(/vector/i);
    expect(() => vectorLiteral([])).toThrow(/vector/i);
  });
});

describe("nearest", () => {
  function prismaFalso() {
    return { $queryRawUnsafe: vi.fn().mockResolvedValue([]) };
  }

  it("ordena por distancia coseno y limita", async () => {
    const prisma = prismaFalso();
    await nearest(prisma, [0.1, 0.2], { k: 3 });
    const [sql, ...params] = prisma.$queryRawUnsafe.mock.calls[0];
    expect(sql).toContain("<=>");
    expect(sql).toContain("ORDER BY");
    expect(params[0]).toBe("[0.1,0.2]");
    expect(params[1]).toBe(3);
  });

  it("sin kinds no añade filtro WHERE", async () => {
    const prisma = prismaFalso();
    await nearest(prisma, [0.1], {});
    const [sql, ...params] = prisma.$queryRawUnsafe.mock.calls[0];
    expect(sql).not.toContain("WHERE");
    expect(params).toHaveLength(2);
  });

  it("con kinds filtra por tipo y pasa el array como parámetro", async () => {
    // Como parámetro y no interpolado en el SQL: es un valor, no estructura.
    const prisma = prismaFalso();
    await nearest(prisma, [0.1], { kinds: ["decision"] });
    const [sql, ...params] = prisma.$queryRawUnsafe.mock.calls[0];
    expect(sql).toContain("WHERE");
    expect(params[2]).toEqual(["decision"]);
  });
});
