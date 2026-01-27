"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";

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

/**
 * Lógica de Webhook para LinkedIn (Make.com)
 * Ahora exportada para llamarla independientemente
 */
export async function triggerLinkedInNotification(postData, imageUrl) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("⚠️ MAKE_WEBHOOK_URL no definida");
    return { success: false, error: "Webhook URL no configurada" };
  }

  const cleanSummary = postData.content_es
    ? postData.content_es.replace(/<[^>]*>?/gm, "").substring(0, 250) + "..."
    : "";

  const payload = {
    title: postData.title_es,
    summary: cleanSummary,
    url: `https://www.room714.com/es/blog/${slugify(postData.title_es)}`,
    image: imageUrl,
    date: postData.date,
    tags: postData.tags_es,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { success: response.ok };
  } catch (error) {
    console.error("❌ Error Webhook:", error);
    return { success: false, error: error.message };
  }
}

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
    } = data;

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
