"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { CATEGORY_LABELS } from "@/app/data/BlogCategories";

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
 * Envía la información del post a Make.com para su publicación en LinkedIn
 */
async function notifySocialMediaWebhook(postData, imageUrl) {
  const webhookUrl =
    "https://hook.eu2.make.com/3h4o9e3j55lzjoavg68du7y24f0gav3m";

  // Limpiamos el HTML del contenido para el resumen de RRSS
  const cleanSummary = postData.content_es
    ? postData.content_es.replace(/<[^>]*>?/gm, "").substring(0, 250) + "..."
    : "";

  const payload = {
    title: postData.title_es,
    summary: cleanSummary,
    url: `https://tuweb.com/blog/${slugify(postData.title_es)}`,
    image: imageUrl,
    date: postData.date,
  };

  try {
    console.log("📤 Enviando datos a Make...");
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log("✅ Webhook ejecutado con éxito");
    } else {
      console.error("⚠️ Make respondió con error:", response.status);
    }
  } catch (error) {
    console.error("❌ Error de red al conectar con el Webhook:", error);
  }
}

/**
 * Obtiene la lista de todos los posts
 */
export async function getPostsList() {
  try {
    const posts = await prisma.post.findMany({
      include: {
        translations: true,
      },
      orderBy: { date: "desc" },
    });
    return { success: true, posts };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Crea o actualiza un post y notifica a redes sociales
 */
export async function savePost(data) {
  try {
    const {
      id,
      date,
      image,
      category_id,
      title_es,
      tags_es,
      content_es,
      title_en,
      tags_en,
      content_en,
      publishToLinkedIn, // Recibimos el flag desde el form
    } = data;

    const translationsData = [
      {
        lang: "es",
        title: title_es,
        slug: slugify(title_es),
        category: CATEGORY_LABELS[category_id].es,
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
        category: CATEGORY_LABELS[category_id].en,
        content: content_en,
        tags: tags_en
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== ""),
      },
    ];

    let result;

    if (id) {
      result = await prisma.post.update({
        where: { id: Number(id) },
        data: {
          date: new Date(date),
          image,
          translations: {
            deleteMany: {},
            create: translationsData,
          },
        },
      });
    } else {
      result = await prisma.post.create({
        data: {
          date: new Date(date),
          image,
          translations: {
            create: translationsData,
          },
        },
      });
    }

    // Disparamos la automatización solo si se solicita
    // Por ahora, mientras haces pruebas en Make, puedes quitar el 'if' para que siempre envíe
    if (publishToLinkedIn) {
      await notifySocialMediaWebhook(data, image);
    }

    revalidatePath("/", "layout");
    return { success: true, id: result.id };
  } catch (error) {
    console.error("Error en savePost:", error);
    return {
      success: false,
      error: "Error al procesar el post: " + error.message,
    };
  }
}

/**
 * Elimina un post y sus traducciones
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
