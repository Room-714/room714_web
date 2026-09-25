import { describe, expect, it } from "vitest";
import { buildSeoBlock, validateGenerated } from "./generator";
import { insertLinkAroundPhrase } from "./backlinker";

// Borrador mínimo que pasa la validación estructural; cada test cambia lo
// que necesita.
function draft(overrides = {}) {
  return {
    title_es: "Reducir el abandono en el alta de tu SaaS",
    title_en: "Reduce sign-up drop-off in your SaaS",
    slug_es: "reducir-abandono-alta",
    slug_en: "reduce-sign-up-drop-off",
    tags_es: ["ux"],
    tags_en: ["ux"],
    content_es:
      '<p>Apertura.</p><h2>Sección: idea</h2><p>Cierre, <a href="/es/producto-para-tus-clientes">rediseñamos el alta</a>.</p>',
    content_en:
      '<p>Opening.</p><h2>Section: idea</h2><p>Closing, <a href="/en/product-for-your-customers">we redesign sign-up</a>.</p>',
    image_query: "calm desk",
    meta_description_es: "Descripción en español de longitud razonable.",
    meta_description_en: "A reasonably sized English description.",
    cluster: "C2",
    target_query_es: "reducir el abandono en el alta",
    target_query_en: "reduce sign-up drop-off",
    meta_title_es: "Reducir el abandono en el alta",
    meta_title_en: "Reduce sign-up drop-off",
    ...overrides,
  };
}

describe("validateGenerated · reglas de posicionamiento", () => {
  it("conserva el enlace a la página del cluster (antes lo borraba el saneado)", () => {
    const out = validateGenerated(draft(), { category: "UX" });
    expect(out.content_es).toContain('href="/es/producto-para-tus-clientes"');
    expect(out.content_en).toContain('href="/en/product-for-your-customers"');
    expect(out.seo.warnings).toEqual([]);
  });

  it("sigue quitando enlaces a páginas no permitidas", () => {
    const out = validateGenerated(
      draft({
        content_es:
          '<p>Apertura <a href="/es/hablemos">habla</a>.</p><h2>S: i</h2><p>Cierre, <a href="/es/producto-para-tus-clientes">rediseñamos</a>.</p>',
      }),
      { category: "UX" },
    );
    expect(out.content_es).not.toContain('href="/es/hablemos"');
    expect(out.content_es).toContain("Apertura habla.");
  });

  it("añade la frase de respaldo si falta el enlace al cluster", () => {
    const out = validateGenerated(
      draft({ content_es: "<p>Apertura.</p><h2>S: i</h2><p>Cierre sin enlace.</p>" }),
      { category: "UX" },
    );
    expect(out.content_es).toMatch(/Cierre sin enlace\. .*<a href="\/es\/producto-para-tus-clientes">.+<\/a>.*<\/p>$/);
    expect(out.seo.warnings.join()).toMatch(/sin enlace/);
  });

  it("deja un solo enlace al cluster y un solo caso por idioma", () => {
    const html =
      '<p><a href="/es/producto-para-tus-clientes">uno</a> y <a href="/es/producto-para-tus-clientes">dos</a>.</p><h2>S: i</h2>' +
      '<p><a href="/es/casos/saas-soporte-autogestion">caso A</a> y <a href="/es/casos/ia-ecommerce-sin-tocar-la-tienda">caso B</a>.</p>';
    const out = validateGenerated(draft({ content_es: html }), { category: "UX" });
    expect(out.content_es.match(/producto-para-tus-clientes/g)).toHaveLength(1);
    expect(out.content_es).toContain("dos");
    expect(out.content_es).toContain('href="/es/casos/saas-soporte-autogestion"');
    expect(out.content_es).not.toContain('href="/es/casos/ia-ecommerce-sin-tocar-la-tienda"');
  });

  it("descarta un meta title largo y recorta una description larga por palabra", () => {
    const out = validateGenerated(
      draft({
        meta_title_es: "Un meta title que se pasa claramente de cuarenta y nueve caracteres",
        meta_description_es: "palabra ".repeat(30).trim(),
      }),
      { category: "UX" },
    );
    expect(out.meta_title_es).toBeNull();
    expect([...out.meta_description_es].length).toBeLessThanOrEqual(155);
    expect(out.meta_description_es.endsWith("palabra")).toBe(true);
  });

  it("avisa si el título persigue una búsqueda reservada a una página", () => {
    const out = validateGenerated(draft({ title_es: "Guía de diseño de producto digital" }), { category: "UX" });
    expect(out.seo.warnings.join()).toMatch(/búsqueda reservada "diseño de producto digital"/);
  });

  it("usa el cluster de la categoría si el modelo devuelve uno inválido", () => {
    const out = validateGenerated(
      draft({
        cluster: "X9",
        content_es: '<p>A.</p><h2>S: i</h2><p>B <a href="/es/empezar-de-cero">idea</a>.</p>',
        content_en: '<p>A.</p><h2>S: i</h2><p>B <a href="/en/starting-from-scratch">idea</a>.</p>',
      }),
      { category: "PRODUCT" },
    );
    expect(out.cluster).toBe("C1");
    expect(out.content_es).toContain('href="/es/empezar-de-cero"');
  });
});

describe("buildSeoBlock", () => {
  it("sugiere el cluster de la categoría y lista búsquedas prohibidas y URLs", () => {
    const block = buildSeoBlock("TECH");
    expect(block).toContain("Cluster sugerido: **C3**");
    expect(block).toContain("/es/producto-para-tu-equipo");
    expect(block).toContain('"empresa de producto digital"');
    expect(block).toContain("/en/cases/saas-support-self-service");
  });
});

describe("insertLinkAroundPhrase", () => {
  it("no envuelve la frase si cae dentro de un enlace existente", () => {
    const html = '<p>Cuando <a href="/es/producto-para-tus-clientes">rediseñamos el alta</a> medimos el alta.</p>';
    const out = insertLinkAroundPhrase({ html, phrase: "el alta", href: "/es/blog/x" });
    expect(out.replaced).toBe(true);
    expect(out.html).toBe(
      '<p>Cuando <a href="/es/producto-para-tus-clientes">rediseñamos el alta</a> medimos <a href="/es/blog/x">el alta</a>.</p>',
    );
  });

  it("no envuelve la frase si solo aparece dentro de un atributo", () => {
    const html = '<p><a href="/es/blog/el-alta">texto</a> y nada más.</p>';
    expect(insertLinkAroundPhrase({ html, phrase: "el-alta", href: "/es/blog/y" }).replaced).toBe(false);
  });
});
