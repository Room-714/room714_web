import { NextResponse } from "next/server";
import { generateTakesForToday } from "@/app/lib/ai/orchestrator";
import { getMadridWeekday, isMadridHour } from "@/app/lib/time/madrid";
import { PLANNED_WEEKDAYS } from "@/app/lib/time/linkedinSchedule";

export const maxDuration = 300;

// 08:30 de Madrid: media hora después de que se abra la ventana de revisión
// del artículo (08:00-08:30). Las tomas se escriben a partir del texto ya
// revisado, no del borrador.
//
// Vercel programa en UTC, así que en vercel.json hay dos entradas (una por
// horario estacional) y aquí se descarta la que no toca. Eso resuelve de paso
// la idempotencia frente al cambio de hora.
const TARGET_HOUR = 8;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const url = new URL(request.url);

  // Preview: construye las tomas y las devuelve en JSON, sin descargar
  // imágenes, sin escribir en base de datos y sin comprobar hora ni día.
  const preview = url.searchParams.get("preview") === "1";

  // Recuperación manual: si la generación de las 08:30 falló, el briefing de
  // las 08:50 lo avisa, pero a esas alturas isMadridHour(8) ya no pasa y no
  // hay forma de reintentar hasta el día siguiente. force=1 salta los guards
  // de hora y día para poder relanzarla a mano en el momento. NO salta la
  // autenticación (el Bearer de arriba) ni la idempotencia: si el post ya
  // tiene tomas, generateTakesForToday sigue devolviendo skipped igual.
  const force = url.searchParams.get("force") === "1";

  if (!preview && !force) {
    if (!isMadridHour(TARGET_HOUR)) {
      return NextResponse.json({
        message: "Saltado: no es la hora correcta en Madrid",
        targetHour: `${TARGET_HOUR}:30 Madrid`,
      });
    }

    const weekday = getMadridWeekday();
    if (!PLANNED_WEEKDAYS.includes(weekday)) {
      return NextResponse.json({
        message: "Saltado: hoy no se publica artículo",
        weekday,
        publishWeekdays: PLANNED_WEEKDAYS,
      });
    }
  }

  try {
    const result = await generateTakesForToday({ preview });

    if (result.skipped) {
      return NextResponse.json({
        message: "Generación de tomas saltada",
        reason: result.reason,
        postId: result.postId ?? null,
      });
    }

    return NextResponse.json({
      message: preview
        ? "Preview: nada escrito, ninguna imagen descargada"
        : "Tomas de LinkedIn generadas",
      ...result,
    });
  } catch (err) {
    console.error("❌ Error en cron generate-linkedin:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
