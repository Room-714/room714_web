// Auditoría SEO de los posts publicados. SOLO LECTURA: no escribe nada.
//
// Por cada traducción lista:
//   - la longitud del <title> que sirve la web (metaTitle o, si no hay, el
//     título), con el sufijo " | Room 714", y lo marca si pasa de 60;
//   - su cluster (según seo/posts-clusters.data.json y seo/cierres.data.json)
//     y si el cuerpo enlaza a la página de ese cluster;
//   - si enlaza a algún caso.
//
// Uso (desde my-app/):
//   node --env-file=.env.local scripts/seo-auditar-posts.mjs
//   node --env-file=.env.local scripts/seo-auditar-posts.mjs --solo-problemas
//
// Termina con código 1 si hay algún title de más de 60 o algún post con
// cluster que no enlaza a su página, para poder usarlo como comprobación.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SOLO_PROBLEMAS = process.argv.includes("--solo-problemas");
const SUFIJO = " | Room 714";
const MAX_TITLE = 60;
const ENLACE_A_CASO = /href="\/(es|en)\/(casos|cases)\/([^"]+)"/;

const leer = (f) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "seo", f), "utf8"));
const largo = (s) => [...s].length;

// Página esperada de cada traducción, por slug.
const clusterDe = new Map();
for (const p of leer("posts-clusters.data.json").posts)
  for (const t of p.translations) clusterDe.set(t.slug, { cluster: p.cluster, href: leer("posts-clusters.data.json").clusters[p.cluster][t.lang] });
for (const t of leer("cierres.data.json").posts)
  if (t.cluster) clusterDe.set(t.slug, { cluster: "IA", href: t.cluster.href });

const posts = await prisma.post.findMany({
  where: { published: true, date: { lte: new Date() } },
  orderBy: { date: "desc" },
  select: { translations: { select: { lang: true, slug: true, title: true, metaTitle: true, content: true } } },
});

let titlesLargos = 0;
let sinEnlaceCluster = 0;
let conCaso = 0;
const filas = [];
for (const p of posts)
  for (const t of p.translations) {
    const title = (t.metaTitle || t.title) + SUFIJO;
    const n = largo(title);
    const c = clusterDe.get(t.slug);
    const enlazaCluster = c ? t.content.includes(`href="${c.href}"`) : null;
    const caso = t.content.match(ENLACE_A_CASO)?.[3] ?? null;
    const problema = n > MAX_TITLE || enlazaCluster === false;
    if (n > MAX_TITLE) titlesLargos++;
    if (enlazaCluster === false) sinEnlaceCluster++;
    if (caso) conCaso++;
    if (!SOLO_PROBLEMAS || problema)
      filas.push(
        `${problema ? "✗" : "✓"} ${t.lang} ${String(n).padStart(3)}${n > MAX_TITLE ? " >60" : "    "} ` +
          `cluster:${(c?.cluster ?? "—").padEnd(2)} ${enlazaCluster === null ? "  " : enlazaCluster ? "✓ " : "✗ "}` +
          `caso:${(caso ?? "—").padEnd(40)} ${t.slug}`,
      );
  }

console.log("   lang title  cluster  enlaza  caso                                          slug");
filas.forEach((f) => console.log(f));
const total = posts.reduce((a, p) => a + p.translations.length, 0);
console.log(
  `\n${total} traducciones · titles >${MAX_TITLE}: ${titlesLargos} · con cluster sin enlace a su página: ${sinEnlaceCluster} · con enlace a caso: ${conCaso}`,
);
await prisma.$disconnect();
process.exit(titlesLargos || sinEnlaceCluster ? 1 : 0);
