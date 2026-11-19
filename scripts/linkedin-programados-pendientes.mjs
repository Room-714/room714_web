// Deja como «Pendiente de aprobar para LinkedIn» los posts ya programados
// (publicados con fecha futura) que siguen en SOLO_WEB tras añadir la columna
// linkedinEstado. Antes del cambio, esos posts habrían salido solos a LinkedIn;
// así aparecen en el panel para decidir uno a uno.
//
// Simulación por defecto. Para escribir:
//   node --env-file=.env.local scripts/linkedin-programados-pendientes.mjs --apply
//
// Ojo: .env.local apunta a PRODUCCIÓN. Una lectura y, con --apply, una única
// escritura (updateMany), con una sola conexión.
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");

const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("connection_limit", "1");
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

const where = {
  published: true,
  date: { gt: new Date() },
  linkedinEstado: "SOLO_WEB",
};

try {
  const posts = await prisma.post.findMany({
    where,
    select: {
      id: true,
      date: true,
      source: true,
      translations: { where: { lang: "es" }, select: { title: true } },
    },
    orderBy: { date: "asc" },
  });

  console.log(`${posts.length} post(s) programado(s) en SOLO_WEB:`);
  for (const p of posts) {
    console.log(
      `  #${p.id} ${p.date.toISOString()} ${p.source} «${p.translations[0]?.title ?? "sin título"}»`,
    );
  }

  if (!apply) {
    console.log("\nSimulación: no se ha escrito nada. Repite con --apply para marcarlos.");
  } else if (posts.length > 0) {
    const { count } = await prisma.post.updateMany({
      where: { ...where, id: { in: posts.map((p) => p.id) } },
      data: { linkedinEstado: "PENDIENTE" },
    });
    console.log(`\nMarcados como PENDIENTE: ${count}`);
  }
} finally {
  await prisma.$disconnect();
}
