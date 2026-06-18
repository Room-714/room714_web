import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAuthorizedAdmin } from "@/app/lib/auth";
import { getAnthropicClient, MODEL } from "@/app/lib/ai/anthropic";

export const maxDuration = 300;

const ANALYSIS_TOOL = {
  name: "submit_consolidation_analysis",
  description:
    "Devuelve el análisis de consolidación del blog: grupos de posts solapados temáticamente y posts débiles candidatos a podar.",
  input_schema: {
    type: "object",
    properties: {
      clusters: {
        type: "array",
        description:
          "Grupos de 2+ posts que tratan el mismo tema desde ángulos demasiado parecidos. Candidatos a fusionar.",
        items: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "Tema unificado del cluster en una frase corta.",
            },
            postIds: {
              type: "array",
              items: { type: "integer" },
              minItems: 2,
            },
            recommendation: {
              type: "string",
              description:
                "Qué hacer con el cluster: cuál mantener como canonical y cuáles podar. Sé específico mencionando ids.",
            },
            survivorId: {
              type: "integer",
              description:
                "ID del post que debe sobrevivir como canonical (el más completo / mejor escrito del cluster).",
            },
          },
          required: ["topic", "postIds", "recommendation", "survivorId"],
        },
      },
      weakPosts: {
        type: "array",
        description:
          "Posts individuales débiles candidatos a podar: contenido fino, ángulo flojo, tema agotado o repetido sin aportar.",
        items: {
          type: "object",
          properties: {
            postId: { type: "integer" },
            reason: { type: "string" },
            suggestedRedirectId: {
              type: ["integer", "null"],
              description:
                "Si hay un post existente al que redirigir tras podarlo (más actual o mejor escrito sobre el mismo tema), su id. null si no hay redirect razonable.",
            },
          },
          required: ["postId", "reason", "suggestedRedirectId"],
        },
      },
    },
    required: ["clusters", "weakPosts"],
  },
};

function buildPostsBlock(posts) {
  return posts
    .map((p) => {
      const meta = p.metaDescription
        ? p.metaDescription.slice(0, 150)
        : (p.content || "").replace(/<[^>]*>/g, " ").slice(0, 150);
      const wordCount = (p.content || "")
        .replace(/<[^>]*>/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
      return `- id=${p.id} | cat=${p.category} | "${p.title}" (slug: ${p.slug}) — ${wordCount} palabras — "${meta}"`;
    })
    .join("\n");
}

export async function POST(request) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const category = body.category || null;

  const now = new Date();
  const posts = await prisma.post.findMany({
    where: {
      published: true,
      date: { lte: now },
      ...(category ? { category } : {}),
    },
    include: { translations: { where: { lang: "es" } } },
    orderBy: { date: "desc" },
  });

  const flat = posts
    .map((p) => {
      const t = p.translations[0];
      if (!t) return null;
      return {
        id: p.id,
        category: p.category,
        date: p.date,
        title: t.title,
        slug: t.slug,
        content: t.content,
        metaDescription: t.metaDescription,
      };
    })
    .filter(Boolean);

  if (flat.length < 5) {
    return NextResponse.json({
      message: "Menos de 5 posts: nada que consolidar todavía",
      totalPosts: flat.length,
    });
  }

  const userPrompt = `Eres un editor jefe de Room 714, una consultora de producto digital, IA, UX y diseño con sede en España. Tu tarea es identificar oportunidades de consolidación en el blog: posts que se solapan y deberían fusionarse, y posts débiles que vale más podar.

## Catálogo de posts publicados (${flat.length} en total)

${buildPostsBlock(flat)}

## Reglas de análisis

**Clusters (fusión)**: agrupa 2+ posts que traten el mismo tema desde ángulos demasiado parecidos. El criterio no es la categoría — dos posts pueden estar en TECH y PRODUCT y aún así solaparse. Mira el tema real:
- "El MVP ha muerto" + "MVP vs Minimum Lovable Product" + "Por qué el MVP está obsoleto" → mismo tema, fusionar.
- "Diseño emocional" + "Aesthetic vs usability" → distintos ángulos, NO solapan.

Para cada cluster, designa un survivorId: el post más completo, mejor escrito, o más reciente. El resto del cluster se podará con redirect al survivor.

**Posts débiles (podar)**: posts individuales que no merecen seguir vivos. Criterios:
- Contenido muy corto (<800 palabras) cuando el tema aguantaba más.
- Ángulo flojo o conclusión tibia.
- Tema agotado o muy reciclado sin aportar nada.
- meta description débil o ausente.

Para cada uno, indica suggestedRedirectId si hay otro post razonable al que redirigir (debe existir en el catálogo). Si no hay redirect razonable, suggestedRedirectId = null.

**No mezcles los dos**: un post que forma parte de un cluster NO debe aparecer también en weakPosts.

Sé conservador. Es mejor consolidar 5 grupos sólidos que proponer 30 fusiones dudosas. Si un post se sostiene por sí mismo, déjalo fuera de los dos listados.

Llama a submit_consolidation_analysis con el resultado.`;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: "submit_consolidation_analysis" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) {
    return NextResponse.json(
      { error: "AI no devolvió tool_use" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    totalPosts: flat.length,
    categoryFilter: category,
    ...toolUse.input,
  });
}
