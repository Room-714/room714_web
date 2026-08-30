// Vuelca las traducciones y el estado de publicación antes de consolidar. Los
// artículos se despublican, no se borran, así que esto es un cinturón sobre
// tirantes — pero cuesta un minuto y cubre el caso de un error en el mapa.
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const datos = {
  exportadoEn: new Date().toISOString(),
  posts: await prisma.post.findMany({ select: { id: true, published: true, date: true } }),
  translations: await prisma.postTranslation.findMany({
    select: { id: true, postId: true, lang: true, slug: true, content: true },
  }),
  redirects: await prisma.postRedirect.findMany(),
};

const destino = `backup-consolidacion-${datos.exportadoEn.slice(0, 10)}.json`;
writeFileSync(destino, JSON.stringify(datos));
console.log(
  `${destino}: ${datos.posts.length} posts, ${datos.translations.length} traducciones, ${datos.redirects.length} redirecciones`,
);

await prisma.$disconnect();
