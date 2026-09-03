// El único sitio donde vive cada URL del sitio.
//
// De aquí salen los ítems del menú, el sitemap, los hreflang, las migas de
// pan, los CTA y el bucle que genera las redirecciones de idioma cruzado en
// next.config.mjs. La Fase 1 arregló unos hreflang escritos a mano página
// por página que se habían desincronizado; esto es para que no vuelva a
// pasar.
//
// Va en .mjs y no en .js porque next.config.mjs lo carga Node directamente,
// y sin "type": "module" en package.json Node trataría un .js como CommonJS
// y la sintaxis de import fallaría.

/** Ruta de cada página, sin el prefijo de idioma. */
export const ROUTES = {
  home: { es: "", en: "" },

  // Qué hacemos: índice más las cuatro situaciones
  queHacemos: { es: "/que-hacemos", en: "/what-we-do" },
  productoClientes: {
    es: "/producto-para-tus-clientes",
    en: "/product-for-your-customers",
  },
  productoEquipo: {
    es: "/producto-para-tu-equipo",
    en: "/product-for-your-team",
  },
  iaProducto: { es: "/ia-en-el-producto", en: "/ai-in-the-product" },
  empezarDeCero: { es: "/empezar-de-cero", en: "/starting-from-scratch" },

  casos: { es: "/casos", en: "/cases" },
  comoTrabajamos: { es: "/como-trabajamos", en: "/how-we-work" },
  blog: { es: "/blog", en: "/blog" },
  hablemos: { es: "/hablemos", en: "/lets-talk" },

  // Fuera del menú, enlazadas desde el footer. Conservan su URL.
  empleo: { es: "/careers", en: "/careers" },
  privacidad: { es: "/privacy", en: "/privacy" },
  terminos: { es: "/terms", en: "/terms" },
  cookies: { es: "/cookies", en: "/cookies" },
};

/** Los tres casos con página propia. */
export const CASOS = {
  saasAutogestion: {
    es: "/casos/saas-soporte-autogestion",
    en: "/cases/saas-support-self-service",
  },
  activacionCanonico: {
    es: "/casos/activacion-modelo-canonico",
    en: "/cases/activation-canonical-model",
  },
  iaEcommerce: {
    es: "/casos/ia-ecommerce-sin-tocar-la-tienda",
    en: "/cases/ai-ecommerce-without-touching-the-store",
  },
};

export const TODAS = { ...ROUTES, ...CASOS };

export const IDIOMAS = ["es", "en"];

/**
 * Las páginas que van al sitemap. Es una lista explícita y no `TODAS` a
 * propósito: anunciar a Google una URL cuya página todavía no existe es
 * anunciarle un 404, así que una ruta entra aquí cuando su vista existe.
 */
export const EN_SITEMAP = [
  "home",
  "queHacemos",
  "productoClientes",
  "productoEquipo",
  "iaProducto",
  "empezarDeCero",
  "casos",
  "comoTrabajamos",
  "hablemos",
  "blog",
  "empleo",
  ...Object.keys(CASOS),
];

/** La ruta completa con idioma: path("casos", "es") → "/es/casos" */
export function path(clave, lang) {
  const ruta = TODAS[clave];
  if (!ruta) throw new Error(`Ruta desconocida: ${clave}`);
  return `/${lang}${ruta[lang]}`;
}

/** Las dos rutas completas de una página, para los hreflang. */
export function pathsOf(clave) {
  return { es: path(clave, "es"), en: path(clave, "en") };
}

/** Las URLs antiguas que hay que redirigir a su equivalente nueva. */
export const RENOMBRADAS = [
  { de: "/es/projects", a: path("casos", "es") },
  { de: "/en/projects", a: path("casos", "en") },
  { de: "/es/about", a: path("comoTrabajamos", "es") },
  { de: "/en/about", a: path("comoTrabajamos", "en") },
  { de: "/es/contact", a: path("hablemos", "es") },
  { de: "/en/contact", a: path("hablemos", "en") },
  // El diagnóstico automático se ha eliminado. Su trabajo era ayudarte a
  // elegir tu situación, que es exactamente lo que hace el índice de Qué
  // hacemos, así que ahí va: la URL está indexada y no puede morir.
  { de: "/es/diagnostic", a: path("queHacemos", "es") },
  { de: "/en/diagnostic", a: path("queHacemos", "en") },
];

/**
 * Redirecciones de idioma cruzado. Cada página tiene una carpeta por idioma,
 * así que `/en/casos` resolvería y pintaría la página en inglés bajo la URL
 * castellana: contenido duplicado. Además proxy.js manda cualquier ruta sin
 * idioma al idioma del navegador, así que quien comparta `room714.com/casos`
 * y lo abra con el navegador en inglés cae justo ahí.
 *
 * Solo genera fila cuando las dos rutas se llaman distinto: /blog o /careers
 * no necesitan guarda.
 */
export function guardasDeIdioma() {
  const filas = [];
  for (const ruta of Object.values(TODAS)) {
    if (ruta.es === ruta.en) continue;
    filas.push({ de: `/en${ruta.es}`, a: `/en${ruta.en}` });
    filas.push({ de: `/es${ruta.en}`, a: `/es${ruta.es}` });
  }
  return filas;
}
