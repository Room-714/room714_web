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
      translations: { where: { lang: "es" } },
    },
  });

  return posts.map((p) => ({
    date: p.date.toISOString().split("T")[0],
    category: p.category,
    title: p.translations[0]?.title ?? "(sin título)",
    tags: p.translations[0]?.tags ?? [],
  }));
}
