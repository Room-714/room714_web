import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { ESTADOS, construirPublicacion } from "@/app/lib/linkedin/aprobacion";

export const maxDuration = 60;

/* ═══════════════════════════════════════════════════════════════════════════
 * PUBLICACIÓN EN LINKEDIN SOLO CON APROBACIÓN (nov 2026)
 *
 * Antes este cron publicaba, a su hora, todas las tomas que escribía
 * generate-linkedin (personal y empresa), sin revisión. Ahora solo envía a
 * Make los posts que alguien ha aprobado en el panel (linkedinEstado =
 * APROBADO) y que ya están publicados en la web. Una publicación por post,
 * siempre por el canal "empresa". Las tomas siguen generándose, pero solo como
 * texto para la publicación aprobada; ya no salen por su cuenta.
 *
 * Base de datos: una lectura y, al final, una única escritura con todos los
 * enviados. Nada de consultas dentro del bucle.
 * ═══════════════════════════════════════════════════════════════════════════ */

async function fireWebhook(payload) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("MAKE_WEBHOOK_URL no definida");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Make webhook respondió ${response.status}`);
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  // Modo preview: no envía ni marca nada; devuelve lo que se mandaría a Make.
  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const now = new Date();

  try {
    const aprobados = await prisma.post.findMany({
      where: {
        linkedinEstado: ESTADOS.APROBADO,
        linkedinPublicadoAt: null,
        published: true,
        date: { lte: now },
      },
      include: { translations: true, linkedinVariants: true },
      orderBy: { date: "asc" },
    });

    if (aprobados.length === 0) {
      return NextResponse.json({
        mode: preview ? "preview" : "make-webhook",
        message: "Sin posts aprobados pendientes de LinkedIn",
        processed: 0,
      });
    }

    const results = [];
    const enviados = [];

    for (const post of aprobados) {
      const payload = construirPublicacion(post);
      if (!payload) {
        results.push(`Post ${post.id}: omitido (sin traducción ES)`);
        continue;
      }

      if (preview) {
        results.push({ postId: post.id, payload });
        continue;
      }

      try {
        await fireWebhook(payload);
        enviados.push(post.id);
        results.push(`Post ${post.id}: enviado a Make (página de empresa)`);
      } catch (err) {
        console.error(`publish-linkedin: post ${post.id} falló:`, err.message);
        results.push(`Post ${post.id}: ERR ${err.message}`);
      }
    }

    if (enviados.length > 0) {
      await prisma.post.updateMany({
        where: { id: { in: enviados }, linkedinEstado: ESTADOS.APROBADO },
        data: { linkedinEstado: ESTADOS.PUBLICADO, linkedinPublicadoAt: now },
      });
    }

    return NextResponse.json({
      mode: preview ? "preview" : "make-webhook",
      message: preview
        ? "Preview: nada enviado ni marcado"
        : "Cron LinkedIn (aprobados) ejecutado",
      processed: aprobados.length,
      sent: enviados.length,
      results,
    });
  } catch (err) {
    console.error("❌ Error en cron publish-linkedin:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
