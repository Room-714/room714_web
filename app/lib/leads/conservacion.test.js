import { describe, expect, it } from "vitest";
import { limiteConservacion } from "@/app/lib/leads/conservacion";

describe("plazo de conservación de los contactos", () => {
  it("es de dos años hacia atrás", () => {
    expect(limiteConservacion(new Date("2026-11-16T10:00:00Z")).toISOString()).toBe(
      "2024-11-16T10:00:00.000Z",
    );
  });

  it("no modifica la fecha que recibe", () => {
    const ahora = new Date("2026-11-16T10:00:00Z");
    limiteConservacion(ahora);
    expect(ahora.toISOString()).toBe("2026-11-16T10:00:00.000Z");
  });
});
