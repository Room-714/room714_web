import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { linkedInUrlFrom } from "@/app/lib/linkedin/postUrl";

export const maxDuration = 30;

// Callback que dispara Make al final de cada ruta del Router, después de
// publicar. Guarda la URL del post para que el briefing diario pueda enlazar
// directamente a él en vez de al perfil o a la página.
export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.MAKE_CALLBACK_SECRET ||
    authHeader !== `Bearer ${process.env.MAKE_CALLBACK_SECRET}`
  ) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const variantId = Number(body.variant_id);

  if (!Number.isInteger(variantId) || variantId <= 0) {
    return NextResponse.json(
      { error: "variant_id ausente o no es un entero positivo" },
      { status: 400 },
    );
  }

  const url = linkedInUrlFrom({
    postUrl: body.post_url,
    postUrn: body.post_urn,
  });
  if (!url) {
    return NextResponse.json(
      {
        error:
          "post_url / post_urn ausente, mal formado o de un host no permitido",
      },
      { status: 400 },
    );
  }

  const variant = await prisma.linkedInVariant.findUnique({
    where: { id: variantId },
    select: { id: true },
  });
  if (!variant) {
    return NextResponse.json(
      { error: "Variante no encontrada" },
      { status: 404 },
    );
  }

  await prisma.linkedInVariant.update({
    where: { id: variantId },
    data: { linkedinPostUrl: url },
  });

  return NextResponse.json({ ok: true, url });
}
