import { getAnthropicClient, MODEL } from "./anthropic";
import { EDITORIAL_GUIDE, FEW_SHOT_EXAMPLES } from "./editorialGuide";

const OUTPUT_SCHEMA = `Devuelve EXCLUSIVAMENTE un objeto JSON válido (sin markdown, sin texto antes ni después) con esta forma exacta:

{
  "title_es": "string",
  "title_en": "string",
  "slug_es": "string",
  "slug_en": "string",
  "tags_es": ["string", ...],
  "tags_en": ["string", ...],
  "content_es": "string con HTML",
  "content_en": "string con HTML",
  "image_query": "string en inglés"
}`;

function buildCachedSystemBlocks() {
  const examplesText = FEW_SHOT_EXAMPLES.map(
    (ex, i) => `## Ejemplo ${i + 1} (categoría ${ex.category})

Título: ${ex.title_es}
Tags: ${ex.tags_es.join(", ")}
Image query: ${ex.image_query}

Contenido HTML:
${ex.content_es}`,
  ).join("\n\n---\n\n");

  return [
    {
      type: "text",
      text: EDITORIAL_GUIDE,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `# Ejemplos de posts publicados por Room 714 (referencia de tono y estructura)

${examplesText}`,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: `# Formato de salida\n\n${OUTPUT_SCHEMA}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function buildUserPrompt({ category, trending, recentPosts }) {
  const trendingText =
    trending.length > 0
      ? trending
          .slice(0, 12)
          .map(
            (it, i) =>
              `${i + 1}. "${it.title}"${it.description ? `\n   ${it.description}` : ""}`,
          )
          .join("\n\n")
      : "(No se pudieron obtener artículos en tendencia para esta categoría. Usa tu criterio editorial.)";

  const recentText =
    recentPosts.length > 0
      ? recentPosts
          .map(
            (p) =>
              `- [${p.category}] "${p.title}" (${p.date}) — tags: ${p.tags.join(", ")}`,
          )
          .join("\n")
      : "(No hay posts recientes en la base de datos.)";

  return `Hoy toca generar un post para la categoría: **${category}**

## Tendencias actuales en Medium (categoría ${category})

Estos son los titulares y resúmenes de artículos que están sonando esta semana en Medium para los tags relacionados. ÚSALOS COMO INSPIRACIÓN TEMÁTICA, no como fuente. Identifica un tema o tensión recurrente y escribe la opinión ORIGINAL de Room 714 sobre ese tema. NO copies frases, NO traduzcas artículos, NO atribuyas ideas concretas a Room 714 que sean de otros.

${trendingText}

## Posts recientes de Room 714 (NO repetir tema)

${recentText}

## Tu tarea

1. Identifica una tensión, tendencia o malentendido recurrente en los titulares de arriba (categoría ${category}).
2. Escribe un post original con la voz de Room 714, siguiendo la guía editorial y los ejemplos.
3. Asegúrate de que el tema no se solapa con los posts recientes listados.
4. Genera ambas versiones (ES y EN) coherentes pero NO traducción literal: cada una en su idioma nativo.

Recuerda: salida en JSON puro, sin markdown alrededor.`;
}

function extractJsonFromText(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Respuesta de Claude no contiene JSON parseable");
  }
  return JSON.parse(match[0]);
}

function validateGenerated(data) {
  const required = [
    "title_es",
    "title_en",
    "slug_es",
    "slug_en",
    "tags_es",
    "tags_en",
    "content_es",
    "content_en",
    "image_query",
  ];
  for (const key of required) {
    if (!data[key]) throw new Error(`Falta campo en respuesta: ${key}`);
  }
  if (!Array.isArray(data.tags_es) || !Array.isArray(data.tags_en)) {
    throw new Error("tags_es y tags_en deben ser arrays");
  }
  if (!data.content_es.includes("<p>") || !data.content_es.includes("<h2>")) {
    throw new Error("content_es no parece HTML válido (faltan <p> o <h2>)");
  }
  return data;
}

export async function generatePostDraft({ category, trending, recentPosts }) {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildCachedSystemBlocks(),
    messages: [
      {
        role: "user",
        content: buildUserPrompt({ category, trending, recentPosts }),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("Respuesta de Claude sin bloque de texto");

  const parsed = extractJsonFromText(textBlock.text);
  const validated = validateGenerated(parsed);

  return {
    ...validated,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens,
    },
  };
}
