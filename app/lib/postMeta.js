// Metadatos SEO que se editan a mano en el admin: el <title> corto (metaTitle)
// y la meta description de cada traducción.

/** El layout añade " | Room 714" (11 caracteres): 49 + 11 = 60. */
export const META_TITLE_MAX = 49;
export const META_DESCRIPTION_MAX = 155;

/**
 * Valor que se guarda al editar un post. `enviado` undefined = el formulario
 * no trae el campo (se conserva el anterior); vacío = se borra (null: la web
 * usa el título y un extracto del cuerpo).
 */
export function resolverMeta(enviado, previo) {
  if (enviado === undefined) return previo ?? null;
  const limpio = String(enviado).trim().replace(/\s+/g, " ");
  return limpio || null;
}
