import { describe, expect, it } from "vitest";
import { decidir } from "./cribaOferta";

const cumple = { reside_en_espana: true, titulacion: "MASTER", anios_experiencia: 5 };

describe("decidir", () => {
  it("pasa si reside en España, tiene titulación relacionada y 2 años o más", () => {
    expect(decidir(cumple)).toBe(true);
    expect(decidir({ ...cumple, titulacion: "GRADO" })).toBe(true);
    expect(decidir({ ...cumple, titulacion: "DOCTORADO" })).toBe(true);
    expect(decidir({ ...cumple, anios_experiencia: 2 })).toBe(true);
    expect(decidir({ ...cumple, anios_experiencia: 2.5 })).toBe(true);
  });

  it("descarta si falla cualquiera de los tres criterios", () => {
    expect(decidir({ ...cumple, reside_en_espana: false })).toBe(false);
    expect(decidir({ ...cumple, titulacion: "NINGUNA" })).toBe(false);
    expect(decidir({ ...cumple, anios_experiencia: 1.5 })).toBe(false);
  });

  it("descarta lo que no se pudo interpretar", () => {
    expect(decidir({ ...cumple, anios_experiencia: null })).toBe(false);
    expect(decidir(null)).toBe(false);
  });
});
