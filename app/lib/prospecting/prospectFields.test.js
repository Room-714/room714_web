import { describe, expect, it } from "vitest";
import {
  interestFor,
  keywordsFor,
  normalizeLinkedInProfileUrl,
} from "./prospectFields";

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

describe("interestFor", () => {
  // Fallo 2: el patrón buscaba "cto" como subcadena y "direCTOr" la contiene,
  // así que los diez primeros compradores importados —todos directores—
  // quedaron etiquetados como "Software development".
  it("un director comercial NO es software development", () => {
    expect(interestFor("Director Comercial")).toBe("Canal digital y conversión");
    expect(interestFor("Commercial Director")).toBe("Canal digital y conversión");
    expect(interestFor("Director de Marketing Digital")).toBe(
      "Canal digital y conversión",
    );
  });

  it("ningún cargo con la palabra director cae en software por accidente", () => {
    for (const cargo of [
      "Director General",
      "Directora de Operaciones",
      "Director Comercial Internacional",
    ]) {
      expect(interestFor(cargo)).not.toBe("Software development");
    }
  });

  it("un CTO de verdad sí es software development", () => {
    expect(interestFor("CTO")).toBe("Software development");
    expect(interestFor("CTO & Co-Founder")).toBe("Software development");
  });

  it("reconoce operaciones, transformación y diseño", () => {
    expect(interestFor("COO")).toBe("Digitalización de procesos");
    expect(interestFor("Director de Operaciones")).toBe(
      "Digitalización de procesos",
    );
    expect(interestFor("Director de Transformación Digital")).toBe(
      "Transformación digital",
    );
    expect(interestFor("Head of UX")).toBe("UX/UI y research");
  });

  it("un CEO cae en el genérico: su cargo no declara una necesidad", () => {
    expect(interestFor("CEO")).toBe("Producto digital y CX");
    expect(interestFor(null)).toBe("Producto digital y CX");
  });
});

describe("keywordsFor", () => {
  it("añade temas propios del cargo y la empresa", () => {
    const kw = keywordsFor("Director Comercial", "Araven");
    expect(kw).toContain("conversión");
    expect(kw).toContain("Araven");
    expect(kw.length).toBeLessThanOrEqual(5);
  });

  it("sin cargo ni empresa devuelve los temas del perfil de comprador", () => {
    const kw = keywordsFor(null, null);
    expect(kw.length).toBeGreaterThan(0);
    expect(kw.length).toBeLessThanOrEqual(5);
  });

  it("no repite temas", () => {
    const kw = keywordsFor("Director de Operaciones", "Acme");
    expect(new Set(kw).size).toBe(kw.length);
  });
});
