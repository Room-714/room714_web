// Open Graph y Twitter de una página, construidos a partir del mismo title y
// description que su <title> y su meta description. Vive aparte porque Next
// no fusiona `openGraph` ni `twitter` entre el layout y la página: el objeto
// de la página sustituye entero al del layout. Una página que declaraba solo
// og:title y og:description perdía la imagen, el siteName y el locale, y al
// no declarar `twitter` heredaba el twitter:title de la portada antigua.

export const DEFAULT_OG_IMAGE = {
  url: "/og-image.png", // absoluta gracias al metadataBase del layout
  width: 1200,
  height: 630,
  alt: "Room 714",
};

/**
 * @param {object} opts
 * @param {"es"|"en"} opts.lang
 * @param {string} opts.title        el mismo texto que el <title> de la página
 * @param {string} opts.description  el mismo texto que su meta description
 * @param {string} opts.url          URL absoluta de la página
 * @param {"website"|"article"} [opts.type]
 */
export function socialMeta({ lang, title, description, url, type = "website" }) {
  return {
    openGraph: {
      title,
      description,
      url,
      siteName: "Room 714",
      images: [DEFAULT_OG_IMAGE],
      locale: lang === "es" ? "es_ES" : "en_US",
      type,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}
