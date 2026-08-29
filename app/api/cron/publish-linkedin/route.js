import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { channelForVariant } from "@/app/lib/time/linkedinSchedule";

export const maxDuration = 60;

const SITE = "https://www.room714.com";

/* ═══════════════════════════════════════════════════════════════════════════
 * FLUJO AUTOMÁTICO VÍA MAKE — ACTIVO (jul 2026)
 * La app de LinkedIn (Community Management API) ya está aprobada, así que el
 * cron dispara el webhook de Make y Make publica en la página de empresa.
 *
 * PARA VOLVER AL MODO MANUAL (email) si Make fallara:
 *   1. Reimportar sendLinkedInManualEmail desde
 *      "@/app/lib/notifications/linkedinManual".
 *   2. En el bucle del GET, llamar a sendLinkedInManualEmail(...) en vez de
 *      fireWebhook(...).
 *   3. (Opcional) volver el filtro a un digest diario:
 *      const endOfToday = new Date(now); endOfToday.setUTCHours(23,59,59,999);
 *      where: { sent: false, scheduledFor: { lte: endOfToday } }
 * ═══════════════════════════════════════════════════════════════════════════ */

// Construye el payload que se envía a Make. Puro y sin efectos, así el modo
// preview puede devolverlo para inspección sin llegar a postear.
function buildWebhookPayload({ variant, post, translationEs }) {
  const postUrl = `${SITE}/es/blog/${translationEs.slug}`;
  const hashtagsString = (variant.hashtags || [])
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");

  return {
    title: translationEs.title,
    summary: (translationEs.content || "")
      .replace(/<[^>]*>?/gm, "")
      .substring(0, 250)
      .concat("..."),
    url: postUrl,
    image: variant.imageBlobUrl,
    date: post.date.toISOString().split("T")[0],
    tags: translationEs.tags,
    linkedin_post: variant.text,
    linkedin_hashtags: variant.hashtags || [],
    linkedin_hashtags_string: hashtagsString,
    link_for_first_comment: postUrl,
    variant_id: variant.id,
    variant_number: variant.variant,
    variant_angle: variant.angle,
    // Decide qué ruta del Router de Make se ejecuta: "personal" → Create a
    // User Image Post · "empresa" → Create a Company Image Post. El reparto
    // vive en linkedinSchedule.js, no en Make.
    canal: channelForVariant({
      postPublishDate: post.date,
      variant: variant.variant,
    }),
  };
}

async function fireWebhook({ variant, post, translationEs }) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("MAKE_WEBHOOK_URL no definida");
  }

  const payload = buildWebhookPayload({ variant, post, translationEs });

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Make webhook respondió ${response.status}`);
  }
  return true;
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  // Modo preview: no postea ni marca nada como enviado; solo devuelve el
  // payload que se enviaría a Make (para verificar formato sin efectos).
  const preview = new URL(request.url).searchParams.get("preview") === "1";

  // Publicamos cada variante a su hora: recogemos las pendientes cuyo
  // scheduledFor ya venció. El cron corre varias veces al día.
  const now = new Date();

  // Nada con más de medio día de retraso: una variante que se quedó sin enviar
  // ayer ya no tiene sentido hoy, y publicarla fuera de su día la deja sin la
  // acción cruzada que le tocaba y sin aparecer en ningún briefing. Además es lo
  // que impide que una cola vieja se vacíe de golpe tras un cambio de calendario.
  const MAX_RETRASO_MS = 12 * 60 * 60 * 1000;
  const minScheduledFor = new Date(now.getTime() - MAX_RETRASO_MS);

  try {
    const dueVariants = await prisma.linkedInVariant.findMany({
      where: { sent: false, scheduledFor: { lte: now, gte: minScheduledFor } },
      include: {
        post: { include: { translations: true } },
      },
      orderBy: { scheduledFor: "asc" },
    });

    // Las que se quedan fuera solo por antiguas no deben desaparecer en
    // silencio: se cuentan aparte para que se vean en la respuesta si alguien
    // mira, aunque el cron no haga nada con ellas.
    const staleCount = await prisma.linkedInVariant.count({
      where: { sent: false, scheduledFor: { lt: minScheduledFor } },
    });

    if (dueVariants.length === 0) {
      return NextResponse.json({
        mode: preview ? "preview" : "make-webhook",
        message: "Sin variantes pendientes",
        processed: 0,
        staleSkipped: staleCount,
      });
    }

    const results = [];

    for (const v of dueVariants) {
      const translationEs = v.post.translations.find((t) => t.lang === "es");
      if (!translationEs) {
        results.push(`Variante ${v.id}: skipped (sin translation ES)`);
        continue;
      }

      try {
        if (preview) {
          results.push({
            id: v.id,
            postId: v.postId,
            variant: v.variant,
            angle: v.angle,
            scheduledFor: v.scheduledFor,
            payload: buildWebhookPayload({
              variant: v,
              post: v.post,
              translationEs,
            }),
          });
          continue;
        }

        await fireWebhook({ variant: v, post: v.post, translationEs });

        await prisma.linkedInVariant.update({
          where: { id: v.id },
          data: { sent: true, sentAt: new Date() },
        });
        results.push(
          `Variante ${v.id} (post ${v.postId}, ${v.angle}, #${v.variant}): webhook Make disparado`,
        );
      } catch (err) {
        console.error(`Variante ${v.id} falló:`, err.message);
        results.push(`Variante ${v.id}: ERR ${err.message}`);
      }
    }

    return NextResponse.json({
      mode: preview ? "preview" : "make-webhook",
      message: preview
        ? "Preview: nada posteado ni marcado"
        : "Cron LinkedIn (webhook Make) ejecutado",
      processed: dueVariants.length,
      staleSkipped: staleCount,
      results,
    });
  } catch (err) {
    console.error("❌ Error en cron publish-linkedin:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
