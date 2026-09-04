// Construcción de URLs absolutas del sitio. Vive aparte porque las canónicas,
// los hreflang, el sitemap y el JSON-LD tienen que coincidir carácter a
// carácter: si cada sitio interpola su propia plantilla, antes o después una
// se desvía y Google ve dos URLs donde hay una.

export const SITE_URL = "https://www.room714.com";

/**
 * URL absoluta de un artículo del blog, con el slug percent-encodeado.
 * Devuelve null si no hay slug (hay posts sin traducción en un idioma), para
 * que quien la use pueda omitir la entrada en lugar de publicar una URL rota.
 */
export function blogUrl(lang, slug) {
  if (!slug) return null;
  return `${SITE_URL}/${lang}/blog/${encodeURIComponent(slug)}`;
}

/** Una página cuya ruta es igual en los dos idiomas: "/careers". */
export const samePath = (path) => ({
  es: `${SITE_URL}/es${path}`,
  en: `${SITE_URL}/en${path}`,
});

/** Una página con ruta distinta en cada idioma: "/es/casos" y "/en/cases". */
export const langPaths = (pathEs, pathEn) => ({
  es: `${SITE_URL}${pathEs}`,
  en: `${SITE_URL}${pathEn}`,
});

/**
 * El bloque `alternates` de generateMetadata: canónica más hreflang de es, en
 * y x-default, siempre absolutos y recíprocos (los dos idiomas declaran el
 * mismo juego, que es lo que Google comprueba).
 *
 * x-default apunta al inglés por ser el idioma de alcance más amplio; si un
 * idioma no existe se omite en lugar de anunciar una URL que da 404.
 */
export function buildAlternates(lang, urls) {
  const languages = {};
  if (urls.es) languages.es = urls.es;
  if (urls.en) languages.en = urls.en;

  const xDefault = urls.en || urls.es;
  if (xDefault) languages["x-default"] = xDefault;

  return { canonical: urls[lang] || xDefault, languages };
}
