"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { resolverMeta } from "@/app/lib/postMeta";

/**
 * Genera un slug amigable para URL
 */
function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .trim();
}

// La publicación en LinkedIn ya no sale de aquí: vive en linkedinActions.js
// (aprobación en el panel) y en /api/cron/publish-linkedin (envío a Make).

/**
 * Obtiene la lista de todos los posts
 */
export async function getPostsList() {
  try {
    const posts = await prisma.post.findMany({
      include: { translations: true },
      orderBy: { date: "desc" },
    });
    return { success: true, posts };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * ACCIÓN PRINCIPAL: Crea o actualiza el contenido (Siempre devuelve el objeto post)
 */
export async function savePost(data) {
  try {
    const {
      id,
      date,
      image,
      category_id,
      published, // Recibido del form
      title_es,
      tags_es,
      content_es,
      title_en,
      tags_en,
      content_en,
      metaTitle_es,
      metaDescription_es,
      metaTitle_en,
      metaDescription_en,
    } = data;
    // Lo que trae el formulario para cada idioma; undefined = no se tocó.
    const metaEnviada = {
      es: { metaTitle: metaTitle_es, metaDescription: metaDescription_es },
      en: { metaTitle: metaTitle_en, metaDescription: metaDescription_en },
    };

    const translationsData = [
      {
        lang: "es",
        title: title_es,
        slug: slugify(title_es),
        content: content_es,
        tags: tags_es
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== ""),
      },
      {
        lang: "en",
        title: title_en,
        slug: slugify(title_en),
        content: content_en,
        tags: tags_en
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== ""),
      },
    ];

    if (id) {
      const existingPost = await prisma.post.findUnique({
        where: { id: Number(id) },
        select: {
          published: true,
          translations: {
            select: {
              lang: true,
              slug: true,
              linkedinPost: true,
              linkedinHashtags: true,
              metaDescription: true,
              metaTitle: true,
            },
          },
        },
      });
      for (const t of translationsData) {
        const prev = existingPost?.translations.find((e) => e.lang === t.lang);
        if (prev) {
          t.linkedinPost = prev.linkedinPost;
          t.linkedinHashtags = prev.linkedinHashtags ?? [];
          // Las traducciones se borran y se recrean al guardar: lo que no
          // venga del formulario se conserva (antes, editar un post le quitaba
          // el metaTitle).
          t.metaDescription = resolverMeta(metaEnviada[t.lang].metaDescription, prev.metaDescription);
          t.metaTitle = resolverMeta(metaEnviada[t.lang].metaTitle, prev.metaTitle);
          // Congelamos el slug de un post ya publicado: cambiar su URL
          // rompería enlaces existentes (web, LinkedIn, Google). Los
          // borradores sí regeneran el slug desde el título.
          if (existingPost.published && prev.slug) {
            t.slug = prev.slug;
          }
        }
      }
    }

    // Post nuevo: los metadatos que se hayan escrito en el formulario.
    if (!id) {
      for (const t of translationsData) {
        t.metaDescription = resolverMeta(metaEnviada[t.lang].metaDescription, null);
        t.metaTitle = resolverMeta(metaEnviada[t.lang].metaTitle, null);
      }
    }

    const postPayload = {
      date: new Date(date),
      published: Boolean(published),
      image,
      category: category_id,
      translations: {
        deleteMany: id ? {} : undefined,
        create: translationsData,
      },
    };

    let post;
    if (id) {
      post = await prisma.post.update({
        where: { id: Number(id) },
        data: postPayload,
        include: { translations: true }, // Incluimos para el retorno
      });
    } else {
      post = await prisma.post.create({
        data: postPayload,
        include: { translations: true },
      });
    }

    revalidatePath("/", "layout");
    return { success: true, post }; // Retornamos el objeto post completo
  } catch (error) {
    console.error("Error en savePost:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Elimina un post
 */
export async function deletePost(id) {
  try {
    await prisma.postTranslation.deleteMany({ where: { postId: id } });
    await prisma.post.delete({ where: { id } });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
