import { NextResponse } from "next/server";
import { generateDraftForToday } from "@/app/lib/ai/orchestrator";

export const maxDuration = 300;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  try {
    const result = await generateDraftForToday();

    if (result.skipped) {
      return NextResponse.json({
        message: "Generación saltada",
        reason: result.reason,
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
