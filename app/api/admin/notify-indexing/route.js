import { NextResponse } from "next/server";
import { isAuthorizedAdmin } from "@/app/lib/auth";
import { notifyUrlUpdated } from "@/app/lib/seo/indexingApi";
import { notifyIndexNow } from "@/app/lib/seo/indexNow";

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

  const out = { google: null, indexnow: null };

  try {
    out.google = await notifyUrlUpdated(url);
  } catch (err) {
    console.error("[notify-indexing] Google falló:", err);
    out.google = { error: err.message };
  }

  try {
    out.indexnow = await notifyIndexNow(url);
  } catch (err) {
    console.error("[notify-indexing] IndexNow falló:", err);
    out.indexnow = { error: err.message };
  }

  const success = !out.google?.error && !out.indexnow?.error;
  return NextResponse.json(
    { success, ...out },
    { status: success ? 200 : 500 },
  );
}
