// Exporta los posts publicados a seo/fixtures/posts-publicados.json. SOLO LECTURA.
//
// Una única SELECT con connection_limit=1: nada en paralelo, nada más. No baja
// el cuerpo de los posts, solo los enlaces internos que contiene (para saber a
// qué página de cluster enlaza y si algún enlace apunta a una redirección).
// Todo lo exportado es público: está en la web.
//
// Uso (desde my-app/): node --env-file=.env.local scripts/seo-exportar-fixture-posts.mjs

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("connection_limit", "1");
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

const ENLACE = String.raw`href="(?:https?://(?:www\.)?room714\.com)?(/[^"#?]*)`;

try {
  const filas = await prisma.$queryRawUnsafe(
    `SELECT t."postId", t.slug, t.lang AS locale, t.title, t."metaTitle", t."metaDescription",
            p.date AS "publishedAt", p.category::text AS category,
            ARRAY(SELECT DISTINCT m[1] FROM regexp_matches(t.content, $1, 'g') AS m ORDER BY 1) AS "internalHrefs"
       FROM "PostTranslation" t JOIN "Post" p ON p.id = t."postId"
      WHERE p.published = true AND p.date <= now()
      ORDER BY p.date DESC, t.lang`,
    ENLACE,
  );
  const salida = path.join(process.cwd(), "seo", "fixtures", "posts-publicados.json");
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  const datos = {
    exportedAt: new Date().toISOString(),
    query: "PostTranslation ⨝ Post WHERE published AND date <= now() (una SELECT, connection_limit=1)",
    posts: filas.map((f) => ({ ...f, publishedAt: new Date(f.publishedAt).toISOString() })),
  };
  fs.writeFileSync(salida, JSON.stringify(datos, null, 2) + "\n");
  console.log(`${filas.length} traducciones → ${path.relative(process.cwd(), salida)}`);
} finally {
  await prisma.$disconnect();
}
