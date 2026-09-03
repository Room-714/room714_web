// Devuelve la vida al artículo del modelo canónico.
//
// La consolidación del 2026-08-30 lo despublicó y mandó sus dos URLs a "RAG
// no es Magia", que resulta que NO menciona el modelo canónico ni una vez:
// quien buscaba el tema aterrizaba en un artículo que no lo trata. Y el
// modelo canónico es ahora una pieza central del posicionamiento (aparece
// en dos de los tres casos y da nombre a media página de IA).
//
// Qué hace:
//   1. Publica el post (published: true).
//   2. Marca published_sent: true. IMPRESCINDIBLE: sin esto, el cron de
//      /api/cron/publish lo ve como recién publicado y dispara el webhook
//      de LinkedIn, anunciando en abierto un artículo de abril.
//   3. Borra las dos filas de PostRedirect que lo enterraban.
//
// Uso:
//   node --env-file=.env.local scripts/republicar-modelo-canonico.mjs           (simula)
//   node --env-file=.env.local scripts/republicar-modelo-canonico.mjs --apply   (escribe)
//
// Para deshacerlo:
//   node --env-file=.env.local scripts/republicar-modelo-canonico.mjs --revertir --apply

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--apply");
const REVERTIR = process.argv.includes("--revertir");

const SLUG_ES = "el-modelo-canonico-que-no-alucine-tu-ia";
const SLUG_EN = "the-canonical-model-stop-hallucinating";
const DESTINO_ES = "rag-no-es-magia-como-elegir-arquitectura-de-recuperacion";
const DESTINO_EN = "rag-is-not-magic-how-to-choose-retrieval-architecture";

async function estado(etiqueta) {
  const t = await prisma.postTranslation.findUnique({
    where: { slug: SLUG_ES },
    select: {
      postId: true,
      post: {
        select: {
          published: true,
          published_sent: true,
          source: true,
          date: true,
          _count: { select: { linkedinVariants: true } },
        },
      },
    },
  });
  const redirecciones = await prisma.postRedirect.findMany({
    where: { fromSlug: { in: [SLUG_ES, SLUG_EN] } },
    select: { id: true, lang: true, fromSlug: true, toSlug: true },
  });

  console.log(`\n── ${etiqueta}`);
  if (!t) {
    console.log("   el artículo no existe");
    return null;
  }
  console.log(
    `   post #${t.postId}  published=${t.post.published}  published_sent=${t.post.published_sent}  source=${t.post.source}  tomasLinkedIn=${t.post._count.linkedinVariants}`,
  );
  console.log(
    `   redirecciones: ${redirecciones.length ? redirecciones.map((r) => `#${r.id} ${r.lang}→${r.toSlug}`).join(" | ") : "ninguna"}`,
  );
  return { postId: t.postId, redirecciones };
}

async function main() {
  const antes = await estado("ANTES");
  if (!antes) return;

  if (!APLICAR) {
    console.log(
      REVERTIR
        ? "\n(simulación) Volvería a despublicar el post y recrearía las dos redirecciones."
        : "\n(simulación) Publicaría el post con published_sent=true y borraría las redirecciones.",
    );
    console.log("Añade --apply para escribir de verdad.");
    return;
  }

  if (REVERTIR) {
    await prisma.post.update({
      where: { id: antes.postId },
      data: { published: false },
    });
    for (const [fromSlug, toSlug, lang] of [
      [SLUG_ES, DESTINO_ES, "es"],
      [SLUG_EN, DESTINO_EN, "en"],
    ]) {
      await prisma.postRedirect.upsert({
        where: { fromSlug_lang: { fromSlug, lang } },
        create: { fromSlug, toSlug, lang, reason: "consolidation" },
        update: { toSlug, reason: "consolidation" },
      });
    }
  } else {
    await prisma.post.update({
      where: { id: antes.postId },
      // published_sent a true a la vez que published: si no, el cron de
      // publicación lo anuncia en LinkedIn como si fuera de hoy.
      data: { published: true, published_sent: true },
    });
    await prisma.postRedirect.deleteMany({
      where: { fromSlug: { in: [SLUG_ES, SLUG_EN] } },
    });
  }

  await estado("DESPUÉS");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
