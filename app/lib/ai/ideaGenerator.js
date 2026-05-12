import { getAnthropicClient, MODEL } from "./anthropic";
import { EDITORIAL_GUIDE, FEW_SHOT_EXAMPLES } from "./editorialGuide";

const IDEAS_TOOL = {
  name: "propose_alternative_ideas",
  description:
    "Propone 3 ángulos alternativos de post para la misma categoría, distintos entre sí y distintos del ángulo actual.",
  input_schema: {
    type: "object",
    properties: {
      ideas: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description:
                "Título del post (estilo Room 714: punzante, no genérico).",
            },
            hook: {
              type: "string",
              description:
                "Una frase (~20-30 palabras) explicando el ángulo central: qué tensión/tendencia ataca y desde dónde.",
            },
          },
          required: ["title", "hook"],
        },
      },
    },
    required: ["ideas"],
  },
};

function buildCachedSystemBlocks() {
  const examplesText = FEW_SHOT_EXAMPLES.map(
    (ex) => `- "${ex.title_es}" (tags: ${ex.tags_es.join(", ")})`,
  ).join("\n");

  return [
    {
      type: "text",
      text: EDITORIAL_GUIDE,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `# Ejemplos de títulos publicados por Room 714 (referencia de estilo)\n\n${examplesText}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function buildUserPrompt({ category, currentTitle, trending, recentPosts }) {
  const trendingText =
    trending.length > 0
      ? trending
          .slice(0, 12)
          .map(
            (it, i) =>
              `${i + 1}. "${it.title}"${it.description ? `\n   ${it.description}` : ""}`,
          )
          .join("\n\n")
      : "(Sin tendencias disponibles para esta categoría. Usa tu criterio.)";

  const recentText =
    recentPosts.length > 0
      ? recentPosts
          .map(
            (p) =>
              `- [${p.category}] "${p.title}" (${p.date}) — tags: ${p.tags.join(", ")}`,
          )
          .join("\n")
      : "(No hay posts recientes en la BD.)";

  return `Genera **3 ángulos alternativos** de post para la categoría: **${category}**

## Ángulo actual (que el usuario quiere reemplazar)

"${currentTitle}"

El usuario ha visto este ángulo y prefiere explorar alternativas. NO repitas su tema/ángulo.

## Tendencias actuales en Medium (categoría ${category})

${trendingText}

## Posts recientes de Room 714 (NO repetir)

${recentText}

## Reglas para los 3 ángulos

- **Misma categoría**: ${category}.
- **Distintos entre sí**: cada uno debe abordar una tensión/idea diferente.
- **Distintos del ángulo actual y de los posts recientes**.
- **Concretos**: no "tendencias en IA" sino "por qué los frameworks JTBD fallan en práctica".
- Cada idea: título estilo Room 714 (punzante, contraintuitivo) + hook de una frase explicando el ángulo central.

Llama al tool propose_alternative_ideas con las 3 ideas.`;
}

export async function generateAlternativeIdeas({
  category,
  currentTitle,
  trending,
  recentPosts,
}) {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildCachedSystemBlocks(),
    tools: [IDEAS_TOOL],
    tool_choice: { type: "tool", name: "propose_alternative_ideas" },
    messages: [
      {
        role: "user",
        content: buildUserPrompt({
          category,
          currentTitle,
          trending,
          recentPosts,
        }),
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) {
    throw new Error("Claude no llamó al tool propose_alternative_ideas");
  }

  const { ideas } = toolUse.input;
  if (!Array.isArray(ideas) || ideas.length !== 3) {
    throw new Error("Respuesta inválida: se esperaban 3 ideas");
  }
  for (const idea of ideas) {
    if (!idea.title || !idea.hook) {
      throw new Error("Idea con campos faltantes (title/hook)");
    }
  }

  return {
    ideas,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens,
    },
  };
}
