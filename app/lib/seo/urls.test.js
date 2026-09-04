import { describe, expect, it } from "vitest";
import {
  SITE_URL,
  blogUrl,
  buildAlternates,
  langPaths,
  samePath,
} from "@/app/lib/seo/urls";

describe("blogUrl", () => {
  it("construye la URL absoluta de un artículo", () => {
    expect(blogUrl("es", "rag-no-es-magia")).toBe(
      `${SITE_URL}/es/blog/rag-no-es-magia`,
    );
  });

  it("percent-encodea el slug", () => {
    expect(blogUrl("es", "añadir-ia")).toBe(`${SITE_URL}/es/blog/a%C3%B1adir-ia`);
  });

  it("devuelve null si el post no tiene traducción en ese idioma", () => {
    expect(blogUrl("en", undefined)).toBeNull();
    expect(blogUrl("en", null)).toBeNull();
    expect(blogUrl("en", "")).toBeNull();
  });
});

describe("samePath", () => {
  it("cuelga la misma ruta de los dos idiomas", () => {
    expect(samePath("/careers")).toEqual({
      es: `${SITE_URL}/es/careers`,
      en: `${SITE_URL}/en/careers`,
    });
  });

  it("sirve para la portada, cuya ruta es solo el idioma", () => {
    expect(samePath("")).toEqual({
      es: `${SITE_URL}/es`,
      en: `${SITE_URL}/en`,
    });
  });
});

describe("langPaths", () => {
  it("admite rutas distintas por idioma, como las de la Fase 2", () => {
    expect(langPaths("/es/casos", "/en/cases")).toEqual({
      es: `${SITE_URL}/es/casos`,
      en: `${SITE_URL}/en/cases`,
    });
  });
});

describe("buildAlternates", () => {
  const urls = samePath("/about");

  it("la canónica es la del idioma que se está sirviendo", () => {
    expect(buildAlternates("es", urls).canonical).toBe(`${SITE_URL}/es/about`);
    expect(buildAlternates("en", urls).canonical).toBe(`${SITE_URL}/en/about`);
  });

  it("declara es, en y x-default, y x-default apunta a EN", () => {
    const { languages } = buildAlternates("es", urls);
    expect(languages).toEqual({
      es: `${SITE_URL}/es/about`,
      en: `${SITE_URL}/en/about`,
      "x-default": `${SITE_URL}/en/about`,
    });
  });

  it("es recíproco: los dos idiomas declaran el mismo juego de URLs", () => {
    expect(buildAlternates("es", urls).languages).toEqual(
      buildAlternates("en", urls).languages,
    );
  });

  it("usa siempre URLs absolutas", () => {
    const { canonical, languages } = buildAlternates("en", urls);
    for (const url of [canonical, ...Object.values(languages)]) {
      expect(url.startsWith("https://")).toBe(true);
    }
  });

  it("omite el idioma que no existe en lugar de apuntar a una URL rota", () => {
    const soloEs = { es: `${SITE_URL}/es/blog/x`, en: null };
    const { canonical, languages } = buildAlternates("es", soloEs);
    expect(languages).toEqual({
      es: `${SITE_URL}/es/blog/x`,
      "x-default": `${SITE_URL}/es/blog/x`,
    });
    expect(canonical).toBe(`${SITE_URL}/es/blog/x`);
  });

  it("si falta el idioma servido, la canónica cae en el que exista", () => {
    const soloEn = { es: null, en: `${SITE_URL}/en/blog/y` };
    expect(buildAlternates("es", soloEn).canonical).toBe(
      `${SITE_URL}/en/blog/y`,
    );
  });
});
