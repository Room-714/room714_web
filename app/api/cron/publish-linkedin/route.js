import { prisma } from "@/app/lib/prisma";
import { NextResponse } from "next/server";
import { ESTADOS, construirPublicacion } from "@/app/lib/linkedin/aprobacion";
import { ejecutarCanal, enviarAMake, vistaPrevia } from "@/app/lib/linkedin/autopost";
import { configLinkedIn } from "@/app/lib/linkedin/config";
import { franjaLinkedIn } from "@/app/lib/linkedin/selectores";

// Generar el texto del perfil (hasta dos llamadas al modelo) más el envío a
// Make cabe de sobra, pero no en 60 s si el modelo va lento.
export const maxDuration = 300;

/* ═══════════════════════════════════════════════════════════════════════════
 * PUBLICACIÓN AUTOMÁTICA EN LINKEDIN (noviembre de 2026)
 *
 * El cron corre cada 5 minutos de 07:00 a 09:55 (Madrid), de lunes a viernes,
 * pero solo trabaja en dos franjas (app/lib/linkedin/selectores.js):
 *   08:30  ejecución principal: viernes la página de empresa, martes y
 *          jueves el perfil de José;
 *   08:45  reintento de lo que haya fallado a las 08:30.
 * El resto de ejecuciones salen sin tocar la base de datos.
 *
 * ?preview=1 enseña lo que saldría en la próxima ejecución de cada canal, sin
 * enviar ni guardar nada.
 *
 * Con LINKEDIN_APPROVAL_FLOW=true vuelve además el flujo de aprobación
 * anterior (posts APROBADO en el panel → página de empresa en cada ejecución),
 * y la página de empresa automática se apaga.
 * ═══════════════════════════════════════════════════════════════════════════ */

// Flujo de aprobación (desactivado por defecto). Una lectura y una escritura.
async function publicarAprobados({ now, preview, webhook }) {
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
      await enviarAMake(webhook, payload);
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
  return { processed: aprobados.length, sent: enviados.length, results };
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const preview = new URL(request.url).searchParams.get("preview") === "1";
  const now = new Date();
  const config = configLinkedIn();

  try {
    if (preview) {
      const vista = await vistaPrevia({ ahora: now, deps: { config } });
      if (config.flujoAprobacion) {
        vista.aprobados = await publicarAprobados({ now, preview: true, webhook: config.empresa.webhook });
      }
      return NextResponse.json(vista);
    }

    const respuesta = { ahora: now.toISOString() };

    if (config.flujoAprobacion) {
      respuesta.aprobados = await publicarAprobados({ now, preview: false, webhook: config.empresa.webhook });
    }

    const franja = franjaLinkedIn(now);
    if (franja) {
      respuesta.automatico = await ejecutarCanal({ ...franja, ahora: now, deps: { config } });
    } else if (!config.flujoAprobacion) {
      respuesta.message = "Fuera de franja: no toca publicar";
    }

    return NextResponse.json(respuesta);
  } catch (err) {
    console.error("❌ Error en cron publish-linkedin:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
