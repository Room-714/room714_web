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
    const now = new Date();

    const currentTranslation = await prisma.postTranslation.findFirst({
      where: {
        slug: slug,
        lang: lang,
        // Añadimos el filtro al modelo relacionado 'post'
        post: {
          published: true,
          date: {
            lte: now, // Solo si ya es la hora o pasó
          },
        },
      },
      include: {
        post: {
          include: { translations: true },
        },
      },
    });

    // Si el post no existe, está en borrador o es futuro, devolvemos null
    // Esto hará que Next.js dispare un 404 automáticamente si manejas bien el null en la page
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
      category: currentTranslation.post.category,
      slug: currentTranslation.slug,
      title: currentTranslation.title,
      tags: currentTranslation.tags,
      content: currentTranslation.content,
      alternateSlugs,
    };
  } catch (error) {
    console.error("Error fetching post by slug:", error);
    return null;
  }
}
