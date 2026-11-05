import { NextResponse } from "next/server";
import { generateDraftForToday } from "@/app/lib/ai/orchestrator";
import { isMadridHour } from "@/app/lib/time/madrid";

export const maxDuration = 300;

// 06:00: hora y media antes de que el artículo se haga visible (07:30). La
// generación completa tarda 1-2 minutos, así que el margen es de sobra, y deja
// tiempo a que llegue el correo de borrador listo antes de que nadie se siente.
//
// El margen importa más de lo que parece: nextMadridSlot(7, 30) devuelve el
// SIGUIENTE día laborable si las 07:30 ya pasaron, y entonces el artículo se
// fecharía un día en que generate-linkedin no corre.
const TARGET_HOUR = 6;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  if (!isMadridHour(TARGET_HOUR)) {
    return NextResponse.json({
      message: "Saltado: no es la hora correcta en Madrid",
      targetHour: `${TARGET_HOUR}:00 Madrid`,
    });
  }

  try {
    // Sin nadie delante que elija: si el tema del día duplica un post, se
    // descarta y se prueba otro una vez. Si también duplica, no se genera
    // (el briefing de las 08:50 avisa de que no hay artículo).
    const result = await generateDraftForToday({ alDuplicar: "otroAngulo" });

    if (result.skipped) {
      return NextResponse.json({
        message: "Generación saltada",
        reason: result.reason,
        duplicado: result.duplicado ?? null,
      });
    }

    return NextResponse.json({
      message: "Borrador generado",
      postId: result.postId,
      category: result.category,
      title_es: result.title_es,
      slug_es: result.slug_es,
      image: result.image,
      trendingItemsUsed: result.trendingItemsUsed,
      recentPostsConsidered: result.recentPostsConsidered,
      usage: result.usage,
      emailSent: result.email?.success === true,
    });
  } catch (error) {
    console.error("Error en cron/generate:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
