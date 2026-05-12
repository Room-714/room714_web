import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getRecentPosts } from "@/app/lib/ai/topicRotation";
import { getCrossSourceTrending } from "@/app/lib/sources/aggregator";
import { generateAlternativeIdeas } from "@/app/lib/ai/ideaGenerator";
import { isAuthorizedAdmin } from "@/app/lib/auth";

export const maxDuration = 120;

export async function POST(request) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const postId = Number(body.postId);

  if (!Number.isInteger(postId) || postId <= 0) {
    return NextResponse.json(
      { error: "postId inválido" },
      { status: 400 },
    );
  }

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { translations: { where: { lang: "es" } } },
    });

    if (!post) {
      return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });
    }

    const currentTitle =
      post.translations[0]?.title ?? "(sin título)";

    const [trending, recentPosts] = await Promise.all([
      getCrossSourceTrending(post.category),
      getRecentPosts(10),
    ]);

    const result = await generateAlternativeIdeas({
      category: post.category,
      currentTitle,
      trending,
      recentPosts,
    });

    return NextResponse.json({
      postId,
      category: post.category,
      currentTitle,
      ideas: result.ideas,
      usage: result.usage,
    });
  } catch (error) {
    console.error("Error en regenerate-ideas:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
}
