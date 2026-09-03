// Las dos mitades del mismo problema: cómo se ESCRIBE un slug y cómo se LEE.
//
// Un artículo publicado llegó a producción con una "ñ" en el slug y su URL
// devolvía 404. La causa no era una sino tres, en cadena:
//
//   1. El generador usaba el slug que propone el modelo tal cual
//      (`draft.slug_es || slugifyFallback(...)`), así que el saneado solo
//      corría cuando el modelo NO daba slug — es decir, casi nunca.
//   2. Next entrega los params de una ruta dinámica SIN decodificar, así que
//      la página recibía "a%C3%B1adir" y buscaba ese literal en Postgres.
//   3. El sitemap anunciaba el byte crudo, que Vercel rechaza antes de
//      enrutar (500).
//
// `slugify` cierra la 1 y `normalizeSlugParam` la 2, que además rescata los
// slugs que ya están guardados mal sin tocar la base de datos.

/**
 * Convierte un texto en un slug seguro para URL: minúsculas, sin tildes ni
 * eñes, sin puntuación y sin nada que haya que percent-encodear. Idempotente,
 * así que se puede aplicar sobre un slug que ya venía limpio.
 */
export function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas diacríticas ya separadas por NFD
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, ""); // el recorte puede dejar un guión final
}

/**
 * Prepara el `slug` que llega en los params de la ruta para consultarlo.
 * Decodifica el percent-encoding que Next no deshace y unifica la forma
 * Unicode a NFC, que es la que guarda Postgres.
 */
export function normalizeSlugParam(raw) {
  if (typeof raw !== "string") return "";
  let salida = raw;
  if (salida.includes("%")) {
    try {
      salida = decodeURIComponent(salida);
    } catch {
      // Secuencia de escape inválida (un "%" suelto en el slug, por ejemplo):
      // nos quedamos con el original y que la consulta decida.
    }
  }
  return salida.normalize("NFC");
}
