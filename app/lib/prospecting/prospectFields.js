import { BUYER_PROFILE } from "@/app/data/ProspectingProfile";

// Campos derivados del cargo y la empresa que Apollo devuelve. Viven aquí, y
// no dentro de la ruta del cron, porque alimentan el prompt del redactor de
// comentarios: si se equivocan, todos los comentarios salen mal enfocados.

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

// Qué servicio de Room714 le encaja, según su cargo. Es lo que el redactor usa
// para enfocar el comentario.
//
// ⚠️ Los patrones van con límites de palabra por una razón concreta: la primera
// versión usaba /(cto|tech)/ sin ellos y "diREC TOR" contiene "cto", así que
// los diez primeros compradores importados —todos directores— quedaron
// etiquetados como "Software development". Nada de subcadenas sueltas aquí.
const INTEREST_RULES = [
  [/\b(ux|user research|design|dise[ñn]o)\b/, "UX/UI y research"],
  // Apollo devuelve las dos grafías, "Director Comercial" y "Commercial
  // Director", así que todas las reglas llevan el término en los dos idiomas.
  [
    /\b(comercial|commercial|cco|ventas|sales|marketing|growth)\b/,
    "Canal digital y conversión",
  ],
  [
    /\b(operaciones|operations|coo|log[íi]stica|supply)\b/,
    "Digitalización de procesos",
  ],
  [
    /\b(transformaci[óo]n|innovaci[óo]n|digital)\b/,
    "Transformación digital",
  ],
  [/\b(cto|ingenier[íi]a|engineering|desarrollo|it)\b/, "Software development"],
  [/\b(producto|product)\b/, "Product management"],
];

export function interestFor(title) {
  const t = String(title || "").toLowerCase();
  for (const [pattern, interest] of INTEREST_RULES) {
    if (pattern.test(t)) return interest;
  }
  // Un CEO o director general no declara una necesidad concreta en el cargo.
  return "Producto digital y CX";
}

// Temas por los que merece la pena comentarle. Se mezcla lo que sugiere su
// cargo con los temas del perfil de comprador.
export function keywordsFor(title, company) {
  const t = String(title || "").toLowerCase();
  const extra = [];
  if (/\b(comercial|ventas|sales|marketing)\b/.test(t)) {
    extra.push("conversión", "canal digital");
  }
  if (/\b(operaciones|operations|coo)\b/.test(t)) {
    extra.push("digitalización de procesos");
  }
  if (/\b(ux|design|dise[ñn]o)\b/.test(t)) extra.push("UX");
  if (company) extra.push(String(company));

  return [...new Set([...extra, ...BUYER_PROFILE.keywords])].slice(0, 5);
}
