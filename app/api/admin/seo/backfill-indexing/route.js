import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAuthorizedAdmin } from "@/app/lib/auth";
import { notifyUrlUpdated, buildPostUrls } from "@/app/lib/seo/indexingApi";
import { notifyIndexNow } from "@/app/lib/seo/indexNow";

export const maxDuration = 300;

export async function POST(request) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") === "true";
  const limit = parseInt(searchParams.get("limit") || "0", 10) || null;

  const now = new Date();
  const posts = await prisma.post.findMany({
    where: { published: true, date: { lte: now } },
    include: { translations: true },
    orderBy: { date: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  const allUrls = [];
  for (const post of posts) {
    const es = post.translations.find((t) => t.lang === "es");
    const en = post.translations.find((t) => t.lang === "en");
    allUrls.push(...buildPostUrls(es?.slug, en?.slug));
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      postCount: posts.length,
      urlCount: allUrls.length,
      urls: allUrls,
    });
  }

  const google = { success: 0, failed: 0, errors: [] };
  for (const url of allUrls) {
    try {
      await notifyUrlUpdated(url);
      google.success++;
    } catch (err) {
      google.failed++;
      if (google.errors.length < 10) {
        google.errors.push({ url, error: err.message });
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  // IndexNow soporta batch grandes en una sola llamada (hasta 10k URLs).
  let indexnow;
  try {
    indexnow = await notifyIndexNow(allUrls);
  } catch (err) {
    indexnow = { error: err.message };
  }

  return NextResponse.json({
    dryRun: false,
    postCount: posts.length,
    urlCount: allUrls.length,
    google,
    indexnow,
  });
}
