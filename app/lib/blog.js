import { prisma } from "./prisma";
import { normalizeSlugParam } from "./slug";

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
        updatedAt: post.updatedAt,
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

/**
 * Ordena los posts según una lista de slugs y rellena los huecos con lo más
 * reciente hasta `cuantos`. Pura, para poder probarla sin base de datos.
 *
 * Un slug fijado que ya no existe (despublicado, renombrado) no deja hueco ni
 * rompe la portada: simplemente entra el siguiente más reciente.
 */
export function ordenarPorSlugs(posts, slugs, cuantos) {
  const porSlug = new Map(posts.filter((p) => p.slug).map((p) => [p.slug, p]));
  const elegidos = [];
  const usados = new Set();

  for (const slug of slugs) {
    const post = porSlug.get(slug);
    if (post && !usados.has(post.id)) {
      elegidos.push(post);
      usados.add(post.id);
    }
  }

  for (const post of posts) {
    if (elegidos.length >= cuantos) break;
    if (!usados.has(post.id) && post.slug) {
      elegidos.push(post);
      usados.add(post.id);
    }
  }

  return elegidos.slice(0, cuantos);
}

export async function getPostsByCategory(category, lang = "es") {
  try {
    const now = new Date();

    const posts = await prisma.post.findMany({
      where: {
        published: true,
        category,
        date: { lte: now },
      },
      include: {
        translations: { where: { lang } },
      },
      orderBy: { date: "desc" },
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
        metaDescription: translation?.metaDescription,
      };
    });
  } catch (error) {
    console.error("Error fetching posts by category:", error);
    return [];
  }
}

export async function getPostBySlug(rawSlug, lang = "es") {
  try {
    const now = new Date();

    // Único punto por el que pasan todas las consultas por slug, así que es
    // aquí donde se deshace el percent-encoding de los params.
    const slug = normalizeSlugParam(rawSlug);

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
      // Fechas completas para el JSON-LD. `date` se queda como está porque es
      // la que se pinta en la página.
      datePublished: currentTranslation.post.date.toISOString(),
      dateModified: currentTranslation.post.updatedAt?.toISOString() ?? null,
      image: currentTranslation.post.image,
      category: currentTranslation.post.category,
      slug: currentTranslation.slug,
      title: currentTranslation.title,
      tags: currentTranslation.tags,
      content: currentTranslation.content,
      metaDescription: currentTranslation.metaDescription,
      alternateSlugs,
    };
  } catch (error) {
    console.error("Error fetching post by slug:", error);
    return null;
  }
}
