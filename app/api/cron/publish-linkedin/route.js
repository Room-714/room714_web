import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

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

  try {
    const dueVariants = await prisma.linkedInVariant.findMany({
      where: { sent: false, scheduledFor: { lte: now } },
      include: {
        post: { include: { translations: true } },
      },
      orderBy: { scheduledFor: "asc" },
    });

    if (dueVariants.length === 0) {
      return NextResponse.json({
        mode: preview ? "preview" : "make-webhook",
        message: "Sin variantes pendientes",
        processed: 0,
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
      results,
    });
  } catch (err) {
    console.error("❌ Error en cron publish-linkedin:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
