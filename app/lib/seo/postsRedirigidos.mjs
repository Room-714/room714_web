// Posts del blog fusionados en otro y redirigidos por código.
//
// Se redirigen aquí, en next.config.mjs, y no con la tabla PostRedirect,
// porque estas redirecciones se resuelven antes que la ruta dinámica
// /[lang]/blog/[slug] sin tocar la base de datos: funcionan aunque el post
// siga existiendo y publicado, y no añaden una consulta por visita.
//
// De esta lista salen dos cosas, para que no puedan desincronizarse:
// las redirecciones de next.config.mjs y las URLs que el sitemap omite
// (anunciar a Google una URL que redirige es mandarle a rastrear un salto).
//
// Va en .mjs por lo mismo que routes.mjs: next.config.mjs lo carga Node
// directamente.

/** Slugs sin el prefijo /{lang}/blog/. */
export const POSTS_REDIRIGIDOS = [
  // 2026-11: tres duplicados de "diseño de producto vs UX" que competían en
  // Google con el principal. Su contenido útil ya está en el principal.
  {
    lang: "es",
    de: "diferencia-diseno-de-producto-y-diseno-ux",
    a: "diferencia-entre-diseno-de-producto-y-diseno-ux",
  },
  {
    lang: "es",
    de: "diferencia-diseno-producto-vs-ux-respuesta-util",
    a: "diferencia-entre-diseno-de-producto-y-diseno-ux",
  },
  {
    lang: "es",
    de: "diferencia-diseno-producto-ux-cuando-importa",
    a: "diferencia-entre-diseno-de-producto-y-diseno-ux",
  },
  {
    lang: "en",
    de: "product-design-vs-ux-design-difference",
    a: "difference-between-product-design-and-ux-design",
  },
  {
    lang: "en",
    de: "product-design-vs-ux-design-useful-answer",
    a: "difference-between-product-design-and-ux-design",
  },
  {
    lang: "en",
    de: "product-design-vs-ux-design-when-it-matters",
    a: "difference-between-product-design-and-ux-design",
  },
];

/** Filas { de, a } con la ruta completa, en el formato de RENOMBRADAS. */
export function redireccionesDePosts() {
  return POSTS_REDIRIGIDOS.map(({ lang, de, a }) => ({
    de: `/${lang}/blog/${de}`,
    a: `/${lang}/blog/${a}`,
  }));
}

const redirigidos = new Set(
  POSTS_REDIRIGIDOS.map(({ lang, de }) => `${lang}/${de}`),
);

/** true si la URL de ese post redirige y no debe ir al sitemap. */
export function estaRedirigido(lang, slug) {
  return redirigidos.has(`${lang}/${slug}`);
}
