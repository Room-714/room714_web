import { describe, expect, it } from "vitest";
import { filterCandidates, EXCLUDED_COMPANY_PATTERNS } from "./candidateFilter";

const persona = (extra) => ({
  id: "a1",
  first_name: "José",
  last_name_obfuscated: "R.",
  title: "Director de Operaciones",
  organization: { name: "Envases Ruiz SL" },
  ...extra,
});

describe("filterCandidates", () => {
  it("deja pasar a un candidato normal", () => {
    const { kept, dropped } = filterCandidates([persona()], { rules: {} });
    expect(kept).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });

  it("descarta a quien no trae id", () => {
    const { kept, dropped } = filterCandidates([persona({ id: null })], { rules: {} });
    expect(kept).toHaveLength(0);
    expect(dropped[0].reason).toBe("sin id de Apollo");
  });

  it("descarta empresas que se dedican a lo que vendemos", () => {
    const casos = ["Acme Software SL", "Estudio Digital", "Nexo Consulting", "La Agencia"];
    for (const name of casos) {
      const { kept } = filterCandidates([persona({ organization: { name } })], { rules: {} });
      expect(kept, `${name} debería descartarse`).toHaveLength(0);
    }
  });

  it("no descarta empresas normales que contengan una subcadena parecida", () => {
    const casos = ["Aguas del Norte SA", "Estudios Geológicos Ruiz", "Digitalizadora Textil"];
    for (const name of casos) {
      const { kept } = filterCandidates([persona({ organization: { name } })], { rules: {} });
      expect(kept, `${name} NO debería descartarse`).toHaveLength(1);
    }
  });

  it("se queda con una sola persona por empresa", () => {
    const { kept, dropped } = filterCandidates(
      [
        persona({ id: "a1", organization: { name: "Envases Ruiz SL" } }),
        persona({ id: "a2", organization: { name: "Envases Ruiz SL" } }),
      ],
      { rules: {} },
    );
    expect(kept).toHaveLength(1);
    expect(dropped[0].reason).toBe("ya hay otro candidato de esa empresa");
  });

  it("descarta los cargos que las reglas han excluido", () => {
    const { kept, dropped } = filterCandidates([persona({ title: "Director Comercial" })], {
      rules: { excludedTitles: ["Director Comercial"] },
    });
    expect(kept).toHaveLength(0);
    expect(dropped[0].reason).toContain("cargo excluido");
  });

  it("compara los cargos excluidos sin distinguir mayúsculas ni espacios", () => {
    const { kept } = filterCandidates([persona({ title: "  DIRECTOR COMERCIAL " })], {
      rules: { excludedTitles: ["Director Comercial"] },
    });
    expect(kept).toHaveLength(0);
  });

  it("descarta a quien ya hemos visto", () => {
    const { kept, dropped } = filterCandidates([persona({ id: "visto" })], {
      rules: {},
      knownIds: new Set(["visto"]),
    });
    expect(kept).toHaveLength(0);
    expect(dropped[0].reason).toBe("ya estaba en el historial");
  });

  it("no revienta si falta organization", () => {
    const { kept } = filterCandidates([persona({ organization: null })], { rules: {} });
    expect(kept).toHaveLength(1);
  });

  it("no revienta sin opciones", () => {
    const { kept } = filterCandidates([persona()]);
    expect(kept).toHaveLength(1);
  });

  it("cada descarte dice de quién es y por qué", () => {
    const { dropped } = filterCandidates(
      [persona({ id: "x", organization: { name: "Acme Software SL" } })],
      { rules: {} },
    );
    expect(dropped[0].apolloId).toBe("x");
    expect(dropped[0].reason).toBeTruthy();
  });
});
