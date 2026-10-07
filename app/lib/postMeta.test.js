import { describe, expect, it } from "vitest";
import { resolverMeta } from "./postMeta";

describe("resolverMeta", () => {
  it("guarda lo que se escribe, sin espacios sobrantes", () => {
    expect(resolverMeta("  Nueva   description.  ", "Vieja")).toBe("Nueva description.");
  });

  it("si el formulario no trae el campo, conserva el anterior", () => {
    expect(resolverMeta(undefined, "Vieja")).toBe("Vieja");
    expect(resolverMeta(undefined, undefined)).toBeNull();
  });

  it("vaciar el campo lo borra", () => {
    expect(resolverMeta("   ", "Vieja")).toBeNull();
  });
});
