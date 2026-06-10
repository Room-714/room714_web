import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const SITE = "https://www.room714.com";

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
    // Campos esperados por el escenario existente de Make.com (mantenemos
    // la misma forma que triggerLinkedInNotification para no romper el flow).
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
    // Metadatos de la variante (útil para debugging del scenario)
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

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

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
        await fireWebhook({ variant: v, post: v.post, translationEs });
        await prisma.linkedInVariant.update({
          where: { id: v.id },
          data: { sent: true, sentAt: new Date() },
        });
        results.push(
          `Variante ${v.id} (post ${v.postId}, ${v.angle}, #${v.variant}): enviada`,
        );
      } catch (err) {
        console.error(`Variante ${v.id} falló:`, err.message);
        results.push(`Variante ${v.id}: ERR ${err.message}`);
      }
    }

    return NextResponse.json({
      message: "Cron LinkedIn variantes ejecutado",
      processed: dueVariants.length,
      results,
    });
  } catch (err) {
    console.error("❌ Error en cron publish-linkedin:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
