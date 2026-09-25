// Aplica la propuesta aprobada de seo/cierres.md a los posts.
//
// Por cada traducción de seo/cierres.data.json:
//   1. metaTitle y metaDescription: los fija si no coinciden con la propuesta.
//   2. Enlace al caso (si lo tiene): añade la frase al final del párrafo
//      indicado, SOLO si el post no enlaza ya a un caso y ese párrafo sigue
//      igual que en la propuesta.
//   3. Enlace al cluster (si lo tiene): añade la frase al final del último
//      párrafo, SOLO si el post no enlaza ya a esa página y el párrafo sigue
//      igual que en la propuesta.
// Si un párrafo ha cambiado, no toca ese enlace y avisa: la frase se revisó
// leída junto a ese párrafo concreto. No toca title (el H1), slug ni el resto
// del cuerpo.
//
// Idempotente: una segunda pasada no cambia nada.
//
// Uso (desde my-app/):
//   node --env-file=.env.local scripts/seo-aplicar-cierres.mjs           (simula, no escribe)
//   node --env-file=.env.local scripts/seo-aplicar-cierres.mjs --apply   (escribe)
//
// Con --apply guarda antes una copia de los valores que va a cambiar en
// scripts/backups/. Para deshacerlo:
//   node --env-file=.env.local scripts/seo-aplicar-cierres.mjs --revertir=scripts/backups/<fichero>.json --apply
//
// Ojo: .env.local apunta a la BD de PRODUCCIÓN.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--apply");
const REVERTIR = process.argv.find((a) => a.startsWith("--revertir="))?.split("=")[1];
const DATOS = path.join(process.cwd(), "seo", "cierres.data.json");
const BACKUPS = path.join(process.cwd(), "scripts", "backups");
const ENLACE_A_CASO = /href="\/(es|en)\/(casos|cases)\//;

const textoPlano = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Los <p>…</p> del cuerpo, con su posición. */
function parrafos(html) {
  return [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => ({
    inicio: m.index,
    fin: m.index + m[0].length,
    interior: m[1],
  }));
}

/** Añade la frase al final del párrafo `p` (antes de su </p>). */
function anadirAlParrafo(html, p, frase) {
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
        where: { slug: f.slug },
        data: { metaTitle: f.metaTitle, metaDescription: f.metaDescription, content: f.content },
      }),
    ),
  );
  console.log("Revertido.");
}

async function aplicar() {
  const { posts: propuestas } = JSON.parse(fs.readFileSync(DATOS, "utf8"));

  // Por slug y no por id: guardar un post desde el admin borra y recrea sus
  // traducciones, así que el id cambia. El slug de un post publicado está
  // congelado y es único.
  const actuales = await prisma.postTranslation.findMany({
    where: { slug: { in: propuestas.map((t) => t.slug) } },
    select: { id: true, slug: true, lang: true, metaTitle: true, metaDescription: true, content: true },
  });
  const porSlug = new Map(actuales.map((a) => [a.slug, a]));

  const cambios = [];
  const avisos = [];
  const cuenta = { metaTitle: 0, metaDescription: 0, enlaceCaso: 0, enlaceCluster: 0, sinCambios: 0 };

  for (const t of propuestas) {
    const etiqueta = `#${t.n} ${t.lang} ${t.slug}`;
    const a = porSlug.get(t.slug);
    if (!a || a.lang !== t.lang) {
      avisos.push(`${etiqueta}: no se encuentra la traducción; se salta entera`);
      continue;
    }
    const data = {};
    if (t.metaTitle !== undefined && a.metaTitle !== t.metaTitle) data.metaTitle = t.metaTitle;
    if (t.metaDescription !== undefined && a.metaDescription !== t.metaDescription) data.metaDescription = t.metaDescription;

    let contenido = a.content;
    const hechos = [];

    // Primero el caso (por posición) y después el cluster (el último párrafo):
    // añadir texto dentro de un párrafo no cambia cuántos hay.
    if (t.case && !ENLACE_A_CASO.test(contenido)) {
      const p = parrafos(contenido)[t.case.paragraph];
      if (!p || textoPlano(p.interior) !== t.case.paragraphText)
        avisos.push(`${etiqueta}: el párrafo del caso cambió desde la propuesta; no se añade (revisar a mano)`);
      else {
        contenido = anadirAlParrafo(contenido, p, t.case.sentenceHtml);
        hechos.push("enlaceCaso");
      }
    }
    if (t.cluster && !contenido.includes(`href="${t.cluster.href}"`)) {
      const ps = parrafos(contenido);
      const p = ps[ps.length - 1];
      if (!p || textoPlano(p.interior) !== t.cluster.paragraphText)
        avisos.push(`${etiqueta}: el último párrafo cambió desde la propuesta; no se añade el enlace al cluster (revisar a mano)`);
      else {
        contenido = anadirAlParrafo(contenido, p, t.cluster.sentenceHtml);
        hechos.push("enlaceCluster");
      }
    }
    if (contenido !== a.content) data.content = contenido;

    if (Object.keys(data).length === 0) {
      cuenta.sinCambios++;
      continue;
    }
    if (data.metaTitle !== undefined) cuenta.metaTitle++;
    if (data.metaDescription !== undefined) cuenta.metaDescription++;
    for (const h of hechos) cuenta[h]++;
    cambios.push({ a, data });
    console.log(`${etiqueta}: ${[...Object.keys(data).filter((k) => k !== "content"), ...hechos].join(", ")}`);
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
  const copia = path.join(BACKUPS, `seo-cierres-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
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
    cambios.map(({ a, data }) => prisma.postTranslation.update({ where: { id: a.id }, data })),
  );
  console.log(`Escritas ${cambios.length} traducciones.`);
}

try {
  if (REVERTIR) await revertir(REVERTIR);
  else await aplicar();
} finally {
  await prisma.$disconnect();
}
