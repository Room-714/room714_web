import { describe, expect, it } from "vitest";
import {
  POSTS_REDIRIGIDOS,
  estaRedirigido,
  redireccionesDePosts,
} from "@/app/lib/seo/postsRedirigidos.mjs";

describe("redireccionesDePosts", () => {
  it("construye la ruta completa con idioma", () => {
    expect(redireccionesDePosts()).toContainEqual({
      de: "/es/blog/diferencia-diseno-de-producto-y-diseno-ux",
      a: "/es/blog/diferencia-entre-diseno-de-producto-y-diseno-ux",
    });
    expect(redireccionesDePosts()).toContainEqual({
      de: "/en/blog/product-design-vs-ux-design-when-it-matters",
      a: "/en/blog/difference-between-product-design-and-ux-design",
    });
  });

  it("no encadena saltos: ningún destino es a su vez un origen", () => {
    const origenes = new Set(redireccionesDePosts().map((r) => r.de));
    for (const { a } of redireccionesDePosts()) {
      expect(origenes.has(a)).toBe(false);
    }
  });

  it("no repite orígenes", () => {
    const origenes = redireccionesDePosts().map((r) => r.de);
    expect(new Set(origenes).size).toBe(origenes.length);
  });
});

describe("estaRedirigido", () => {
  it("excluye del sitemap los posts redirigidos, en su idioma", () => {
    for (const { lang, de } of POSTS_REDIRIGIDOS) {
      expect(estaRedirigido(lang, de)).toBe(true);
    }
  });

  it("deja en el sitemap el post principal", () => {
    expect(
      estaRedirigido("es", "diferencia-entre-diseno-de-producto-y-diseno-ux"),
    ).toBe(false);
    expect(
      estaRedirigido("en", "difference-between-product-design-and-ux-design"),
    ).toBe(false);
  });

  it("no confunde idiomas", () => {
    expect(
      estaRedirigido("en", "diferencia-diseno-de-producto-y-diseno-ux"),
    ).toBe(false);
  });
});
