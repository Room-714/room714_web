import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAuthorizedAdmin } from "@/app/lib/auth";
import { notifyUrlUpdated, buildPostUrls } from "@/app/lib/seo/indexingApi";

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

  const results = { success: 0, failed: 0, errors: [] };
  for (const url of allUrls) {
    try {
      await notifyUrlUpdated(url);
      results.success++;
    } catch (err) {
      results.failed++;
      if (results.errors.length < 10) {
        results.errors.push({ url, error: err.message });
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  return NextResponse.json({
    dryRun: false,
    postCount: posts.length,
    urlCount: allUrls.length,
    ...results,
  });
}
