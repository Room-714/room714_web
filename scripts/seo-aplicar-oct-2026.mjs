// Aplica las propuestas aprobadas de docs/seo-audit-2026-10.md (tareas 4 y 5)
// al cuerpo de los posts. Los datos están en seo/oct-2026.data.json.
//
//   1. Párrafo puente: un <p> nuevo antes del último párrafo (el cierre),
//      SOLO si el post no enlaza ya a Cómo trabajamos.
//   2. Enlaces: cambia el href viejo por el destino final, SOLO si el destino
//      es un post publicado.
//   3. Enlaces anidados: quita el <a> exterior que envuelve a otro enlace y
//      deja el interior.
// No toca title (el H1), slug, metaTitle, metaDescription ni el resto del cuerpo.
// Idempotente: una segunda pasada no cambia nada.
//
// Una conexión (connection_limit=1) y dos consultas: una lectura de las
// traducciones afectadas y, con --apply, una transacción con las escrituras.
//
// Uso (desde my-app/):
//   node --env-file=.env.local scripts/seo-aplicar-oct-2026.mjs           (simula, no escribe)
//   node --env-file=.env.local scripts/seo-aplicar-oct-2026.mjs --apply   (escribe)
//
// Con --apply guarda antes el cuerpo actual en scripts/backups/. Para deshacerlo:
//   node --env-file=.env.local scripts/seo-aplicar-oct-2026.mjs --revertir=scripts/backups/<fichero>.json --apply
//
// Ojo: .env.local apunta a la BD de PRODUCCIÓN.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("connection_limit", "1");
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

const APLICAR = process.argv.includes("--apply");
const REVERTIR = process.argv.find((a) => a.startsWith("--revertir="))?.split("=")[1];
const DATOS = JSON.parse(fs.readFileSync(path.join(process.cwd(), "seo", "oct-2026.data.json"), "utf8"));
const BACKUPS = path.join(process.cwd(), "scripts", "backups");
const COMO_TRABAJAMOS = { es: "/es/como-trabajamos", en: "/en/how-we-work" };
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function revertir(fichero) {
  const copia = JSON.parse(fs.readFileSync(fichero, "utf8"));
  console.log(`Revertir ${copia.filas.length} traducciones desde ${fichero}${APLICAR ? "" : " (simulación)"}`);
  if (!APLICAR) return;
  await prisma.$transaction(
    copia.filas.map((f) => prisma.postTranslation.update({ where: { slug: f.slug }, data: { content: f.content } })),
  );
  console.log("Revertido.");
}

async function aplicar() {
  const afectados = [...new Set([...DATOS.puentes, ...DATOS.enlaces, ...DATOS.anidados].map((t) => t.slug))];
  const destinos = DATOS.enlaces.map((e) => e.a.split("/").pop());

  // Por slug y no por id: guardar un post desde el admin recrea sus
  // traducciones. Una sola lectura para los posts a editar y los destinos.
  const filas = await prisma.postTranslation.findMany({
    where: { slug: { in: [...afectados, ...destinos] } },
    select: { slug: true, lang: true, content: true, post: { select: { published: true, date: true } } },
  });
  const porSlug = new Map(filas.map((f) => [f.slug, f]));
  const publicado = (lang, slug) => {
    const f = porSlug.get(slug);
    return Boolean(f && f.lang === lang && f.post.published && f.post.date <= new Date());
  };

  const contenido = new Map();
  const avisos = [];
  const hechos = [];
  const actual = (t) => contenido.get(t.slug) ?? porSlug.get(t.slug)?.content;

  for (const t of DATOS.puentes) {
    const html = actual(t);
    if (!html || porSlug.get(t.slug).lang !== t.lang) { avisos.push(`${t.lang} ${t.slug}: no se encuentra; sin puente`); continue; }
    if (html.includes(`href="${COMO_TRABAJAMOS[t.lang]}"`)) continue;
    const parrafos = [...html.matchAll(/<p>/g)];
    const cierre = parrafos[parrafos.length - 1];
    if (!cierre) { avisos.push(`${t.lang} ${t.slug}: sin párrafos; sin puente`); continue; }
    contenido.set(t.slug, html.slice(0, cierre.index) + `<p>${t.html}</p>` + html.slice(cierre.index));
    hechos.push(`puente   ${t.lang} ${t.slug}`);
  }

  for (const e of DATOS.enlaces) {
    const html = actual(e);
    if (!html) { avisos.push(`${e.lang} ${e.slug}: no se encuentra; enlace sin tocar`); continue; }
    if (!html.includes(`href="${e.de}"`)) continue;
    if (!publicado(e.lang, e.a.split("/").pop())) { avisos.push(`${e.lang} ${e.slug}: el destino ${e.a} no está publicado; enlace sin tocar`); continue; }
    contenido.set(e.slug, html.replaceAll(`href="${e.de}"`, `href="${e.a}"`));
    hechos.push(`enlace   ${e.lang} ${e.slug}: ${e.de} → ${e.a}`);
  }

  for (const n of DATOS.anidados) {
    const html = actual(n);
    if (!html) { avisos.push(`${n.lang} ${n.slug}: no se encuentra; anidado sin tocar`); continue; }
    const re = new RegExp(`<a href="${escapeRe(n.exterior)}"[^>]*>\\s*(<a\\b[^>]*>[\\s\\S]*?<\\/a>)\\s*<\\/a>`, "g");
    if (!re.test(html)) continue;
    contenido.set(n.slug, html.replace(re, "$1"));
    hechos.push(`anidado  ${n.lang} ${n.slug}: quitado el <a> a ${n.exterior}`);
  }

  hechos.forEach((h) => console.log("✓", h));
  avisos.forEach((a) => console.log("⚠", a));
  console.log(`\n${contenido.size} traducciones a cambiar · ${hechos.length} cambios · ${avisos.length} avisos${APLICAR ? "" : " (simulación: no se escribe nada)"}`);
  if (!APLICAR || contenido.size === 0) return;

  fs.mkdirSync(BACKUPS, { recursive: true });
  const copia = path.join(BACKUPS, `seo-oct-2026-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(copia, JSON.stringify({ filas: [...contenido.keys()].map((slug) => ({ slug, content: porSlug.get(slug).content })) }, null, 2));
  console.log(`Copia: ${path.relative(process.cwd(), copia)}`);
  await prisma.$transaction(
    [...contenido].map(([slug, content]) => prisma.postTranslation.update({ where: { slug }, data: { content } })),
  );
  console.log("Aplicado.");
}

try {
  if (REVERTIR) await revertir(REVERTIR);
  else await aplicar();
} finally {
  await prisma.$disconnect();
}
