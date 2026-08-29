import { describe, expect, it } from "vitest";
import { normalizeLinkedInProfileUrl } from "./prospectFields";

// Este fichero existe por dos fallos reales, no por completismo.
describe("normalizeLinkedInProfileUrl", () => {
  // Fallo 1: la validación exigía https y Apollo devuelve http. Rechazó el
  // 100% de los perfiles: 26 créditos gastados y la lista vacía.
  it("acepta el http que devuelve Apollo y lo normaliza a https", () => {
    expect(
      normalizeLinkedInProfileUrl(
        "http://www.linkedin.com/in/marcus-ellery-4c2b81de",
      ),
    ).toBe("https://www.linkedin.com/in/marcus-ellery-4c2b81de");
  });

  it("deja intacto lo que ya viene en https", () => {
    const url = "https://www.linkedin.com/in/josecesfranjo";
    expect(normalizeLinkedInProfileUrl(url)).toBe(url);
  });

  it("acepta subdominios y páginas de empresa", () => {
    expect(normalizeLinkedInProfileUrl("http://es.linkedin.com/in/alguien")).toBe(
      "https://es.linkedin.com/in/alguien",
    );
    expect(
      normalizeLinkedInProfileUrl("http://linkedin.com/company/room-714"),
    ).toBe("https://linkedin.com/company/room-714");
  });

  it("rechaza hosts que imitan a linkedin", () => {
    expect(
      normalizeLinkedInProfileUrl("http://linkedin.com.evil.example/x"),
    ).toBeNull();
    expect(normalizeLinkedInProfileUrl("https://example.com/in/x")).toBeNull();
  });

  it("rechaza esquemas peligrosos y basura", () => {
    expect(normalizeLinkedInProfileUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeLinkedInProfileUrl("ftp://www.linkedin.com/in/x")).toBeNull();
    expect(normalizeLinkedInProfileUrl("no soy una url")).toBeNull();
  });

  it("tolera vacíos", () => {
    for (const v of [null, undefined, "", "   "]) {
      expect(normalizeLinkedInProfileUrl(v)).toBeNull();
    }
  });
});
