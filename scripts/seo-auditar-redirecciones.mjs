// Cruza la tabla PostRedirect con los posts publicados. SOLO LECTURA.
//
// Una SELECT con connection_limit=1 (fromSlug, toSlug, lang) y el resto contra
// seo/fixtures/posts-publicados.json. Señala:
//   - origen publicado: el slug está en el sitemap pero su página redirige;
//   - destino no publicado: la redirección acaba en un 404;
//   - cadena: el destino es a su vez origen de otra redirección.
//
// Uso (desde my-app/): node --env-file=.env.local scripts/seo-auditar-redirecciones.mjs
// Sale con 1 si encuentra algún problema.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("connection_limit", "1");
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

const { posts, exportedAt } = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "seo", "fixtures", "posts-publicados.json"), "utf8"),
);
const publicado = new Set(posts.map((p) => `${p.locale}/${p.slug}`));

try {
  const redirecciones = await prisma.postRedirect.findMany({ select: { fromSlug: true, toSlug: true, lang: true } });
  const origenes = new Set(redirecciones.map((r) => `${r.lang}/${r.fromSlug}`));
  const problemas = [];
  for (const r of redirecciones) {
    const de = `${r.lang}/${r.fromSlug}`;
    const a = r.toSlug ? `${r.lang}/${r.toSlug}` : null;
    if (publicado.has(de)) problemas.push(`origen publicado     /${de} → ${a ? `/${a}` : "404"}`);
    if (a && !publicado.has(a)) problemas.push(`destino no publicado /${de} → /${a}`);
    if (a && origenes.has(a)) problemas.push(`cadena               /${de} → /${a} → …`);
  }
  console.log(`${redirecciones.length} redirecciones · posts publicados del fixture del ${exportedAt}`);
  problemas.forEach((p) => console.log("✗", p));
  console.log(problemas.length ? `\n${problemas.length} problemas` : "\nSin problemas.");
  process.exitCode = problemas.length ? 1 : 0;
} finally {
  await prisma.$disconnect();
}
