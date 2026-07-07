import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { sendLinkedInManualEmail } from "@/app/lib/notifications/linkedinManual";

export const maxDuration = 60;

const SITE = "https://www.room714.com";

/* ═══════════════════════════════════════════════════════════════════════════
 * FLUJO AUTOMÁTICO VÍA MAKE — DESACTIVADO TEMPORALMENTE (jul 2026)
 * La app de LinkedIn (Community Management API) está en revisión, así que
 * publicamos MANUALMENTE: el cron manda por email el contenido + imagen a
 * DRAFT_REVIEW_EMAIL y José Antonio lo publica a mano.
 *
 * PARA REACTIVAR MAKE cuando LinkedIn apruebe la app:
 *   1. Descomentar esta función fireWebhook.
 *   2. En el bucle del GET, llamar a fireWebhook(...) en vez de
 *      sendLinkedInManualEmail(...).
 *   3. (Opcional) volver el filtro del where a { scheduledFor: { lte: now } }
 *      si no quieres el digest matutino.
 * ---------------------------------------------------------------------------
async function fireWebhook({ variant, post, translationEs }) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("MAKE_WEBHOOK_URL no definida");
  }

  const postUrl = `${SITE}/es/blog/${translationEs.slug}`;
  const hashtagsString = (variant.hashtags || [])
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");

  const payload = {
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
 * ═══════════════════════════════════════════════════════════════════════════ */

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  // Modo preview: no envía emails ni marca nada como enviado; solo devuelve
  // lo que se mandaría (para verificar formato/destinatario sin efectos).
  const preview = new URL(request.url).searchParams.get("preview") === "1";

  // Digest matutino: recogemos todas las variantes pendientes cuya fecha cae
  // hoy (o está vencida) para mandar el contenido del día en el primer cron de
  // la mañana; así se publica manualmente a lo largo del día.
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setUTCHours(23, 59, 59, 999);

  try {
    const dueVariants = await prisma.linkedInVariant.findMany({
      where: { sent: false, scheduledFor: { lte: endOfToday } },
      include: {
        post: { include: { translations: true } },
      },
      orderBy: { scheduledFor: "asc" },
    });

    if (dueVariants.length === 0) {
      return NextResponse.json({
        mode: preview ? "preview" : "manual-email",
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

      const postUrl = `${SITE}/es/blog/${translationEs.slug}`;

      try {
        const emailResult = await sendLinkedInManualEmail({
          variant: v,
          translationEs,
          postUrl,
          preview,
        });

        if (preview) {
          results.push({
            id: v.id,
            postId: v.postId,
            variant: v.variant,
            angle: v.angle,
            scheduledFor: v.scheduledFor,
            to: emailResult.to,
            subject: emailResult.subject,
            html: emailResult.html,
          });
          continue;
        }

        if (!emailResult.success) {
          throw new Error(emailResult.error || "email no enviado");
        }

        await prisma.linkedInVariant.update({
          where: { id: v.id },
          data: { sent: true, sentAt: new Date() },
        });
        results.push(
          `Variante ${v.id} (post ${v.postId}, ${v.angle}, #${v.variant}): email enviado a ${emailResult.to}`,
        );
      } catch (err) {
        console.error(`Variante ${v.id} falló:`, err.message);
        results.push(`Variante ${v.id}: ERR ${err.message}`);
      }
    }

    return NextResponse.json({
      mode: preview ? "preview" : "manual-email",
      message: preview
        ? "Preview: nada enviado ni marcado"
        : "Cron LinkedIn (email manual) ejecutado",
      processed: dueVariants.length,
      results,
    });
  } catch (err) {
    console.error("❌ Error en cron publish-linkedin:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
