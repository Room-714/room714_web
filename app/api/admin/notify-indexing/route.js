import { NextResponse } from "next/server";
import { isAuthorizedAdmin } from "@/app/lib/auth";
import { notifyUrlUpdated } from "@/app/lib/seo/indexingApi";

export const maxDuration = 60;

export async function POST(request) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const url = body.url;
  if (!url || !url.startsWith("https://www.room714.com/")) {
    return NextResponse.json(
      { error: "url requerida y debe pertenecer a www.room714.com" },
      { status: 400 },
    );
  }

  try {
    const result = await notifyUrlUpdated(url);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error("[notify-indexing] Fallo:", err);
    return NextResponse.json(
      { success: false, error: err.message, stack: err.stack },
      { status: 500 },
    );
  }
}
