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

// Corpus completo de lo ya publicado, para que el generador no reescriba un
// ángulo viejo. Distinto de getRecentPosts: aquí no hay límite y no se traen
// slugs, porque no se usa para validar enlaces internos sino para comparar
// temas. El `select` en translations evita arrastrar `content`, que es el
// campo grande y multiplicaría por cien el peso de la consulta.
export async function getPublishedTitles() {
  const posts = await prisma.post.findMany({
    where: { published: true, date: { lte: new Date() } },
    orderBy: { date: "desc" },
    select: {
      date: true,
      category: true,
      translations: {
        select: { lang: true, title: true, tags: true },
      },
    },
  });

  return posts.map((p) => {
    const es = p.translations.find((t) => t.lang === "es");
    const en = p.translations.find((t) => t.lang === "en");
    return {
      date: p.date.toISOString().split("T")[0],
      category: p.category,
      title_es: es?.title ?? null,
      title_en: en?.title ?? null,
      tags: es?.tags ?? en?.tags ?? [],
    };
  });
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
