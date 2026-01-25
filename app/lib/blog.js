import { prisma } from "./prisma";

export async function getAllPosts(lang = "es") {
  try {
    const posts = await prisma.post.findMany({
      include: {
        translations: {
          where: { lang: lang },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    // Mapeamos los datos para que tengan el formato que espera tu frontend
    return posts.map((post) => {
      const translation = post.translations[0];
      return {
        id: post.id,
        date: post.date,
        image: post.image,
        slug: translation?.slug,
        title: translation?.title,
        category: translation?.category,
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
    // 1. Buscamos la traducción actual y su post
    const currentTranslation = await prisma.postTranslation.findFirst({
      where: { slug: slug, lang: lang },
      include: { post: { include: { translations: true } } },
    });

    if (!currentTranslation) return null;

    // 2. Extraemos los slugs para los botones de idioma (alternates)
    const alternateSlugs = {
      es: currentTranslation.post.translations.find((t) => t.lang === "es")
        ?.slug,
      en: currentTranslation.post.translations.find((t) => t.lang === "en")
        ?.slug,
    };

    return {
      id: currentTranslation.post.id,
      date: currentTranslation.post.date.toISOString().split("T")[0], // Formato YYYY-MM-DD
      image: currentTranslation.post.image,
      slug: currentTranslation.slug,
      title: currentTranslation.title,
      category: currentTranslation.category,
      tags: currentTranslation.tags,
      content: currentTranslation.content,
      alternateSlugs, // Esto es vital para tu Navbar y SEO
    };
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}
