// Auditoría de metadatos de las páginas (no de los posts). SOLO LECTURA.
//
// Pide cada ruta de app/lib/routes.mjs y las categorías del blog, en serie,
// a un servidor LOCAL y saca de la HTML servida: status, <title>, meta
// description, H1, canonical, robots y hreflang. Escribe el resultado en
// seo/fixtures/rutas-metadatos.json para el informe.
//
// Nunca contra www.room714.com: el servidor se arranca con una base de datos
// inalcanzable para que ninguna página pueda leer de producción.
//
//   DATABASE_URL="postgresql://x:x@127.0.0.1:1/x" npx next dev -p 3714
//   node scripts/seo-auditar-rutas.mjs http://localhost:3714

import fs from "node:fs";
import path from "node:path";
import { TODAS, IDIOMAS, EN_SITEMAP, path as ruta } from "../app/lib/routes.mjs";
import { listAllCategoryRoutes } from "../app/lib/categoryRoutes.js";

const BASE = process.argv[2] || "http://localhost:3714";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error("Solo contra un servidor local.");
  process.exit(1);
}

// Una sola pasada: decodificar &amp; antes que el resto convertiría
// "&amp;lt;" en "<" (doble decodificación).
const ENTIDADES = { "&amp;": "&", "&quot;": '"', "&#x27;": "'", "&#39;": "'", "&lt;": "<", "&gt;": ">" };
const decode = (s) => s?.replace(/&(?:amp|quot|#x27|#39|lt|gt);/g, (e) => ENTIDADES[e]).trim() ?? null;

// Texto de un fragmento HTML: quita etiquetas hasta que no quede ninguna y
// después cualquier < o > suelto, para que no sobreviva un "<script" partido.
function textoDe(html) {
  let t = html.replace(/<br\s*\/?>/g, " ");
  for (let antes = null; antes !== t; ) [antes, t] = [t, t.replace(/<[^<>]*>/g, "")];
  return t.replace(/[<>]/g, "").replace(/\s+/g, " ");
}
const attr = (tag, name) => decode(tag.match(new RegExp(`${name}="([^"]*)"`))?.[1]);
const metaTags = (html) => html.match(/<(meta|link)\b[^>]*>/g) ?? [];

function extraer(html) {
  const tags = metaTags(html);
  const meta = (n) => {
    const t = tags.find((x) => x.startsWith("<meta") && attr(x, "name") === n);
    return t ? attr(t, "content") : null;
  };
  const canonical = tags.find((x) => x.startsWith("<link") && attr(x, "rel") === "canonical");
  const hreflang = Object.fromEntries(
    tags
      .filter((x) => x.startsWith("<link") && attr(x, "rel") === "alternate" && attr(x, "hrefLang"))
      .map((x) => [attr(x, "hrefLang"), attr(x, "href")]),
  );
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => decode(textoDe(m[1])));
  return {
    title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]),
    description: meta("description"),
    h1: h1s,
    canonical: canonical ? attr(canonical, "href") : null,
    robots: meta("robots"),
    hreflang,
  };
}

const rutas = [];
for (const [clave] of Object.entries(TODAS))
  for (const lang of IDIOMAS) rutas.push({ clave, lang, path: ruta(clave, lang), enSitemap: EN_SITEMAP.includes(clave) });
for (const r of listAllCategoryRoutes()) rutas.push({ clave: `categoria:${r.category}`, lang: r.lang, path: r.url, enSitemap: true });

const filas = [];
for (const r of rutas) {
  const res = await fetch(BASE + r.path, { redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  filas.push({ ...r, status: res.status, location: res.headers.get("location"), ...(html ? extraer(html) : {}) });
  console.log(res.status, r.path);
}

const salida = path.join(process.cwd(), "seo", "fixtures", "rutas-metadatos.json");
fs.mkdirSync(path.dirname(salida), { recursive: true });
fs.writeFileSync(salida, JSON.stringify({ generatedAt: new Date().toISOString(), rutas: filas }, null, 2) + "\n");
console.log(`${filas.length} rutas → ${path.relative(process.cwd(), salida)}`);
