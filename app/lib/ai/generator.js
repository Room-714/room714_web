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
      meta_description_es: {
        type: "string",
        description:
          "Meta description en español (140-160 chars). Resume el ángulo central de forma punzante para CTR en Google. Sin punto final si es ajustada.",
      },
      meta_description_en: {
        type: "string",
        description: "Meta description en inglés (140-160 chars).",
      },
      linkedin_variants: {
        type: "array",
        description:
          "Exactamente 3 variantes de post nativo de LinkedIn en español que apuntan al mismo artículo del blog desde ángulos distintos. NO traducciones: tres tomas distintas sobre el mismo tema.",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            angle: {
              type: "string",
              enum: ["data", "polemica", "conclusion"],
              description:
                "Ángulo del que tira la variante. 'data': empieza con un número/hecho/cifra concreta. 'polemica': afirmación contraintuitiva o crítica con el sector. 'conclusion': lección práctica/accionable que se llevan a la oficina.",
            },
            text: {
              type: "string",
              description:
                "Post nativo de LinkedIn en español (1000-1800 chars). Empieza con un HOOK punzante en la primera línea (lo que se ve antes del 'ver más'). Tono coloquial-profesional. 3-5 párrafos cortos separados por doble salto de línea. SIN enlaces. SIN hashtags al final (van en otro campo). Termina con una pregunta o invitación a comentar. El hook debe ser ÚNICO en cada variante — distinto framing del mismo artículo.",
            },
            hashtags: {
              type: "array",
              items: { type: "string" },
              description:
                "3-5 hashtags (formato #SinEspacios). Pueden coincidir entre variantes en algunos generales; mezcla específicos (#JTBD, #ProductoDigital) con generales (#IA, #UX). Sin acentos.",
            },
            image_query: {
              type: "string",
              description:
                "Frase corta en inglés (3-6 palabras) para buscar UNA imagen en Unsplash que ilustre ESTA variante en particular. Las 3 image_query del post deben ser distintas entre sí: cada variante tira de una metáfora visual diferente para que las 3 publicaciones de LinkedIn no parezcan copia. Pensadas para devolver fotografías abstractas/profesionales, NO ilustraciones obvias del tema.",
            },
          },
          required: ["angle", "text", "hashtags", "image_query"],
        },
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
      "meta_description_es",
      "meta_description_en",
      "linkedin_variants",
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
      text: `# Ejemplos de posts publicados por Room 714 (referencia de TONO, VOZ y ÁNGULO crítico ÚNICAMENTE)\n\n**IMPORTANTE sobre estos ejemplos**: son posts cortos (350-500 palabras) de la fase anterior del blog. La nueva pauta editorial pide posts de **1500-2500 palabras** con 3-4 secciones H2 y subsecciones H3 cuando hagan falta. Usa estos ejemplos para entender el tono Room 714, las analogías ("portaaviones", "impuesto de lujo"), el ángulo crítico-pragmático y la estructura (apertura punzante, viñetas tempranas, H2 con dos puntos, blockquote opcional, cierre con CTA hacia Room 714). NO los uses como referencia de longitud — multiplica.\n\n${examplesText}`,
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
          .map((p) => {
            const slugs = [];
            if (p.slug_es) slugs.push(`slug_es: ${p.slug_es}`);
            if (p.slug_en) slugs.push(`slug_en: ${p.slug_en}`);
            return `- [${p.category}] "${p.title}" (${p.date}) — ${slugs.join(" | ")}`;
          })
          .join("\n")
      : "(No hay posts recientes en la base de datos.)";

  return `Hoy toca generar un post para la categoría: **${category}**

## Tendencias actuales en varios medios (categoría ${category})

Estos son los titulares y resúmenes de artículos que están sonando esta semana en Medium, dev.to, Hacker News, Nielsen Norman Group y/o Smashing Magazine para esta categoría. El campo "— Fuente" indica de dónde sale cada uno. ÚSALOS COMO INSPIRACIÓN TEMÁTICA, no como fuente. Identifica un tema o tensión recurrente (ojo: las ideas con más fuerza son las que aparecen en VARIOS medios) y escribe la opinión ORIGINAL de Room 714 sobre ese tema. NO copies frases, NO traduzcas artículos, NO atribuyas ideas concretas a Room 714 que sean de otros.

${trendingText}

## Posts recientes de Room 714 (NO repetir tema Y enlazar 2-3 como internal links)

${recentText}

## INTERNAL LINKING (SEO)

Dentro de content_es y content_en, **enlaza inline 2-3 posts** de la lista de arriba que tengan conexión natural con el tema que vas a escribir. Esto mejora el SEO y la experiencia del lector.

Formato exacto del enlace (HTML inline dentro de los <p> del contenido):
- En content_es: \`<a href="/es/blog/SLUG_ES">texto natural del enlace</a>\`
- En content_en: \`<a href="/en/blog/SLUG_EN">link text</a>\`

REGLAS CRÍTICAS:
- USA SOLO los slugs que aparecen literalmente en la lista de arriba (slug_es / slug_en). NO inventes ni modifiques slugs.
- El texto del enlace debe fluir natural en la frase, no ser "haz click aquí" ni el título completo.
- Coloca el enlace donde aporte contexto adicional, normalmente en el cuerpo de un párrafo de las secciones H2.
- 2 enlaces mínimo, 3 máximo. Si ninguno de los recientes encaja, NO fuerces el enlace.
- En content_en usa SOLO slugs slug_en (NO slug_es).

## Tu tarea

1. Identifica una tensión, tendencia o malentendido recurrente en los titulares de arriba (categoría ${category}).
2. Escribe un post original con la voz de Room 714, siguiendo la guía editorial y los ejemplos.
3. Asegúrate de que el tema no se solapa con los posts recientes listados.
4. Genera ambas versiones (ES y EN) coherentes pero NO traducción literal: cada una en su idioma nativo.
5. Embedde 2-3 internal links a posts recientes relacionados (sección INTERNAL LINKING).

Llama al tool create_blog_post con los campos correspondientes.`;
}

