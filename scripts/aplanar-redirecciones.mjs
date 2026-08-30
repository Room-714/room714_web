// Aplana las cadenas de redirección: si A → B y B → C, deja A → C.
//
// Aparecen solas al consolidar dos veces sobre el mismo tema. En junio varios
// artículos se redirigieron a uno que ahora, en agosto, se ha consolidado a su
// vez. Un salto de más no rompe nada, pero Google deja de seguir las cadenas a
// partir de unos pocos saltos y cada salto diluye la señal.
//
// Repara la tabla entera, no solo lo que tocó la consolidación de hoy: la
// condición «ninguna fila apunta a un origen» debe cumplirse siempre.
//
//   node --env-file=.env.local scripts/aplanar-redirecciones.mjs
//   node --env-file=.env.local scripts/aplanar-redirecciones.mjs --aplicar
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--aplicar");

// Un ciclo (A → B → A) colgaría el bucle. No debería existir, pero el coste de
// protegerse es una línea y el de no hacerlo es un script que no termina.
const MAX_SALTOS = 10;

const filas = await prisma.postRedirect.findMany();
const destinoDe = new Map(filas.map((r) => [`${r.fromSlug}|${r.lang}`, r.toSlug]));

function resolver(slug, lang) {
  const visitados = new Set([slug]);
  let actual = slug;
  for (let i = 0; i < MAX_SALTOS; i++) {
    const siguiente = destinoDe.get(`${actual}|${lang}`);
    if (!siguiente) return { destino: actual, saltos: i };
    if (visitados.has(siguiente)) return { destino: actual, saltos: i, ciclo: true };
    visitados.add(siguiente);
    actual = siguiente;
  }
  return { destino: actual, saltos: MAX_SALTOS, truncado: true };
}

const cambios = [];
for (const r of filas) {
  if (!r.toSlug) continue;
  const { destino, ciclo, truncado } = resolver(r.toSlug, r.lang);
  if (ciclo) console.error(`⚠️  ciclo detectado en ${r.fromSlug} [${r.lang}]`);
  if (truncado) console.error(`⚠️  cadena demasiado larga en ${r.fromSlug} [${r.lang}]`);
  if (destino !== r.toSlug) cambios.push({ ...r, nuevoDestino: destino });
}

console.log(APLICAR ? "=== APLANANDO ===" : "=== SIMULACIÓN (no escribe nada) ===");
for (const c of cambios) {
  console.log(`${c.fromSlug} → ${c.toSlug} → ${c.nuevoDestino}  [${c.lang}]`);
}
console.log(`\ncadenas a aplanar: ${cambios.length}`);

if (APLICAR) {
  for (const c of cambios) {
    await prisma.postRedirect.update({
      where: { fromSlug_lang: { fromSlug: c.fromSlug, lang: c.lang } },
      data: { toSlug: c.nuevoDestino },
    });
  }
  console.log(`filas actualizadas: ${cambios.length}`);
}

await prisma.$disconnect();
