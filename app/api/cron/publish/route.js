import { prisma } from "@/app/lib/prisma";
import { triggerLinkedInNotification } from "@/app/(admin-zone)/admin/actions";
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
      include: { translations: true, linkedinVariants: true },
    });

    if (postsToProcess.length === 0) {
      return NextResponse.json({ message: "Nada que publicar por ahora." });
    }

    const results = [];

    for (const post of postsToProcess) {
      const esData =
        post.translations.find((t) => t.lang === "es") || post.translations[0];
      const enData = post.translations.find((t) => t.lang === "en");
      const hasVariants = post.linkedinVariants.length > 0;

      // Los AUTO nunca van por el webhook legacy: su LinkedIn son las tomas,
      // que escribe /api/cron/generate-linkedin a las 08:30 y publica
      // /api/cron/publish-linkedin a la hora de cada una. Este cron corre a las
      // 07:30, antes de que existan, así que sin esta condición cada artículo
      // se publicaría en LinkedIn como un resumen truncado del HTML.
      if (hasVariants || post.source === "AUTO") {
        await prisma.post.update({
          where: { id: post.id },
          data: { published_sent: true },
        });
        results.push(
          `Post ID ${post.id} ("${esData.title}"): publicado (${
            hasVariants
              ? "variantes LinkedIn a su cron"
              : "AUTO sin tomas todavía; las generará el cron de las 8:30"
          }).`,
        );
      } else {
        // Flujo legacy (MANUAL posts u otros sin variantes): disparamos el
        // webhook de LinkedIn directo desde aquí.
        const postData = {
          title_es: esData.title,
          slug_es: esData.slug,
          content_es: esData.content,
          tags_es: esData.tags.join(","),
          date: post.date.toISOString().split("T")[0],
          linkedin_post_es: esData.linkedinPost,
          linkedin_hashtags_es: esData.linkedinHashtags,
        };

        const notification = await triggerLinkedInNotification(
          postData,
          post.image,
        );

        if (notification.success) {
          await prisma.post.update({
            where: { id: post.id },
            data: { published_sent: true },
          });
          results.push(
            `Post ID ${post.id} ("${esData.title}"): LinkedIn legacy enviado.`,
          );
        } else {
          results.push(
            `Post ID ${post.id}: Error en notificación (${notification.error})`,
          );
          continue;
        }
      }

      // Notificar a Google Indexing API (para ambos flujos)
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
