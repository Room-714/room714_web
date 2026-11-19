// Escapado del "little text format" de LinkedIn.
//
// La API de publicaciones de LinkedIn interpreta el texto (commentary) en ese
// formato: ( ) [ ] { } < > | @ * _ ~ \ son caracteres reservados y, sin
// escapar, LinkedIn puede cortar la publicación o comerse parte del texto. Se
// escapan anteponiendo una barra invertida. El # NO se escapa: los hashtags
// tienen que seguir siendo hashtags.
//
// Se aplica en UN solo sitio, justo antes de mandar a Make (enviarAMake, en
// autopost.js). En la base de datos se guarda el texto sin escapar: la
// deduplicación compara texto real y el reintento reenvía lo guardado, que se
// escapa al enviarse (escapar al guardar haría que el reintento escapara dos
// veces).

const RESERVADOS = /[()[\]{}<>|@*_~\\]/g;

export function escaparLittleText(texto) {
  if (typeof texto !== "string") return texto;
  return texto.replace(RESERVADOS, (c) => `\\${c}`);
}

// Campos de la carga útil que acaban como texto de la publicación. El resto
// (título, URL del enlace, imagen, ids) no pasa por el formato y se deja igual:
// escapar la URL de link_for_first_comment rompería el utm_source.
//   empresa:  linkedin_post y linkedin_hashtags_string
//   personal: texto
const CAMPOS_DE_TEXTO = ["linkedin_post", "linkedin_hashtags_string", "texto"];

/** Copia de la carga útil con los campos de texto escapados. */
export function paraLinkedIn(payload) {
  const copia = { ...payload };
  for (const campo of CAMPOS_DE_TEXTO) {
    if (campo in copia) copia[campo] = escaparLittleText(copia[campo]);
  }
  return copia;
}
