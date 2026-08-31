import { describe, expect, it } from "vitest";
import { afinidad, rankPool } from "./rankPool";

describe("afinidad", () => {
  it("un vecino aceptado y cercano puntúa alto", () => {
    const a = afinidad([{ distance: 0.1, metadata: { decision: "yes" } }]);
    expect(a).toBeGreaterThan(0);
  });

  it("un vecino descartado y cercano puntúa en contra", () => {
    const a = afinidad([{ distance: 0.1, metadata: { decision: "no" } }]);
    expect(a).toBeLessThan(0);
  });

  it("un vecino lejano pesa menos que uno cercano", () => {
    const cerca = afinidad([{ distance: 0.1, metadata: { decision: "yes" } }]);
    const lejos = afinidad([{ distance: 1.2, metadata: { decision: "yes" } }]);
    expect(cerca).toBeGreaterThan(lejos);
  });

  it("sin vecinos la afinidad es cero, no negativa", () => {
    // Con la memoria vacía todos los candidatos deben empatar, para que el
    // orden original de Apollo se conserve.
    expect(afinidad([])).toBe(0);
    expect(afinidad(null)).toBe(0);
  });

  it("solo mira los documentos de tipo decision", () => {
    const a = afinidad([
      { distance: 0.05, kind: "criterio", metadata: {} },
      { distance: 0.9, kind: "decision", metadata: { decision: "yes" } },
    ]);
    const soloDecision = afinidad([
      { distance: 0.9, kind: "decision", metadata: { decision: "yes" } },
    ]);
    expect(a).toBeCloseTo(soloDecision, 10);
  });

  it("un vecino sin decisión explícita no resta: es ausencia de señal", () => {
    // El sesgo tiene que ir hacia neutro, no hacia "no". Restar por un
    // documento que nadie decidió sería inventarse un descarte.
    expect(afinidad([{ distance: 0.05, kind: "decision", metadata: {} }])).toBe(0);
    expect(
      afinidad([{ distance: 0.05, kind: "decision", metadata: { decision: "quizá" } }]),
    ).toBe(0);
  });
});

describe("rankPool", () => {
  const candidatos = [
    { id: "a", title: "COO", organization: { name: "Alfa" } },
    { id: "b", title: "CEO", organization: { name: "Beta" } },
    { id: "c", title: "CIO", organization: { name: "Gamma" } },
  ];

  it("con memoria vacía conserva el orden de Apollo", async () => {
    const ordenados = await rankPool(candidatos, {
      embed: async (textos) => textos.map(() => [1, 0]),
      buscarVecinos: async () => [],
    });
    expect(ordenados.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("pone delante al que se parece a un aceptado", async () => {
    const ordenados = await rankPool(candidatos, {
      embed: async (textos) => textos.map(() => [1, 0]),
      buscarVecinos: async (_v, i) =>
        i === 2 ? [{ kind: "decision", distance: 0.05, metadata: { decision: "yes" } }] : [],
    });
    expect(ordenados[0].id).toBe("c");
  });

  it("NUNCA elimina candidatos: ordena, no filtra", async () => {
    // La memoria solo decide a quién se MIRA primero. Si además descartara,
    // un mal recuerdo temprano condenaría para siempre a todo lo que se le
    // parezca, sin que nadie llegue a mirarlo nunca. Ese es el trinquete que
    // este proyecto ya rechazó una vez en rules.js.
    const ordenados = await rankPool(candidatos, {
      embed: async (textos) => textos.map(() => [1, 0]),
      buscarVecinos: async () => [
        { kind: "decision", distance: 0.01, metadata: { decision: "no" } },
      ],
    });
    expect(ordenados).toHaveLength(3);
    expect(ordenados.map((c) => c.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("si los embeddings fallan, devuelve el orden original intacto", async () => {
    const ordenados = await rankPool(candidatos, {
      embed: async () => {
        throw new Error("Voyage caído");
      },
      buscarVecinos: async () => [],
    });
    expect(ordenados.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("la ruta degradada devuelve la misma forma que la normal", async () => {
    // Si Voyage se cae, el consumidor no debe notarlo en la forma del objeto:
    // reventar al leer `_vecinos.length` sería fallar justo en el momento que
    // esta degradación existe para sobrevivir.
    const ordenados = await rankPool(candidatos, {
      embed: async () => {
        throw new Error("Voyage caído");
      },
      buscarVecinos: async () => [],
    });
    for (const c of ordenados) {
      expect(c._vecinos).toEqual([]);
      expect(c._afinidad).toBe(0);
      expect(typeof c._orden).toBe("number");
    }
  });

  it("si la consulta de vecinos falla, sigue devolviendo a todos", async () => {
    const ordenados = await rankPool(candidatos, {
      embed: async (textos) => textos.map(() => [1, 0]),
      buscarVecinos: async () => {
        throw new Error("base caída");
      },
    });
    expect(ordenados).toHaveLength(3);
  });

  it("una lista vacía devuelve una lista vacía", async () => {
    const ordenados = await rankPool([], {
      embed: async () => [],
      buscarVecinos: async () => [],
    });
    expect(ordenados).toEqual([]);
  });

  it("adjunta los vecinos a cada candidato para el «se parece a»", async () => {
    const vecino = {
      kind: "decision",
      distance: 0.05,
      metadata: { decision: "yes", company: "Conservas Maribel" },
    };
    const ordenados = await rankPool(candidatos, {
      embed: async (textos) => textos.map(() => [1, 0]),
      buscarVecinos: async () => [vecino],
    });
    expect(ordenados[0]._vecinos[0].metadata.company).toBe("Conservas Maribel");
  });

  it("embebe el cargo y la empresa, leyendo organization.name", async () => {
    let recibidos = null;
    await rankPool(candidatos, {
      embed: async (textos) => {
        recibidos = textos;
        return textos.map(() => [1, 0]);
      },
      buscarVecinos: async () => [],
    });
    expect(recibidos).toEqual(["COO · Alfa", "CEO · Beta", "CIO · Gamma"]);
  });
});
