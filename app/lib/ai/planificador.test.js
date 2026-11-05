import { describe, expect, it, vi } from "vitest";

vi.mock("./anthropic", () => ({ getAnthropicClient: vi.fn(), MODEL: "claude-test-model" }));

import { buildPlanPrompt, interpretarPlan, listaNumerada } from "./planificador";

const EXISTENTES = [
  { id: 900, estado: "publicado", date: "2026-10-14", title_es: "Diseño de Producto vs. Diseño UX", metaTitle_es: "Diseño de producto vs. UX", slug_es: "diferencia-entre-diseno-de-producto-y-diseno-ux" },
  { id: 901, estado: "borrador", date: "2026-11-01", title_es: "Un borrador", metaTitle_es: null, slug_es: "un-borrador" },
];

describe("buildPlanPrompt", () => {
  it("lleva la lista numerada de títulos existentes, con su estado", () => {
    const out = buildPlanPrompt({ category: "UX", existentes: EXISTENTES });
    expect(out).toContain('1. "Diseño de Producto vs. Diseño UX" (publicado, 2026-10-14)');
    expect(out).toContain('2. "Un borrador" (borrador, 2026-11-01)');
  });

  it("con tema fijado, pide comprobarlo y no cambiarlo", () => {
    const out = buildPlanPrompt({ category: "UX", temaFijo: "diferencia entre diseño de producto y UX", existentes: EXISTENTES });
    expect(out).toContain('El tema está fijado: **"diferencia entre diseño de producto y UX"**');
  });

  it("lista los temas descartados", () => {
    const out = buildPlanPrompt({ category: "UX", existentes: EXISTENTES, evitar: ["tema rechazado"] });
    expect(out).toContain("- tema rechazado");
  });

  it("ofrece los tres clusters y la opción de ninguno", () => {
    const out = buildPlanPrompt({ category: "UX", existentes: [] });
    expect(out).toContain("**C1**");
    expect(out).toContain("**C2**");
    expect(out).toContain("**C3**");
    expect(out).toContain("NINGUNO");
    expect(out).not.toContain("**IA**");
  });
});

describe("listaNumerada", () => {
  it("añade el metaTitle y el slug para que el modelo vea lo mismo que Google", () => {
    expect(listaNumerada(EXISTENTES)).toContain('metaTitle: "Diseño de producto vs. UX" · /diferencia-entre-diseno-de-producto-y-diseno-ux');
  });
});

describe("interpretarPlan", () => {
  const base = { tema_es: "t", tema_en: "t", angulo_es: "a", cluster: "C2", duplicado_de: 0, motivo: "" };

  it("traduce el número de duplicado_de al post de la lista", () => {
    expect(interpretarPlan({ ...base, duplicado_de: 1 }, EXISTENTES).duplicadoDe.id).toBe(900);
  });

  it("0 o un número fuera de la lista es que no hay duplicado", () => {
    expect(interpretarPlan(base, EXISTENTES).duplicadoDe).toBeNull();
    expect(interpretarPlan({ ...base, duplicado_de: 7 }, EXISTENTES).duplicadoDe).toBeNull();
  });

  it("NINGUNO, o un cluster que no es de los tres, es sin cluster", () => {
    expect(interpretarPlan({ ...base, cluster: "NINGUNO" }, EXISTENTES)).toMatchObject({ cluster: null, sinCluster: true });
    expect(interpretarPlan({ ...base, cluster: "IA" }, EXISTENTES)).toMatchObject({ cluster: null, sinCluster: true });
    expect(interpretarPlan(base, EXISTENTES)).toMatchObject({ cluster: "C2", sinCluster: false });
  });

  it("con tema fijado manda el tema fijado aunque el modelo lo reformule", () => {
    expect(interpretarPlan({ ...base, tema_es: "otra cosa" }, EXISTENTES, { temaFijo: "el fijado" }).tema_es).toBe("el fijado");
  });
});
