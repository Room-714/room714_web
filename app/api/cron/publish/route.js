import { prisma } from "@/app/lib/prisma";
import { triggerLinkedInNotification } from "@/app/(admin-zone)/admin/actions";
import { getMadridHour } from "@/app/lib/time/madrid";
import { NextResponse } from "next/server";

// Mapeo: hora Madrid → source que se publica en ese tick
// 10:00 Madrid → posts auto-generados (cron de generación los crea con date=10:00)
// 17:00 Madrid → posts manuales (creados desde admin)
const SOURCE_BY_HOUR = {
  10: "AUTO",
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

    const results = [];

    for (const post of postsToProcess) {
      // 3. Extraemos la traducción al español para la notificación
      const esData =
        post.translations.find((t) => t.lang === "es") || post.translations[0];

      const postData = {
        title_es: esData.title,
        slug_es: esData.slug,
        content_es: esData.content,
        tags_es: esData.tags.join(","),
        date: post.date.toISOString().split("T")[0], // Formato YYYY-MM-DD
        linkedin_post_es: esData.linkedinPost,
        linkedin_hashtags_es: esData.linkedinHashtags,
      };

      // 4. Disparamos el Webhook (Make.com -> LinkedIn)
      const notification = await triggerLinkedInNotification(
        postData,
        post.image,
      );

      if (notification.success) {
        // 5. Marcamos como enviado para que el cron no lo vuelva a procesar en 10 min
        await prisma.post.update({
          where: { id: post.id },
          data: { published_sent: true },
        });
        results.push(
          `Post ID ${post.id} ("${esData.title}"): Notificación enviada.`,
        );
      } else {
        results.push(
          `Post ID ${post.id}: Error en notificación (${notification.error})`,
        );
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
