import { prisma } from "./prisma";

export async function getAllPosts(lang = "es") {
  try {
    const now = new Date(); // El "ahora" del servidor

    const posts = await prisma.post.findMany({
      where: {
        published: true, // Filtro 1: Debe estar publicado
        date: {
          lte: now, // Filtro 2: La fecha debe ser menor o igual a "ahora"
        },
      },
      include: {
        translations: {
          where: { lang: lang },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return posts.map((post) => {
      const translation = post.translations[0];
      return {
        id: post.id,
        date: post.date,
        image: post.image,
        category: post.category,
        slug: translation?.slug,
        title: translation?.title,
        tags: translation?.tags,
        content: translation?.content,
      };
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return [];
  }
}

export async function getPostBySlug(slug, lang = "es") {
  try {
    const currentTranslation = await prisma.postTranslation.findFirst({
      where: { slug: slug, lang: lang },
      include: { post: { include: { translations: true } } },
    });

    if (!currentTranslation) return null;

    const alternateSlugs = {
      es: currentTranslation.post.translations.find((t) => t.lang === "es")
        ?.slug,
      en: currentTranslation.post.translations.find((t) => t.lang === "en")
        ?.slug,
    };

    return {
      id: currentTranslation.post.id,
      date: currentTranslation.post.date.toISOString().split("T")[0],
      image: currentTranslation.post.image,
      category: currentTranslation.post.category, // <--- CORREGIDO: Viene del modelo padre 'post'
      slug: currentTranslation.slug,
      title: currentTranslation.title,
      tags: currentTranslation.tags,
      content: currentTranslation.content,
      alternateSlugs,
    };
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}
