import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAuthorizedAdmin } from "@/app/lib/auth";
import { getAnthropicClient, MODEL } from "@/app/lib/ai/anthropic";
import { IDEAL_CUSTOMER_PROFILE } from "@/app/data/ProspectingProfile";

export const maxDuration = 60;

// Redacta 2 opciones de comentario para un post de un prospecto.
// José pega el texto del post; nada se publica automáticamente.
//
// El contexto del prompt son los títulos y descripciones de los últimos
// artículos del blog: el comentario debe sonar a la conversación que ya
// estamos teniendo en público, no a un vendedor que aterriza de la nada.
const TOOL_SCHEMA = {
  name: "draft_comments",
  description: "Devuelve dos opciones de comentario para LinkedIn",
  input_schema: {
    type: "object",
    properties: {
      options: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description:
                "El comentario, listo para pegar. 2-4 frases, sin hashtags ni enlaces.",
            },
            approach: {
              type: "string",
              description:
                "Etiqueta corta del enfoque (ej: 'dato propio', 'matiz discrepante', 'pregunta que abre conversación')",
            },
          },
          required: ["text", "approach"],
        },
      },
    },
    required: ["options"],
  },
};

export async function POST(request) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const postText = (body.postText || "").trim();
  const prospectId = body.prospectId ? Number(body.prospectId) : null;

  if (postText.length < 40) {
    return NextResponse.json(
      { error: "Pega el texto del post del prospecto (mínimo 40 caracteres)" },
      { status: 400 },
    );
  }

  const [prospect, recentPosts] = await Promise.all([
    prospectId
      ? prisma.prospect.findUnique({ where: { id: prospectId } })
      : Promise.resolve(null),
    prisma.post.findMany({
      where: { published: true, date: { lte: new Date() } },
      orderBy: { date: "desc" },
      take: 4,
      include: { translations: { where: { lang: "es" } } },
    }),
  ]);

  const blogContext = recentPosts
    .map((p) => {
      const t = p.translations[0];
      return t ? `- "${t.title}"${t.metaDescription ? `: ${t.metaDescription}` : ""}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const prospectContext = prospect
    ? `Autor del post: ${prospect.name}${prospect.role ? `, ${prospect.role}` : ""}${prospect.company ? ` en ${prospect.company}` : ""}.${prospect.interest ? ` Servicio de Room714 que podría encajarle: ${prospect.interest}.` : ""}${prospect.notes ? ` Notas: ${prospect.notes}` : ""}`
    : "Autor del post: un cliente potencial (decisor de producto/digital).";

  const prompt = `Eres José, fundador de Room714 (estudio de producto digital: UX/UI, product management, CX research, transformación digital y desarrollo). Vas a comentar un post de LinkedIn de un cliente potencial DESDE TU PERFIL PERSONAL.

${prospectContext}

Post del prospecto:
"""
${postText.slice(0, 4000)}
"""

Lo que Room714 está publicando estas semanas (tu conversación pública, por si el post conecta con algún tema):
${blogContext || "(sin artículos recientes)"}

Nuestro cliente ideal: ${IDEAL_CUSTOMER_PROFILE.roles.join(", ")} en ${IDEAL_CUSTOMER_PROFILE.sectors.join(", ")}.

Escribe DOS opciones de comentario con enfoques distintos. Reglas duras:
- Voz José: primera persona, opinión con riesgo, referencia a lo que ves en tus propios proyectos. Nada de "nosotros" corporativo.
- Aporta valor real: un dato, una experiencia concreta, un matiz o una discrepancia razonada. PROHIBIDO el elogio genérico ("¡gran post!") y la coletilla comercial.
- NO menciones Room714, ni el blog, ni enlaces, ni ofertas de ayuda. El objetivo es que el autor mire tu perfil por interés, no que huela un pitch.
- 2 a 4 frases. Español natural, sin hashtags, sin emojis salvo que el post original los use mucho.
- Una de las dos opciones debe terminar con una pregunta que invite a responder; la otra no.`;

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "draft_comments" },
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find((c) => c.type === "tool_use");
    if (!toolUse?.input?.options) {
      throw new Error("La respuesta del modelo no trae opciones");
    }

    return NextResponse.json({
      options: toolUse.input.options,
      prospect: prospect
        ? { id: prospect.id, name: prospect.name }
        : null,
    });
  } catch (err) {
    console.error("[draft-comment] Fallo:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
