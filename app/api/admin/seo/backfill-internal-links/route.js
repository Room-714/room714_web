import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAuthorizedAdmin } from "@/app/lib/auth";
import { computeOutboundLinksForPost } from "@/app/lib/ai/internalLinker";

export const maxDuration = 300;

const LINK_RE_ES = /<a\s+href="\/es\/blog\/[^"]+"/g;

// Pasada retroactiva de enlaces salientes: para los posts "huérfanos" (0
// enlaces internos salientes en su contenido ES), añade 2-3 enlaces a posts
// relacionados de su categoría.
//
// SEGURO POR DEFECTO: sin `confirm: true` hace dry-run (calcula con IA qué
// enlaces pondría y los devuelve, pero NO escribe en BD). Procesa `limit`
// posts por llamada (empieza pequeño para validar calidad/coste).
export async function POST(request) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const confirm = body.confirm === true;
  const limit = Number.isInteger(body.limit) ? body.limit : 5;
  const onlyIds = Array.isArray(body.postIds)
    ? body.postIds.map(Number).filter(Number.isInteger)
    : null;

  const posts = await prisma.post.findMany({
    where: { published: true, date: { lte: new Date() } },
    include: { translations: true },
    orderBy: { date: "desc" },
  });

  // Huérfanos: 0 enlaces salientes en el contenido ES.
  let orphans = posts.filter((p) => {
    const es = p.translations.find((t) => t.lang === "es");
    return ((es?.content || "").match(LINK_RE_ES)?.length || 0) === 0;
  });
  if (onlyIds) orphans = orphans.filter((p) => onlyIds.includes(p.id));

  const totalOrphans = orphans.length;
  const batch = orphans.slice(0, limit);

  const results = [];
  let edited = 0;
  let linksAdded = 0;

  for (const post of batch) {
    const es = post.translations.find((t) => t.lang === "es");
    const en = post.translations.find((t) => t.lang === "en");

    let out;
    try {
      out = await computeOutboundLinksForPost({
        postId: post.id,
        category: post.category,
        contentEs: es?.content || "",
        contentEn: en?.content || "",
      });
    } catch (err) {
      results.push({ id: post.id, title: es?.title, error: err.message });
      continue;
    }

    if (confirm && out.added.length > 0 && es && en) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          updatedAt: new Date(),
          translations: {
            update: [
              { where: { id: es.id }, data: { content: out.contentEs } },
              { where: { id: en.id }, data: { content: out.contentEn } },
            ],
          },
        },
      });
      edited++;
    }

    linksAdded += out.added.length;
    results.push({
      id: post.id,
      title: es?.title,
      category: post.category,
      added: out.added,
      skipped: out.skipped,
    });
  }

  return NextResponse.json({
    dryRun: !confirm,
    message: confirm
      ? "Enlaces salientes aplicados a los posts huérfanos del lote."
      : "Dry-run: nada modificado. Revisa 'added' y reenvía con { confirm: true }.",
    totalOrphans,
    processed: batch.length,
    edited,
    linksAdded,
    results,
  });
}
