import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAuthorizedAdmin } from "@/app/lib/auth";

export const maxDuration = 60;

export async function POST(request) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const postId = Number(body.postId);
  const redirectToPostId = body.redirectToPostId
    ? Number(body.redirectToPostId)
    : null;
  const reason = body.reason || null;

  if (!postId) {
    return NextResponse.json(
      { error: "postId requerido" },
      { status: 400 },
    );
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { translations: true },
  });
  if (!post) {
    return NextResponse.json({ error: "Post no encontrado" }, { status: 404 });
  }

  let target = null;
  if (redirectToPostId) {
    target = await prisma.post.findUnique({
      where: { id: redirectToPostId },
      include: { translations: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "redirectToPostId no encontrado" },
        { status: 400 },
      );
    }
    if (target.id === post.id) {
      return NextResponse.json(
        { error: "El redirect no puede apuntar al mismo post" },
        { status: 400 },
      );
    }
  }

  const redirectsCreated = [];
  let chainsUpdated = 0;

  try {
    for (const tr of post.translations) {
      const targetSlug = target
        ? target.translations.find((t) => t.lang === tr.lang)?.slug || null
        : null;

      // 1. Crear/actualizar el redirect del slug que se borra hacia el target.
      await prisma.postRedirect.upsert({
        where: {
          fromSlug_lang: { fromSlug: tr.slug, lang: tr.lang },
        },
        update: { toSlug: targetSlug, reason },
        create: {
          fromSlug: tr.slug,
          toSlug: targetSlug,
          lang: tr.lang,
          reason,
        },
      });
      redirectsCreated.push({
        fromSlug: tr.slug,
        lang: tr.lang,
        toSlug: targetSlug,
      });

      // 2. Si había redirects previos apuntando al slug que ahora se borra,
      //    re-apuntarlos al nuevo target. Esto evita cadenas A→B→C cuando
      //    B se poda con destino C.
      const updated = await prisma.postRedirect.updateMany({
        where: {
          toSlug: tr.slug,
          lang: tr.lang,
          NOT: { fromSlug: tr.slug },
        },
        data: { toSlug: targetSlug },
      });
      chainsUpdated += updated.count;
    }

    await prisma.post.delete({ where: { id: post.id } });

    return NextResponse.json({
      success: true,
      deletedPostId: post.id,
      redirectsCreated,
      chainsUpdated,
    });
  } catch (err) {
    console.error("[prune-post] Fallo:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
