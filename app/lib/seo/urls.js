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
