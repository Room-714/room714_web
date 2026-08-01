// Hosts admitidos como destino. Cualquier otro se descarta: esta URL acaba
// siendo el destino de la redirección de /api/go/variant/[id], y aceptar
// hosts arbitrarios convertiría esa ruta en un open redirect.
const ALLOWED_HOSTS = new Set(["www.linkedin.com", "linkedin.com"]);

const URN_PATTERN = /^urn:li:(share|ugcPost|activity):\d+$/;

// Normaliza lo que devuelve Make tras publicar. Acepta el URN que da la API de
// LinkedIn o una URL ya formada. Devuelve null si no se puede confiar en ella.
export function linkedInUrlFrom({ postUrl, postUrn } = {}) {
  if (postUrn) {
    const urn = String(postUrn).trim();
    if (!URN_PATTERN.test(urn)) return null;
    return `https://www.linkedin.com/feed/update/${urn}/`;
  }

  if (!postUrl) return null;

  let parsed;
  try {
    parsed = new URL(String(postUrl).trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return null;
  return parsed.toString();
}