function sanitizeInvalidLinks(html, validSlugs, lang) {
  if (!html) return html;
  const prefix = `/${lang}/blog/`;
  return html.replace(
    /<a\s+href="([^"]+)"[^>]*>([^<]*)<\/a>/g,
    (match, href, text) => {
      if (!href.startsWith(prefix)) return text;
      const slug = href.slice(prefix.length).split(/[?#]/)[0];
      if (validSlugs.has(slug)) return match;
      return text;
    },
  );
}

function countInternalLinks(html, lang) {
  if (!html) return 0;
  const prefix = `/${lang}/blog/`;
  const matches = html.match(new RegExp(`<a\\s+href="${prefix}[^"]+`, "g"));
  return matches ? matches.length : 0;
}

function validateGenerated(data, { recentPosts = [] } = {}) {
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
    "meta_description_es",
    "meta_description_en",
    "linkedin_variants",
  ];
  for (const key of required) {
    if (data[key] === undefined || data[key] === null || data[key] === "") {
      throw new Error(`Campo vacío o faltante en respuesta: ${key}`);
    }
  }
  if (!Array.isArray(data.tags_es) || !Array.isArray(data.tags_en)) {
    throw new Error("tags_es y tags_en deben ser arrays");
  }
  if (
    !Array.isArray(data.linkedin_variants) ||
    data.linkedin_variants.length !== 3
  ) {
    throw new Error("linkedin_variants debe ser un array con exactamente 3 variantes");
  }
  for (const [i, v] of data.linkedin_variants.entries()) {
    if (!v.text || !v.angle || !v.image_query || !Array.isArray(v.hashtags)) {
      throw new Error(`linkedin_variants[${i}] incompleto`);
    }
  }
  if (!data.content_es.includes("<p>") || !data.content_es.includes("<h2>")) {
    throw new Error("content_es no parece HTML válido (faltan <p> o <h2>)");
  }
  if (!data.content_en.includes("<p>") || !data.content_en.includes("<h2>")) {
    throw new Error("content_en no parece HTML válido (faltan <p> o <h2>)");
  }

  const validSlugsEs = new Set(
    recentPosts.map((p) => p.slug_es).filter(Boolean),
  );
  const validSlugsEn = new Set(
    recentPosts.map((p) => p.slug_en).filter(Boolean),
  );
  data.content_es = sanitizeInvalidLinks(data.content_es, validSlugsEs, "es");
  data.content_en = sanitizeInvalidLinks(data.content_en, validSlugsEn, "en");
  data.internalLinks = {
    es: countInternalLinks(data.content_es, "es"),
    en: countInternalLinks(data.content_en, "en"),
  };

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
          .map((p) => {
            const slugs = [];
            if (p.slug_es) slugs.push(`slug_es: ${p.slug_es}`);
            if (p.slug_en) slugs.push(`slug_en: ${p.slug_en}`);
            return `- [${p.category}] "${p.title}" (${p.date}) — ${slugs.join(" | ")}`;
          })
          .join("\n")
      : "(No hay posts recientes en la BD.)";

  return `Hoy toca generar un post para la categoría: **${category}**

## IDEA ELEGIDA POR EL USUARIO (este es el ángulo a desarrollar)

**Título orientativo:** "${chosenIdea.title}"

**Ángulo central:** ${chosenIdea.hook}

Tu trabajo es desarrollar exactamente este ángulo en un post completo siguiendo la guía editorial Room 714. El título final puede ser igual o una variante mejorada del orientativo. NO cambies el ángulo.

## Tendencias actuales en varios medios (categoría ${category}) — contexto adicional

${trendingText}

## Posts recientes de Room 714 (NO repetir tema Y enlazar 2-3 como internal links)

${recentText}

## INTERNAL LINKING (SEO)

Dentro de content_es y content_en, **enlaza inline 2-3 posts** de la lista de arriba que tengan conexión natural con el tema. Formato exacto:
- En content_es: \`<a href="/es/blog/SLUG_ES">texto natural</a>\`
- En content_en: \`<a href="/en/blog/SLUG_EN">link text</a>\`

USA SOLO los slugs literales de la lista (slug_es / slug_en). NO inventes. 1-2 enlaces; si ninguno encaja con naturalidad, NO fuerces.

## Tu tarea

1. Desarrolla el ángulo elegido en un post completo siguiendo la guía editorial.
2. Genera ambas versiones (ES y EN) coherentes pero NO traducción literal: cada una en su idioma nativo.
3. Asegúrate de que no se solapa con los posts recientes listados.
4. Embedde 2-3 internal links a posts recientes relacionados (sección INTERNAL LINKING).

Llama al tool create_blog_post con los campos correspondientes.`;
}

export async function generatePostDraft({ category, trending, recentPosts }) {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
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

  const validated = validateGenerated(toolUse.input, { recentPosts });

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
    max_tokens: 16000,
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

  const validated = validateGenerated(toolUse.input, { recentPosts });

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
