// Apollo devuelve los perfiles en HTTP, no en HTTPS:
//   "linkedin_url": "http://www.linkedin.com/in/marcus-ellery-4c2b81de"
// Una validación que exigiera https los rechazaría todos (y lo hizo: 26
// créditos gastados y ninguna URL guardada). Aceptamos ambos esquemas y
// normalizamos a https, que es lo que sirve LinkedIn de todas formas.
export function normalizeLinkedInProfileUrl(url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(String(url).trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!/(^|\.)linkedin\.com$/.test(parsed.hostname)) return null;
  parsed.protocol = "https:";
  return parsed.toString();
}
