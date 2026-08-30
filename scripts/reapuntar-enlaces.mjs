// Reapunta los enlaces internos que quedaron señalando a artículos
// consolidados. Lee el mapa desde PostRedirect, así que no duplica la lista y
// no puede desincronizarse del paso anterior.
//
// Sin argumentos simula; con --aplicar escribe.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--aplicar");

// Solo las de esta consolidación: las 59 anteriores ya se aplicaron en su
// momento y sus enlaces ya se reapuntaron o se dejaron a propósito.
const DESDE = new Date("2026-08-30T00:00:00Z");

const redirs = await prisma.postRedirect.findMany({
  where: { reason: "consolidation", createdAt: { gte: DESDE }, toSlug: { not: null } },
});
console.log(`redirecciones a aplicar sobre el contenido: ${redirs.length}`);

const traducciones = await prisma.postTranslation.findMany({
  select: { id: true, lang: true, slug: true, content: true },
});

let tocados = 0;
let enlaces = 0;

for (const t of traducciones) {
  let nuevo = t.content;
  for (const r of redirs) {
    if (r.lang !== t.lang) continue;
    // Se ancla a la comilla final para no cazar un slug que sea prefijo de otro.
    const patron = `/${r.lang}/blog/${r.fromSlug}"`;
    if (!nuevo.includes(patron)) continue;
    const cuantos = nuevo.split(patron).length - 1;
    nuevo = nuevo.split(patron).join(`/${r.lang}/blog/${r.toSlug}"`);
    enlaces += cuantos;
  }
  if (nuevo === t.content) continue;
  tocados++;
  console.log(`  ${t.lang} ${t.slug}`);
  if (APLICAR) {
    await prisma.postTranslation.update({ where: { id: t.id }, data: { content: nuevo } });
  }
}

console.log(`\ntraducciones con enlaces reapuntados: ${tocados}`);
console.log(`enlaces reapuntados: ${enlaces}`);
console.log(APLICAR ? "aplicado" : "simulación: nada escrito");

await prisma.$disconnect();
