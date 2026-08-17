import { describe, expect, it } from "vitest";
import { normalizeLinkedInProfileUrl } from "@/app/api/cron/discover-prospects/route";

// Este test existe por un fallo real: la validación original exigía https, y
// Apollo devuelve los perfiles en http. Resultado: 26 créditos gastados, 26
// URLs tiradas a la basura y la lista de prospectos vacía. Que no vuelva.
describe("normalizeLinkedInProfileUrl", () => {
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

  it("acepta subdominios de linkedin y páginas de empresa", () => {
    expect(normalizeLinkedInProfileUrl("http://es.linkedin.com/in/alguien")).toBe(
      "https://es.linkedin.com/in/alguien",
    );
    expect(
      normalizeLinkedInProfileUrl("http://linkedin.com/company/room-714"),
    ).toBe("https://linkedin.com/company/room-714");
  });

  it("rechaza hosts que no son de linkedin, aunque lo imiten", () => {
    expect(normalizeLinkedInProfileUrl("http://linkedin.com.evil.example/x")).toBeNull();
    expect(normalizeLinkedInProfileUrl("https://example.com/in/alguien")).toBeNull();
  });

  it("rechaza esquemas peligrosos y basura", () => {
    expect(normalizeLinkedInProfileUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeLinkedInProfileUrl("ftp://www.linkedin.com/in/x")).toBeNull();
    expect(normalizeLinkedInProfileUrl("no soy una url")).toBeNull();
  });

  it("tolera vacíos sin explotar", () => {
    expect(normalizeLinkedInProfileUrl(null)).toBeNull();
    expect(normalizeLinkedInProfileUrl(undefined)).toBeNull();
    expect(normalizeLinkedInProfileUrl("")).toBeNull();
    expect(normalizeLinkedInProfileUrl("   ")).toBeNull();
  });
});
