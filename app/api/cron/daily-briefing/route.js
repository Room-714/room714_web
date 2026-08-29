import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import {
  formatMadridDateLabel,
  isMadridHour,
  madridDayRange,
} from "@/app/lib/time/madrid";
import { buildDailyTasks } from "@/app/lib/linkedin/dailyTasks";
import { buildProspectingTasks } from "@/app/lib/linkedin/prospecting";
import { sendDailyBriefingEmail } from "@/app/lib/notifications/dailyBriefing";

export const maxDuration = 60;

const TARGET_HOUR = 8;
const SITE = "https://www.room714.com";
const DAY_MS = 24 * 60 * 60 * 1000;

// Briefing diario de tareas manuales de LinkedIn.
//
// A las 08:50 y no antes: el cron `generate-linkedin` corre a las 08:30 de
// lunes y miércoles y crea las tomas de LinkedIn de ese día, y la primera sale
// hacia las 08:35-08:43. Antes de las 08:50 el briefing hablaría de una
// publicación que todavía no existe.
//
// Vercel programa en UTC, así que hay dos entradas en vercel.json (una por cada
// horario estacional) y aquí se descarta la que no toca. Eso resuelve de paso
// la idempotencia: de las dos ejecuciones solo una pasa el guard.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  // Modo preview: construye las tareas y las devuelve en JSON, sin enviar
  // correo y sin comprobar la hora.
  const preview = new URL(request.url).searchParams.get("preview") === "1";

  if (!preview && !isMadridHour(TARGET_HOUR)) {
    return NextResponse.json({
      message: "Saltado: no es la hora correcta en Madrid",
      targetHour: `${TARGET_HOUR}:00 Madrid`,
    });
  }

  const now = new Date();
  const { start, end } = madridDayRange(now);
  const yesterdayStart = new Date(start.getTime() - DAY_MS);

  try {
    const [todayVariants, yesterdayUnsent, blogPost, prospects, latestPost] =
      await Promise.all([
      prisma.linkedInVariant.findMany({
        where: { scheduledFor: { gte: start, lte: end } },
        include: { post: { include: { translations: true } } },
        orderBy: { scheduledFor: "asc" },
      }),
      prisma.linkedInVariant.findMany({
        where: { sent: false, scheduledFor: { gte: yesterdayStart, lt: start } },
        include: { post: { include: { translations: true } } },
        orderBy: { scheduledFor: "asc" },
      }),
      prisma.post.findFirst({
        where: { published: true, date: { gte: start, lte: end } },
        include: { translations: true, linkedinVariants: true },
      }),
      // Prospección: los ACTIVE menos atendidos primero (nulls first = nunca
      // atendidos). Se ordena por `lastTouchedAt`, no por `lastEngagedAt`:
      // saltar a alguien que no ha publicado nada también es atenderle, y con
      // el segundo campo se quedaría clavado en cabeza de cola para siempre.
      // El orden definitivo lo pone orderProspectQueue, que está probado.
      // Se traen de sobra y de los dos tipos (comprador y referencia): el
      // reparto de un hueco por tipo lo hace buildProspectingTasks.
      prisma.prospect.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ lastTouchedAt: { sort: "asc", nulls: "first" } }],
        take: 20,
      }),
      // Artículo más reciente ya publicado: da el ángulo del comentario.
      prisma.post.findFirst({
        where: { published: true, date: { lte: now } },
        orderBy: { date: "desc" },
        include: { translations: { where: { lang: "es" } } },
      }),
    ]);

    const siteUrl = process.env.NEXTAUTH_URL || SITE;

    const { tasks, incidents } = buildDailyTasks({
      todayVariants,
      yesterdayUnsent,
      blogPost,
      siteUrl,
      firstCommentAutomated: process.env.FIRST_COMMENT_AUTOMATED === "true",
    });

    // Las tareas de prospección van al final: son "después de comer" y no
    // compiten con la secuencia de publicación de la mañana.
    const prospectingTasks = buildProspectingTasks({
      prospects,
      latestPost: latestPost?.translations?.[0]
        ? { title: latestPost.translations[0].title }
        : null,
      siteUrl,
      dayOfMonth: now.getDate(),
    });
    tasks.push(...prospectingTasks);

    const dateLabel = formatMadridDateLabel(now);

    if (preview) {
      return NextResponse.json({
        mode: "preview",
        message: "Preview: nada enviado",
        dateLabel,
        tasks,
        incidents,
      });
    }

    // Día sin nada que hacer (festivo, generación fallida): no se envía correo.
    if (tasks.length === 0 && incidents.length === 0) {
      return NextResponse.json({
        message: "Sin tareas hoy, no se envía briefing",
        dateLabel,
        sent: false,
      });
    }

    const result = await sendDailyBriefingEmail({ tasks, incidents, dateLabel });

    return NextResponse.json({
      message: "Briefing diario procesado",
      dateLabel,
      taskCount: tasks.length,
      incidentCount: incidents.length,
      sent: result.success === true,
      skipped: result.skipped === true,
    });
  } catch (err) {
    console.error("❌ Error en cron daily-briefing:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
