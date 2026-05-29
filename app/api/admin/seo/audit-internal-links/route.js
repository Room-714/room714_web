import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAuthorizedAdmin } from "@/app/lib/auth";

export const maxDuration = 60;

const LINK_RE_ES = /<a\s+href="\/es\/blog\/[^"]+"/g;
const LINK_RE_EN = /<a\s+href="\/en\/blog\/[^"]+"/g;

export async function GET(request) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const posts = await prisma.post.findMany({
    where: { published: true, date: { lte: new Date() } },
    include: { translations: true },
    orderBy: { date: "desc" },
  });

  const summary = {
    totalPosts: posts.length,
    bySource: {},
    linkStats: {
      es: { zero: 0, one: 0, two: 0, three_plus: 0, total: 0 },
      en: { zero: 0, one: 0, two: 0, three_plus: 0, total: 0 },
    },
    recentSamples: [],
    zeroLinkSamples: [],
  };

  for (const post of posts) {
    summary.bySource[post.source] = (summary.bySource[post.source] || 0) + 1;
    const es = post.translations.find((t) => t.lang === "es");
    const en = post.translations.find((t) => t.lang === "en");

    const esCount = (es?.content || "").match(LINK_RE_ES)?.length || 0;
    const enCount = (en?.content || "").match(LINK_RE_EN)?.length || 0;

    const bucket = (c) =>
      c === 0 ? "zero" : c === 1 ? "one" : c === 2 ? "two" : "three_plus";
    summary.linkStats.es[bucket(esCount)]++;
    summary.linkStats.es.total += esCount;
    summary.linkStats.en[bucket(enCount)]++;
    summary.linkStats.en.total += enCount;

    if (summary.recentSamples.length < 10) {
      summary.recentSamples.push({
        id: post.id,
        title: es?.title || en?.title,
        date: post.date,
        source: post.source,
        category: post.category,
        es_links: esCount,
        en_links: enCount,
      });
    }

    if (esCount === 0 && enCount === 0 && summary.zeroLinkSamples.length < 3) {
      summary.zeroLinkSamples.push({
        id: post.id,
        title: es?.title,
        date: post.date,
        source: post.source,
        es_snippet: (es?.content || "").slice(0, 400),
      });
    }
  }

  return NextResponse.json(summary);
}
