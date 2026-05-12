import { prisma } from "@/app/lib/prisma";

const ROTATION = {
  1: "TECH",
  2: "PRODUCT",
  3: "UX",
  4: "DESIGN",
  5: "TECH",
};

export function categoryForDate(date = new Date()) {
  const day = date.getDay();
  return ROTATION[day] ?? null;
}

export async function getRecentPosts(limit = 10) {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      translations: true,
    },
  });

  return posts.map((p) => {
    const es = p.translations.find((t) => t.lang === "es");
    const en = p.translations.find((t) => t.lang === "en");
    return {
      date: p.date.toISOString().split("T")[0],
      category: p.category,
      title: es?.title ?? en?.title ?? "(sin título)",
      tags: es?.tags ?? [],
      slug_es: es?.slug ?? null,
      slug_en: en?.slug ?? null,
    };
  });
}
