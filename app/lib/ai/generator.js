import { getAnthropicClient, MODEL } from "./anthropic";
import { EDITORIAL_GUIDE, FEW_SHOT_EXAMPLES } from "./editorialGuide";

const POST_TOOL = {
  name: "create_blog_post",
  description:
    "Crea un post de blog de Room 714 en español e inglés siguiendo la guía editorial.",
  input_schema: {
    type: "object",
    properties: {
      title_es: {
        type: "string",
        description: "Título en español. Punzante, no genérico.",
      },
      title_en: {
        type: "string",
        description: "Título en inglés. No traducción literal del ES.",
      },
      slug_es: {
        type: "string",
        description:
          "Slug URL en español. Minúsculas, guiones, sin acentos, máx 70 chars.",
      },
      slug_en: {
        type: "string",
        description: "Slug URL en inglés. Mismo formato que slug_es.",
      },
      tags_es: {
        type: "array",
        items: { type: "string" },
        description: "3-5 tags en español, minúsculas, sin acentos.",
      },
      tags_en: {
        type: "array",
        items: { type: "string" },
        description: "3-5 tags en inglés, minúsculas.",
      },
      content_es: {
        type: "string",
        description:
          "Contenido HTML en español compatible con TipTap. Usa <p>, <h2>, <ul><li>, <blockquote>, <strong>. NO incluyas el título.",
      },
      content_en: {
        type: "string",
        description: "Contenido HTML en inglés, mismo formato que content_es.",
      },
      image_query: {
        type: "string",
        description:
          "Frase corta en inglés (3-6 palabras) para buscar imagen en Unsplash.",
      },
    },
    required: [
      "title_es",
      "title_en",
      "slug_es",
      "slug_en",
      "tags_es",
      "tags_en",
      "content_es",
      "content_en",
      "image_query",
    ],
  },
};

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
      text: `# Ejemplos de posts publicados por Room 714 (referencia de tono y estructura)\n\n${examplesText}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function formatTrendingItem(it, i) {
  const source = it.source ? ` — ${it.source}` : "";
  const desc = it.description ? `\n   ${it.description}` : "";
  return `${i + 1}. "${it.title}"${source}${desc}`;
}

function buildUserPrompt({ category, trending, recentPosts }) {
  const trendingText =
    trending.length > 0
      ? trending.slice(0, 18).map(formatTrendingItem).join("\n\n")
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

## Tendencias actuales en varios medios (categoría ${category})

Estos son los titulares y resúmenes de artículos que están sonando esta semana en Medium, dev.to, Hacker News, Nielsen Norman Group y/o Smashing Magazine para esta categoría. El campo "— Fuente" indica de dónde sale cada uno. ÚSALOS COMO INSPIRACIÓN TEMÁTICA, no como fuente. Identifica un tema o tensión recurrente (ojo: las ideas con más fuerza son las que aparecen en VARIOS medios) y escribe la opinión ORIGINAL de Room 714 sobre ese tema. NO copies frases, NO traduzcas artículos, NO atribuyas ideas concretas a Room 714 que sean de otros.

${trendingText}

## Posts recientes de Room 714 (NO repetir tema)

${recentText}

## Tu tarea

1. Identifica una tensión, tendencia o malentendido recurrente en los titulares de arriba (categoría ${category}).
2. Escribe un post original con la voz de Room 714, siguiendo la guía editorial y los ejemplos.
3. Asegúrate de que el tema no se solapa con los posts recientes listados.
4. Genera ambas versiones (ES y EN) coherentes pero NO traducción literal: cada una en su idioma nativo.

Llama al tool create_blog_post con los campos correspondientes.`;
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
    if (data[key] === undefined || data[key] === null || data[key] === "") {
      throw new Error(`Campo vacío o faltante en respuesta: ${key}`);
    }
  }
  if (!Array.isArray(data.tags_es) || !Array.isArray(data.tags_en)) {
    throw new Error("tags_es y tags_en deben ser arrays");
  }
  if (!data.content_es.includes("<p>") || !data.content_es.includes("<h2>")) {
    throw new Error("content_es no parece HTML válido (faltan <p> o <h2>)");
  }
  if (!data.content_en.includes("<p>") || !data.content_en.includes("<h2>")) {
    throw new Error("content_en no parece HTML válido (faltan <p> o <h2>)");
  }
  return data;
}

function buildUserPromptFromIdea({ category, chosenIdea, trending, recentPosts }) {
  const trendingText =
    trending.length > 0
      ? trending.slice(0, 10).map(formatTrendingItem).join("\n\n")
      : "(Sin tendencias disponibles. Apóyate solo en la idea elegida.)";

  const recentText =
    recentPosts.length > 0
      ? recentPosts
          .map(
            (p) =>
              `- [${p.category}] "${p.title}" (${p.date}) — tags: ${p.tags.join(", ")}`,
          )
          .join("\n")
      : "(No hay posts recientes en la BD.)";

  return `Hoy toca generar un post para la categoría: **${category}**

## IDEA ELEGIDA POR EL USUARIO (este es el ángulo a desarrollar)

**Título orientativo:** "${chosenIdea.title}"

**Ángulo central:** ${chosenIdea.hook}

Tu trabajo es desarrollar exactamente este ángulo en un post completo siguiendo la guía editorial Room 714. El título final puede ser igual o una variante mejorada del orientativo. NO cambies el ángulo.

## Tendencias actuales en varios medios (categoría ${category}) — contexto adicional

${trendingText}

## Posts recientes de Room 714 (NO repetir tema)

${recentText}

## Tu tarea

1. Desarrolla el ángulo elegido en un post completo siguiendo la guía editorial.
2. Genera ambas versiones (ES y EN) coherentes pero NO traducción literal: cada una en su idioma nativo.
3. Asegúrate de que no se solapa con los posts recientes listados.

Llama al tool create_blog_post con los campos correspondientes.`;
}

export async function generatePostDraft({ category, trending, recentPosts }) {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildCachedSystemBlocks(),
    tools: [POST_TOOL],
    tool_choice: { type: "tool", name: "create_blog_post" },
    messages: [
      {
        role: "user",
        content: buildUserPrompt({ category, trending, recentPosts }),
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) {
    throw new Error("Claude no llamó al tool create_blog_post");
  }

  const validated = validateGenerated(toolUse.input);

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

export async function generatePostFromIdea({
  category,
  chosenIdea,
  trending,
  recentPosts,
}) {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: buildCachedSystemBlocks(),
    tools: [POST_TOOL],
    tool_choice: { type: "tool", name: "create_blog_post" },
    messages: [
      {
        role: "user",
        content: buildUserPromptFromIdea({
          category,
          chosenIdea,
          trending,
          recentPosts,
        }),
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) {
    throw new Error("Claude no llamó al tool create_blog_post");
  }

  const validated = validateGenerated(toolUse.input);

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
