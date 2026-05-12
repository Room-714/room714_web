// Mapeo de slug URL ↔ categoría enum, por idioma.
// Slugs URL-safe (sin acentos ni ñ) y descriptivos en cada idioma.
//
// Rutas resultantes:
//   /es/blog/category/tecnologia → TECH
//   /es/blog/category/diseno     → DESIGN
//   /es/blog/category/producto   → PRODUCT
//   /es/blog/category/usabilidad → UX
//
//   /en/blog/category/tech       → TECH
//   /en/blog/category/design     → DESIGN
//   /en/blog/category/product    → PRODUCT
//   /en/blog/category/ux         → UX

export const SLUG_TO_CATEGORY = {
  es: {
    tecnologia: "TECH",
    diseno: "DESIGN",
    producto: "PRODUCT",
    usabilidad: "UX",
  },
  en: {
    tech: "TECH",
    design: "DESIGN",
    product: "PRODUCT",
    ux: "UX",
  },
};

export const CATEGORY_TO_SLUG = {
  es: {
    TECH: "tecnologia",
    DESIGN: "diseno",
    PRODUCT: "producto",
    UX: "usabilidad",
  },
  en: {
    TECH: "tech",
    DESIGN: "design",
    PRODUCT: "product",
    UX: "ux",
  },
};

export const SUPPORTED_LANGS = ["es", "en"];

export function getCategoryFromSlug(lang, slug) {
  return SLUG_TO_CATEGORY[lang]?.[slug] ?? null;
}

export function getSlugFromCategory(lang, category) {
  return CATEGORY_TO_SLUG[lang]?.[category] ?? null;
}

export function listAllCategoryRoutes() {
  const routes = [];
  for (const lang of SUPPORTED_LANGS) {
    for (const slug of Object.keys(SLUG_TO_CATEGORY[lang])) {
      routes.push({
        lang,
        slug,
        category: SLUG_TO_CATEGORY[lang][slug],
        url: `/${lang}/blog/category/${slug}`,
      });
    }
  }
  return routes;
}
