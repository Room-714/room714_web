// Tabla de metadatos de los posts para docs/seo-audit-2026-10.md. NO toca la BD:
// lee seo/fixtures/posts-publicados.json y escribe Markdown por la salida
// estándar.
//
// Por cada traducción: <title> servido (metaTitle o título, más " | Room 714")
// y su longitud, meta description y su longitud, H1 (el título), canonical,
// robots, hreflang, cluster y los problemas: falta, duplicado, >60/>155,
// búsqueda reservada, y enlaces internos del cuerpo que redirigen o no existen.
//
// Uso (desde my-app/): node scripts/seo-informe-posts.mjs > /tmp/posts.md

import fs from "node:fs";
import path from "node:path";
import { clusterFromHrefs, reservedQueriesIn } from "../app/lib/seo/clusters.js";
import { blogUrl } from "../app/lib/seo/urls.js";
import { TODAS, IDIOMAS, RENOMBRADAS, guardasDeIdioma, path as ruta } from "../app/lib/routes.mjs";
import { listAllCategoryRoutes } from "../app/lib/categoryRoutes.js";

const SUFIJO = " | Room 714";
const largo = (s) => (s ? [...s].length : 0);
const { posts, exportedAt } = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "seo", "fixtures", "posts-publicados.json"), "utf8"),
);

// Rutas que responden 200 sin redirigir: páginas, categorías y posts publicados.
const buenas = new Set([
  ...Object.keys(TODAS).flatMap((c) => IDIOMAS.map((l) => ruta(c, l))),
  ...listAllCategoryRoutes().map((r) => r.url),
  ...IDIOMAS.map((l) => `/${l}/blog`),
  ...posts.map((p) => `/${p.locale}/blog/${p.slug}`),
]);
const redirigen = new Map([...RENOMBRADAS, ...guardasDeIdioma()].map(({ de, a }) => [de, a]));

const titleDe = (p) => (p.metaTitle || p.title) + SUFIJO;
const veces = (f) => posts.reduce((m, p) => m.set(f(p), (m.get(f(p)) || 0) + 1), new Map());
const titles = veces(titleDe);
const descs = veces((p) => p.metaDescription || null);
const porPost = Object.groupBy(posts, (p) => p.postId);

// Celda de tabla Markdown: primero la barra invertida, luego la barra vertical.
const celda = (s) => String(s ?? "—").replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
const filas = [];
const conProblemas = [];
const recuento = {};
const porCluster = {};
const enlacesRotos = [];
for (const p of posts) {
  const title = titleDe(p);
  const hermanos = Object.fromEntries((porPost[p.postId] || []).map((t) => [t.locale, t.slug]));
  const alt = ["es", "en"].filter((l) => hermanos[l]);
  const cluster = clusterFromHrefs(p.internalHrefs, p.locale) ?? "fuera-de-cluster";
  const problemas = [];
  if (largo(title) > 60) problemas.push("title >60");
  if (!p.metaDescription) problemas.push("sin description");
  else if (largo(p.metaDescription) > 155) problemas.push("description >155");
  if (titles.get(title) > 1) problemas.push("title duplicado");
  if (p.metaDescription && descs.get(p.metaDescription) > 1) problemas.push("description duplicada");
  const reservadas = reservedQueriesIn(`${p.title} ${p.metaTitle || ""}`, p.locale);
  if (reservadas.length) problemas.push(`búsqueda reservada: ${reservadas.join(", ")}`);
  if (alt.length < 2) problemas.push("sin traducción: hreflang de un idioma");
  for (const href of p.internalHrefs || []) {
    if (buenas.has(href) || href.startsWith("/api/") || /\.[a-z0-9]{2,4}$/i.test(href)) continue;
    enlacesRotos.push({ desde: `/${p.locale}/blog/${p.slug}`, href, destino: redirigen.get(href) ?? "404 o redirección de PostRedirect" });
  }
  const fila =
    `| ${p.locale} | ${celda(p.slug)} | ${celda(title)} | ${largo(title)} | ${celda(p.metaDescription)} | ${largo(p.metaDescription)} | ` +
    `${celda(p.title)} | ${blogUrl(p.locale, p.slug)} | index, follow | ${[...alt, "x-default"].join(", ")} | ${cluster} | ${problemas.join("; ") || "—"} |`;
  filas.push(fila);
  if (problemas.length) conProblemas.push(fila);
  problemas.forEach((x) => (recuento[x.replace(/:.*/, "")] = (recuento[x.replace(/:.*/, "")] || 0) + 1));
  porCluster[cluster] = (porCluster[cluster] || 0) + 1;
}

const CABECERA =
  "| Idioma | Slug | Title | Long. | Meta description | Long. | H1 | Canonical | Robots | hreflang | Cluster | Problemas |\n" +
  "|---|---|---|---|---|---|---|---|---|---|---|---|";
console.log(`Fixture exportado el ${exportedAt}: ${posts.length} traducciones.\n`);
console.log(`- Por cluster (traducciones): ${Object.entries(porCluster).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
console.log(`- Problemas: ${Object.entries(recuento).map(([k, v]) => `${k} ${v}`).join(" · ") || "ninguno"}\n`);
console.log(`### Traducciones con algún problema (${conProblemas.length})\n`);
console.log(CABECERA);
conProblemas.forEach((f) => console.log(f));
console.log(`\n### Todas las traducciones\n`);
console.log(CABECERA);
filas.forEach((f) => console.log(f));
console.log(`\n### Enlaces internos de los posts que no van a una URL final (${enlacesRotos.length})\n`);
console.log("| Post | Enlace | Destino final |");
console.log("|---|---|---|");
enlacesRotos.forEach((e) => console.log(`| ${e.desde} | ${e.href} | ${e.destino} |`));
