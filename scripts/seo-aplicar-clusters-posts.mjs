// Aplica la propuesta aprobada de seo/posts-clusters.md a los posts.
//
// Por cada traducción de seo/posts-clusters.data.json:
//   1. metaTitle y metaDescription: los fija si no coinciden con la propuesta.
//   2. Cuerpo: añade la frase con el enlace a la página del cluster al final
//      del último párrafo, SOLO si el cuerpo no enlaza ya a esa página.
//      Si el último párrafo ha cambiado desde la propuesta (por ejemplo,
//      porque el backlinker ha editado el post), NO toca el cuerpo y avisa:
//      la frase se revisó leída junto a ese párrafo concreto.
// No toca title (el H1), slug ni el resto del cuerpo.
//
// Idempotente: una segunda pasada no cambia nada.
//
// Uso (desde my-app/):
//   node --env-file=.env.local scripts/seo-aplicar-clusters-posts.mjs           (simula, no escribe)
//   node --env-file=.env.local scripts/seo-aplicar-clusters-posts.mjs --apply   (escribe)
//
// Con --apply guarda antes una copia de los valores que va a cambiar en
// scripts/backups/. Para deshacerlo:
//   node --env-file=.env.local scripts/seo-aplicar-clusters-posts.mjs --revertir=scripts/backups/<fichero>.json --apply
//
// Ojo: .env.local apunta a la BD de PRODUCCIÓN.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--apply");
const REVERTIR = process.argv.find((a) => a.startsWith("--revertir="))?.split("=")[1];
const DATOS = path.join(process.cwd(), "seo", "posts-clusters.data.json");
const BACKUPS = path.join(process.cwd(), "scripts", "backups");

const textoPlano = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** El último <p>…</p> del cuerpo, con su posición. */
function ultimoParrafo(html) {
  const todos = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)];
  const m = todos[todos.length - 1];
  if (!m) return null;
  return { inicio: m.index, fin: m.index + m[0].length, interior: m[1] };
}

/** Inserta la frase al final del último párrafo (antes de su </p>). */
function insertarFrase(html, frase) {
  const p = ultimoParrafo(html);
  if (!p) return null;
  const nuevo = `<p>${p.interior.replace(/\s+$/, "")} ${frase}</p>`;
  return html.slice(0, p.inicio) + nuevo + html.slice(p.fin);
}

async function revertir(fichero) {
  const copia = JSON.parse(fs.readFileSync(fichero, "utf8"));
  console.log(`Revertir ${copia.filas.length} traducciones desde ${fichero}${APLICAR ? "" : " (simulación)"}`);
  if (!APLICAR) return;
  await prisma.$transaction(
    copia.filas.map((f) =>
      prisma.postTranslation.update({
        where: { id: f.translationId },
        data: { metaTitle: f.metaTitle, metaDescription: f.metaDescription, content: f.content },
      }),
    ),
  );
  console.log("Revertido.");
}

async function aplicar() {
  const { clusters, posts } = JSON.parse(fs.readFileSync(DATOS, "utf8"));
  const propuestas = posts.flatMap((p) => p.translations.map((t) => ({ ...t, n: p.n, cluster: p.cluster })));

  const actuales = await prisma.postTranslation.findMany({
    where: { id: { in: propuestas.map((t) => t.translationId) } },
    select: { id: true, slug: true, lang: true, metaTitle: true, metaDescription: true, content: true },
  });
  const porId = new Map(actuales.map((a) => [a.id, a]));

  const cambios = [];
  const avisos = [];
  const cuenta = { metaTitle: 0, metaDescription: 0, enlace: 0, sinCambios: 0 };

  for (const t of propuestas) {
    const etiqueta = `#${t.n} ${t.lang} ${t.slug}`;
    const a = porId.get(t.translationId);
    // Salvaguarda: el id tiene que seguir siendo la misma traducción.
    if (!a || a.slug !== t.slug || a.lang !== t.lang) {
      avisos.push(`${etiqueta}: la traducción ya no coincide (id ${t.translationId}); se salta entera`);
      continue;
    }
    const data = {};
    if (a.metaTitle !== t.metaTitle) data.metaTitle = t.metaTitle;
    if (a.metaDescription !== t.metaDescription) data.metaDescription = t.metaDescription;

    const href = clusters[t.cluster][t.lang];
    if (!a.content.includes(`href="${href}"`)) {
      const p = ultimoParrafo(a.content);
      if (!p) avisos.push(`${etiqueta}: el cuerpo no tiene párrafos; no se añade el enlace`);
      else if (textoPlano(p.interior) !== t.lastParagraphText)
        avisos.push(`${etiqueta}: el último párrafo cambió desde la propuesta; no se añade el enlace (revisar a mano)`);
      else data.content = insertarFrase(a.content, t.sentenceHtml);
    }

    if (Object.keys(data).length === 0) {
      cuenta.sinCambios++;
      continue;
    }
    if (data.metaTitle !== undefined) cuenta.metaTitle++;
    if (data.metaDescription !== undefined) cuenta.metaDescription++;
    if (data.content !== undefined) cuenta.enlace++;
    cambios.push({ t, a, data });
    console.log(
      `${etiqueta}: ${Object.keys(data)
        .map((k) => (k === "content" ? "enlace" : k))
        .join(", ")}`,
    );
  }

  console.log(`\nTraducciones: ${propuestas.length}`, cuenta);
  avisos.forEach((m) => console.log("AVISO", m));

  if (!APLICAR) {
    console.log("\nSimulación: no se ha escrito nada. Relanza con --apply para escribir.");
    return;
  }
  if (cambios.length === 0) {
    console.log("\nNada que escribir.");
    return;
  }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const copia = path.join(BACKUPS, `seo-clusters-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(
    copia,
    JSON.stringify(
      {
        creado: new Date().toISOString(),
        filas: cambios.map(({ a }) => ({
          translationId: a.id,
          slug: a.slug,
          metaTitle: a.metaTitle,
          metaDescription: a.metaDescription,
          content: a.content,
        })),
      },
      null,
      1,
    ),
  );
  console.log(`\nCopia de seguridad: ${copia}`);

  await prisma.$transaction(
    cambios.map(({ t, data }) => prisma.postTranslation.update({ where: { id: t.translationId }, data })),
  );
  console.log(`Escritas ${cambios.length} traducciones.`);
}

try {
  if (REVERTIR) await revertir(REVERTIR);
  else await aplicar();
} finally {
  await prisma.$disconnect();
}
