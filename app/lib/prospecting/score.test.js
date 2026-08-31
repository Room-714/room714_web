import { describe, expect, it } from "vitest";
import { scoreOf, passesGate, QUALIFY_THRESHOLD, PESOS } from "./score";

const todoPass = {
  revenue: { verdict: "pass" },
  digitalNeed: { verdict: "pass" },
  itTeam: { verdict: "pass" },
  advisory: { verdict: "pass" },
};

describe("scoreOf", () => {
  it("los cuatro en pass dan 100", () => {
    expect(scoreOf(todoPass)).toBe(100);
  });

  it("los cuatro en unclear dan 40, el 40% de todo", () => {
    const todoUnclear = Object.fromEntries(
      Object.keys(todoPass).map((k) => [k, { verdict: "unclear" }]),
    );
    expect(scoreOf(todoUnclear)).toBe(40);
  });

  it("un fail resta el peso entero de ese criterio", () => {
    expect(scoreOf({ ...todoPass, advisory: { verdict: "fail" } })).toBe(
      100 - PESOS.advisory,
    );
  });

  it("un veredicto ausente o inventado cuenta como unclear, no como pass", () => {
    // Si el modelo devuelve basura, el sesgo tiene que ser hacia la duda.
    const roto = { ...todoPass, itTeam: { verdict: "quizá" } };
    expect(scoreOf(roto)).toBe(100 - PESOS.itTeam * 0.6);
    expect(scoreOf({})).toBe(40);
    expect(scoreOf(null)).toBe(0);
  });

  it("los pesos suman 100", () => {
    expect(Object.values(PESOS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("passesGate", () => {
  it("deja pasar lo que llega al umbral", () => {
    expect(passesGate(todoPass).ok).toBe(true);
  });

  it("un fail en facturación descarta aunque el resto sume", () => {
    const r = passesGate({ ...todoPass, revenue: { verdict: "fail" } });
    expect(r.ok).toBe(false);
    expect(r.reasonCode).toBe("revenue");
  });

  it("un fail en producto digital descarta aunque el resto sume", () => {
    const r = passesGate({ ...todoPass, digitalNeed: { verdict: "fail" } });
    expect(r.ok).toBe(false);
    expect(r.reasonCode).toBe("no_digital_need");
  });

  it("un fail en equipo IT solo resta, no descarta por sí solo", () => {
    expect(passesGate({ ...todoPass, itTeam: { verdict: "fail" } }).ok).toBe(true);
  });

  it("por debajo del umbral no pasa, y dice cuánto sacó", () => {
    const flojo = {
      revenue: { verdict: "unclear" },
      digitalNeed: { verdict: "unclear" },
      itTeam: { verdict: "unclear" },
      advisory: { verdict: "unclear" },
    };
    const r = passesGate(flojo); // 40 < 50
    expect(r.ok).toBe(false);
    expect(r.reasonCode).toBe("other");
    expect(r.score).toBe(40);
  });

  it("justo en el umbral entra", () => {
    // digitalNeed pass (30) + revenue unclear (12) + itTeam unclear (10)
    // + advisory fail (0) = 52. Por encima de 50, entra.
    const justo = {
      revenue: { verdict: "unclear" },
      digitalNeed: { verdict: "pass" },
      itTeam: { verdict: "unclear" },
      advisory: { verdict: "fail" },
    };
    const r = passesGate(justo);
    expect(r.score).toBe(52);
    expect(r.ok).toBe(true);
  });
});
