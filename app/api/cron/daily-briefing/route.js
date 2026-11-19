import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import {
  formatMadridDateLabel,
  getMadridWeekday,
  isMadridHour,
  madridDayRange,
} from "@/app/lib/time/madrid";
import { PLANNED_WEEKDAYS } from "@/app/lib/time/linkedinSchedule";
import { buildDailyTasks } from "@/app/lib/linkedin/dailyTasks";
import { elegirTomaEmpresa } from "@/app/lib/linkedin/aprobacion";
import { sendDailyBriefingEmail } from "@/app/lib/notifications/dailyBriefing";

export const maxDuration = 60;

const TARGET_HOUR = 8;
const SITE = "https://www.room714.com";

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
      targetHour: `${TARGET_HOUR}:50 Madrid`,
    });
  }

  const now = new Date();
  const { start, end } = madridDayRange(now);

  try {
    // Una consulta detrás de otra, no en paralelo: la BD de producción se ha
    // quedado sin conexiones otras veces.
    //
    // Lo publicado hoy en la página de empresa. Desde noviembre de 2026 solo
    // sale a LinkedIn lo aprobado en el panel, una vez por post, así que las
    // tomas programadas ya no son publicaciones: una toma no enviada es lo
    // normal, no una incidencia.
    const publicadosHoy = await prisma.post.findMany({
      where: { linkedinPublicadoAt: { gte: start, lte: end } },
      include: { translations: true, linkedinVariants: true },
      orderBy: { linkedinPublicadoAt: "asc" },
    });

    // findMany y no findFirst: si el mismo día hay un post MANUAL y uno AUTO,
    // un findFirst sin filtrar por source puede devolver el manual, y
    // entonces blog_review apuntaría al artículo equivocado y la incidencia
    // no_takes (que exige source === "AUTO") desaparecería en silencio.
    // orderBy date desc para que, si hubiera dos AUTO (no debería), gane el
    // más reciente al elegir abajo.
    const todaysPosts = await prisma.post.findMany({
      where: { published: true, date: { gte: start, lte: end } },
      include: { translations: true, linkedinVariants: true },
      orderBy: { date: "desc" },
    });

    // Cada publicación de empresa deja a José la tarea de comentarla desde su
    // perfil. Se presenta con la forma de una toma para reutilizar las tareas.
    const todayVariants = publicadosHoy.map((post) => {
      const toma = elegirTomaEmpresa(post);
      return {
        id: toma?.id ?? null,
        variant: toma?.variant ?? 1,
        crossNote: toma?.crossNote ?? null,
        scheduledFor: post.linkedinPublicadoAt,
        canal: "empresa",
        cross: "comment_personal",
        post,
      };
    });

    // De los posts de hoy, prioriza el AUTO: es el que lleva tomas de
    // LinkedIn y el que espera la incidencia no_takes. Si no hay AUTO (día
    // manual), se queda con el primero (el más reciente, por el orderBy).
    const blogPost =
      todaysPosts.find((p) => p.source === "AUTO") ?? todaysPosts[0] ?? null;

    const siteUrl = process.env.NEXTAUTH_URL || SITE;

    const { tasks, incidents } = buildDailyTasks({
      todayVariants,
      blogPost,
      siteUrl,
      firstCommentAutomated: process.env.FIRST_COMMENT_AUTOMATED === "true",
      // Hoy tocaba artículo (lunes o miércoles) y no lo hay: la generación de
      // las 06:00 falló y los crones de Vercel no reintentan. Sin esto el
      // hueco de la semana se descubre cuando no llegan las publicaciones.
      expectsArticle: PLANNED_WEEKDAYS.includes(getMadridWeekday(now)),
    });

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
