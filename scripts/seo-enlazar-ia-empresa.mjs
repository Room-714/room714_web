// Fase 4 de la landing «Incorporar la IA en tu empresa»: añade a 4 posts del
// blog (en castellano) una frase con enlace a la landing, según
// seo/enlaces-ia-empresa.data.json.
//
// Por cada post: añade la frase al final del párrafo indicado, SOLO si el post
// no enlaza ya a la landing y ese párrafo sigue empezando igual que cuando se
// redactó la frase. Si no, no lo toca y avisa. No toca title, slug, metas ni
// el resto del cuerpo. Idempotente.
//
// Ejecutar DESPUÉS de desplegar la landing (si no, el enlace daría 404).
//
// Uso (desde my-app/):
//   node --env-file=.env.local scripts/seo-enlazar-ia-empresa.mjs           (simula, no escribe)
//   node --env-file=.env.local scripts/seo-enlazar-ia-empresa.mjs --apply   (escribe)
//
// Con --apply guarda antes una copia del contenido en scripts/backups/. Para
// deshacerlo:
//   node --env-file=.env.local scripts/seo-enlazar-ia-empresa.mjs --revertir=scripts/backups/<fichero>.json --apply
//
// Ojo: .env.local apunta a la BD de PRODUCCIÓN.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--apply");
const REVERTIR = process.argv.find((a) => a.startsWith("--revertir="))?.split("=")[1];
const DATOS = path.join(process.cwd(), "seo", "enlaces-ia-empresa.data.json");
const BACKUPS = path.join(process.cwd(), "scripts", "backups");

/** Texto sin etiquetas, solo para comparar el inicio de un párrafo. Repite la
 *  limpieza hasta que no cambia, para que no quede ninguna etiqueta a medias. */
function textoPlano(html) {
  let previo;
  let texto = html;
  do {
    previo = texto;
    texto = texto.replace(/<[^>]*>/g, "");
  } while (texto !== previo);
  return texto.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

/** Los <p>…</p> del cuerpo, con su posición. */
function parrafos(html) {
  return [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => ({
    inicio: m.index,
    fin: m.index + m[0].length,
    interior: m[1],
  }));
}

async function revertir(fichero) {
  const copia = JSON.parse(fs.readFileSync(fichero, "utf8"));
  console.log(`Revertir ${copia.filas.length} traducciones desde ${fichero}${APLICAR ? "" : " (simulación)"}`);
  if (!APLICAR) return;
  await prisma.$transaction(
    copia.filas.map((f) =>
      prisma.postTranslation.update({ where: { slug: f.slug }, data: { content: f.content } }),
    ),
  );
  console.log("Revertido.");
}

async function aplicar() {
  const { href, posts } = JSON.parse(fs.readFileSync(DATOS, "utf8"));
  // Por slug y no por id: guardar un post desde el admin recrea sus
  // traducciones y el id cambia; el slug de un post publicado es fijo.
  const actuales = await prisma.postTranslation.findMany({
    where: { slug: { in: posts.map((p) => p.slug) }, lang: "es" },
    select: { id: true, slug: true, content: true },
  });
  const porSlug = new Map(actuales.map((a) => [a.slug, a]));

  const cambios = [];
  for (const p of posts) {
    const a = porSlug.get(p.slug);
    if (!a) {
      console.log(`AVISO ${p.slug}: no se encuentra; se salta`);
      continue;
    }
    if (a.content.includes(`href="${href}"`)) {
      console.log(`${p.slug}: ya enlaza a la landing; sin cambios`);
      continue;
    }
    const par = parrafos(a.content)[p.parrafo];
    if (!par || !textoPlano(par.interior).startsWith(p.inicio)) {
      console.log(`AVISO ${p.slug}: el párrafo ${p.parrafo} ha cambiado; no se añade (revisar a mano)`);
      continue;
    }
    const nuevo = `<p>${par.interior.replace(/\s+$/, "")} ${p.fraseHtml}</p>`;
    const contenido = a.content.slice(0, par.inicio) + nuevo + a.content.slice(par.fin);
    cambios.push({ a, contenido });
    console.log(`${p.slug}: añade el enlace al párrafo ${p.parrafo}`);
  }

  if (!APLICAR) {
    console.log(`\nSimulación: ${cambios.length} cambios. Relanza con --apply para escribir.`);
    return;
  }
  if (cambios.length === 0) {
    console.log("\nNada que escribir.");
    return;
  }
  fs.mkdirSync(BACKUPS, { recursive: true });
  const copia = path.join(BACKUPS, `seo-enlaces-ia-empresa-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(
    copia,
    JSON.stringify(
      { creado: new Date().toISOString(), filas: cambios.map(({ a }) => ({ slug: a.slug, content: a.content })) },
      null,
      1,
    ),
  );
  console.log(`\nCopia de seguridad: ${copia}`);
  await prisma.$transaction(
    cambios.map(({ a, contenido }) =>
      prisma.postTranslation.update({ where: { id: a.id }, data: { content: contenido } }),
    ),
  );
  console.log(`Escritas ${cambios.length} traducciones.`);
}

try {
  if (REVERTIR) await revertir(REVERTIR);
  else await aplicar();
} finally {
  await prisma.$disconnect();
}
