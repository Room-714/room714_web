import { prisma } from "@/app/lib/prisma";
import { getMadridHour } from "@/app/lib/time/madrid";
import { notifyUrlUpdated, buildPostUrls } from "@/app/lib/seo/indexingApi";
// IndexNow desactivado: Vercel aplica i18n auto-redirect a paths en raíz,
// imposible servir keyLocation con scope global. Reactivar con import +
// llamada cuando se resuelva.
// import { notifyIndexNow } from "@/app/lib/seo/indexNow";
import { NextResponse } from "next/server";

// Mapeo: hora Madrid → source que se publica en ese tick
// 07:00 Madrid → posts auto-generados. El cron dispara a las 07:30 y
// getMadridHour() devuelve 7; los posts AUTO llevan date = 07:30, así que en
// ese tick ya cumplen date <= now.
// 17:00 Madrid → posts manuales (creados desde admin)
const SOURCE_BY_HOUR = {
  7: "AUTO",
  17: "MANUAL",
};

export async function GET(request) {
  // 1. Verificación de Seguridad para Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const madridHour = getMadridHour();
  const sourceFilter = SOURCE_BY_HOUR[madridHour];

  if (!sourceFilter) {
    return NextResponse.json({
      message: "Saltado: no es ninguna hora de publicación en Madrid",
      madridHour,
      validHours: Object.keys(SOURCE_BY_HOUR),
    });
  }

  try {
    const now = new Date();

    // 2. Buscamos posts del source correspondiente a esta hora
    const postsToProcess = await prisma.post.findMany({
      where: {
        published: true,
        published_sent: false,
        source: sourceFilter,
        date: { lte: now },
      },
      include: { translations: true },
    });

    if (postsToProcess.length === 0) {
      return NextResponse.json({ message: "Nada que publicar por ahora." });
    }

    // Este cron ya no publica nada en LinkedIn. Antes, los posts MANUAL sin
    // tomas salían por un webhook directo a Make; ahora LinkedIn exige
    // aprobación en el panel y lo envía /api/cron/publish-linkedin.
    // Una sola escritura para todos, en vez de una por post.
    await prisma.post.updateMany({
      where: { id: { in: postsToProcess.map((p) => p.id) } },
      data: { published_sent: true },
    });

    const results = [];

    for (const post of postsToProcess) {
      const esData =
        post.translations.find((t) => t.lang === "es") || post.translations[0];
      const enData = post.translations.find((t) => t.lang === "en");

      results.push(
        `Post ID ${post.id} ("${esData.title}"): publicado en la web (LinkedIn: ${post.linkedinEstado}).`,
      );

      // Notificar a Google Indexing API
      const urls = buildPostUrls(esData.slug, enData?.slug);
      for (const url of urls) {
        try {
          await notifyUrlUpdated(url);
          results.push(`  → Indexing API: ${url}`);
        } catch (err) {
          console.error(`Indexing API falló para ${url}:`, err.message);
          results.push(`  → Indexing API ERR (${url}): ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      message: "Cron ejecutado con éxito",
      processed: postsToProcess.length,
      results,
    });
  } catch (error) {
    console.error("❌ Error en el Cron:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
