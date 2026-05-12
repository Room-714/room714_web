import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getRecentPosts } from "@/app/lib/ai/topicRotation";
import { getTrendingForCategory } from "@/app/lib/sources/medium";
import { generatePostFromIdea } from "@/app/lib/ai/generator";
import { fetchAndStoreCoverImage } from "@/app/lib/sources/unsplash";
import { isAuthorizedAdmin } from "@/app/lib/auth";

export const maxDuration = 300;

function slugifyFallback(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

async function ensureUniqueSlug(slug, excludePostId) {
  let candidate = slug;
  let i = 2;
  while (true) {
    const existing = await prisma.postTranslation.findUnique({
      where: { slug: candidate },
    });
    if (!existing || existing.postId === excludePostId) return candidate;
    candidate = `${slug}-${i}`;
    i += 1;
    if (i > 50) throw new Error(`No se pudo generar slug único para ${slug}`);
  }
}

export async function POST(request) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const postId = Number(body.postId);
  const chosenIdea = body.chosenIdea;

  if (!Number.isInteger(postId) || postId <= 0) {
    return NextResponse.json({ error: "postId inválido" }, { status: 400 });
  }
  if (!chosenIdea?.title || !chosenIdea?.hook) {
    return NextResponse.json(
      { error: "chosenIdea inválido (faltan title o hook)" },
      { status: 400 },
    );
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { translations: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });
    }

    const [trending, recentPosts] = await Promise.all([
      getTrendingForCategory(post.category),
      getRecentPosts(10),
    ]);

    const draft = await generatePostFromIdea({
      category: post.category,
      chosenIdea,
      trending,
      recentPosts,
    });

    const datePrefix = new Date().toISOString().split("T")[0];
    const cover = await fetchAndStoreCoverImage(draft.image_query, datePrefix);

    const slugEs = await ensureUniqueSlug(
      draft.slug_es || slugifyFallback(draft.title_es),
      postId,
    );
    const slugEn = await ensureUniqueSlug(
      draft.slug_en || slugifyFallback(draft.title_en),
      postId,
    );

    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        image: cover.url,
        translations: {
          deleteMany: {},
          create: [
            {
              lang: "es",
              slug: slugEs,
              title: draft.title_es,
              tags: draft.tags_es,
              content: draft.content_es,
            },
            {
              lang: "en",
              slug: slugEn,
              title: draft.title_en,
              tags: draft.tags_en,
              content: draft.content_en,
            },
          ],
        },
      },
      include: { translations: true },
    });

    const translationEs = updated.translations.find((t) => t.lang === "es");

    return NextResponse.json({
      postId: updated.id,
      category: updated.category,
      title_es: translationEs.title,
      slug_es: translationEs.slug,
      image: cover.url,
      imageAttribution: cover.attribution,
      usage: draft.usage,
    });
  } catch (error) {
    console.error("Error en regenerate-from-idea:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
}
