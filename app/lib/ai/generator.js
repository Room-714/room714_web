import { getAnthropicClient, MODEL } from "./anthropic";
import { EDITORIAL_GUIDE, FEW_SHOT_EXAMPLES, LINKEDIN_GUIDE } from "./editorialGuide";

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

const CROSS_ACTION_BRIEF = {
  comment_personal:
    "COMENTARIO DE JOSÉ. Esta variante la publica la página de Room714, y José comenta debajo desde su perfil personal. Escribe en cross_note ese comentario: 1-2 frases en primera persona que APORTEN un dato, un matiz o un contraejemplo que no esté en el post. Prohibido el elogio genérico tipo 'gran reflexión'.",
  reshare_company:
    "RECOMPARTICIÓN DE ROOM714. Esta variante la publica José desde su perfil, y la página de Room714 la recomparte. Escribe en cross_note la línea con la que la página lo comparte: 1-2 frases en voz corporativa de Room714, que enmarquen por qué el tema importa. NO repitas el hook del post.",
};

// Corpus completo agrupado por categoría. Con más de 75 artículos publicados,
// pasarle al modelo solo los 10 recientes dejaba libre cualquier tema de hace
// más de cinco semanas, y Google ya marcó varios pares como duplicados.
function buildPublishedCorpusBlock(publishedCorpus) {
  if (!publishedCorpus?.length) return "";

  const byCategory = new Map();
  for (const post of publishedCorpus) {
    const list = byCategory.get(post.category) || [];
    const title = post.title_es || post.title_en || "(sin título)";
    const tags = post.tags?.length ? ` [${post.tags.join(", ")}]` : "";
    list.push(`- "${title}" (${post.date})${tags}`);
    byCategory.set(post.category, list);
  }

  const sections = [...byCategory.entries()]
    .map(([cat, lines]) => `### ${cat}\n${lines.join("\n")}`)
    .join("\n\n");

  return `

## Corpus ya publicado — NO repitas ninguno de estos ángulos

Estos son TODOS los artículos que Room714 ya ha publicado. Antes de elegir tu tema, compruébalo contra esta lista. Si tu idea comparte la tesis central con cualquiera de ellos, descártala y elige otra, aunque el enfoque o el título sean distintos. Reescribir un ángulo ya publicado hace que Google trate ambos como duplicados y no indexe ninguno.

${sections}`;
}

// Exportada solo para poder probarla; el flujo normal entra por
// generatePostDraft.
export function buildUserPrompt({
  category,
  trending,
  recentPosts,
  publishedCorpus,
}) {
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

Llama al tool create_blog_post con los campos correspondientes.${buildPublishedCorpusBlock(publishedCorpus)}`;
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

// Presupuesto de tokens de salida para el artículo (ES + EN, 1500-2500 palabras
// cada uno). Las tomas de LinkedIn ya no van en esta llamada: se generan aparte
// en generateLinkedInTakes.
const MAX_OUTPUT_TOKENS = 32000;

// 2 intentos = 1 reintento. Cada intento es una generación completa (streaming,
// ~1-2 min), así que dos caben holgados en el maxDuration=300 de las rutas
// cron/admin. Cubre truncados puntuales y no-conformidades del modelo (el
// schema del tool no se valida solo en tool use, así que validateGenerated es
// la única garantía de que el post llega completo).
const MAX_GENERATION_ATTEMPTS = 2;

// Llama al tool create_blog_post con streaming (obligatorio por encima de ~16k
// tokens para no chocar con el timeout HTTP del SDK), detecta el truncado por
// max_tokens de forma explícita y reintenta si la generación no valida.
async function generateViaCreateBlogPostTool({ userPrompt, recentPosts }) {
  const client = getAnthropicClient();
  let lastError;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    let response;
    try {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: buildCachedSystemBlocks(),
        tools: [POST_TOOL],
        tool_choice: { type: "tool", name: "create_blog_post" },
        messages: [{ role: "user", content: userPrompt }],
      });
      response = await stream.finalMessage();
    } catch (err) {
      lastError = err;
      console.error(
        `generatePost intento ${attempt}/${MAX_GENERATION_ATTEMPTS} — error de API: ${err.message}`,
      );
      continue;
    }

    // El truncado por presupuesto de tokens deja el JSON del tool a medias
    // (típicamente cortando content_es/content_en a mitad de frase). Detectarlo
    // aquí evita el fallo confuso de "content_es no parece HTML válido".
    if (response.stop_reason === "max_tokens") {
      lastError = new Error(
        `Respuesta truncada por max_tokens (output_tokens=${response.usage?.output_tokens}). ` +
          `El post no cupo en ${MAX_OUTPUT_TOKENS} tokens.`,
      );
      console.error(
        `generatePost intento ${attempt}/${MAX_GENERATION_ATTEMPTS}: ${lastError.message}`,
      );
      continue;
    }

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse) {
      lastError = new Error("Claude no llamó al tool create_blog_post");
      console.error(
        `generatePost intento ${attempt}/${MAX_GENERATION_ATTEMPTS}: ${lastError.message}`,
      );
      continue;
    }

    try {
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
    } catch (err) {
      lastError = err;
      console.error(
        `generatePost intento ${attempt}/${MAX_GENERATION_ATTEMPTS} — validación falló: ${err.message}`,
      );
    }
  }

  throw new Error(
    `No se pudo generar un borrador válido tras ${MAX_GENERATION_ATTEMPTS} intentos: ${lastError?.message}`,
  );
}

export async function generatePostDraft({
  category,
  trending,
  recentPosts,
  publishedCorpus,
}) {
  const userPrompt = buildUserPrompt({
    category,
    trending,
    recentPosts,
    publishedCorpus,
  });
  return generateViaCreateBlogPostTool({ userPrompt, recentPosts });
}

export async function generatePostFromIdea({
  category,
  chosenIdea,
  trending,
  recentPosts,
}) {
  const userPrompt = buildUserPromptFromIdea({
    category,
    chosenIdea,
    trending,
    recentPosts,
  });
  return generateViaCreateBlogPostTool({ userPrompt, recentPosts });
}

/* ─── Tomas de LinkedIn ──────────────────────────────────────────────────────
 * Se generan APARTE del artículo y DESPUÉS de él, a las 08:30, leyendo el
 * texto tal y como haya quedado tras la revisión manual. Antes salían en la
 * misma llamada que el artículo, del borrador sin revisar.
 * ────────────────────────────────────────────────────────────────────────── */

const TAKES_TOOL = {
  name: "create_linkedin_takes",
  description:
    "Escribe las tomas de LinkedIn de un artículo ya publicado de Room 714.",
  input_schema: {
    type: "object",
    properties: {
      takes: {
        type: "array",
        description:
          "Tomas de post nativo de LinkedIn en español sobre el mismo artículo, cada una desde un ángulo distinto. NO son traducciones ni resúmenes: son tomas distintas sobre el mismo tema.",
        items: {
          type: "object",
          properties: {
            angle: {
              type: "string",
              enum: ["data", "polemica", "conclusion"],
              description:
                "Ángulo del que tira la toma. 'data': empieza con un número o hecho concreto. 'polemica': afirmación contraintuitiva o crítica con el sector. 'conclusion': lección práctica que se llevan a la oficina.",
            },
            text: {
              type: "string",
              description:
                "Post nativo de LinkedIn en español (1000-1800 chars). Empieza con un HOOK punzante en la primera línea (lo que se ve antes del 'ver más'). Tono coloquial-profesional. 3-5 párrafos cortos separados por doble salto de línea. SIN enlaces. SIN hashtags al final (van en otro campo). Termina con una pregunta o invitación a comentar. El hook debe ser ÚNICO en cada toma.",
            },
            hashtags: {
              type: "array",
              items: { type: "string" },
              description:
                "3-5 hashtags (formato #SinEspacios). Mezcla específicos (#JTBD, #ProductoDigital) con generales (#IA, #UX). Sin acentos.",
            },
            image_query: {
              type: "string",
              description:
                "Frase corta en inglés (3-6 palabras) para buscar UNA imagen en Unsplash que ilustre ESTA toma. Las image_query de un mismo artículo deben ser distintas entre sí para que las publicaciones no parezcan copia. Fotografía abstracta o profesional, NO ilustración obvia del tema.",
            },
            cross_note: {
              type: "string",
              description:
                "Texto sugerido para la ACCIÓN CRUZADA de esta toma (te la indico en el prompt). Máximo 2 frases. Si no tiene acción cruzada, cadena vacía.",
            },
          },
          required: ["angle", "text", "hashtags", "image_query"],
        },
      },
    },
    required: ["takes"],
  },
};

// Exportada para poder probarla; el flujo normal entra por generateLinkedInTakes.
export function buildTakesPrompt({
  articleTitle,
  articleContentEs,
  articleUrl,
  count,
  crossActions = [],
}) {
  const crossBlock = crossActions.slice(0, count).some(Boolean)
    ? `

## ACCIONES CRUZADAS (campo cross_note de cada toma)

Cada toma se publica en una sola cuenta y lleva una acción en la otra. Rellena cross_note según lo que le toque a cada una:

${crossActions
  .slice(0, count)
  .map((action, i) =>
    action
      ? `- Toma ${i + 1}: ${CROSS_ACTION_BRIEF[action]}`
      : `- Toma ${i + 1}: sin acción cruzada. Deja cross_note como cadena vacía.`,
  )
  .join("\n")}`
    : "";

  return `Este artículo acaba de publicarse en el blog de Room 714. Escribe **exactamente ${count} tomas** de LinkedIn que apunten a él desde ángulos distintos.

## Artículo

**Título:** ${articleTitle}

**URL:** ${articleUrl}

**Contenido:**

${articleContentEs}

## Tu tarea

1. Lee el artículo y quédate con sus ${count} ideas más fuertes: una por toma.
2. Escribe cada toma como post nativo de LinkedIn con la voz de Room 714 — la misma del artículo: crítica, pragmática, con analogías concretas y sin tono de nota de prensa.
3. Cada toma tiene que sostenerse sola: quien lea solo esa debe llevarse una idea completa, no un anzuelo vacío.
4. Los hooks de las ${count} tomas tienen que ser claramente distintos entre sí. Se publican en días diferentes de la misma semana y las lee la misma gente.
5. NO metas la URL en el texto: el enlace va aparte.

Llama al tool create_linkedin_takes con las ${count} tomas.${crossBlock}`;
}

// Exportada para poder probarla.
export function validateTakes(data, count) {
  if (!Array.isArray(data?.takes)) {
    throw new Error(
      `takes debe ser un array con exactamente ${count} tomas (llegó ${typeof data?.takes})`,
    );
  }

  // De menos no hay nada que hacer: una toma no se inventa, hay que reintentar.
  if (data.takes.length < count) {
    throw new Error(
      `takes debe ser un array con exactamente ${count} tomas (llegaron ${data.takes.length})`,
    );
  }

  // De más sí: las primeras `count` son las que llevan briefing de acción
  // cruzada (el prompt las numera "Toma 1", "Toma 2"…), así que quedarse con
  // ellas conserva el alineamiento. Recortar cuesta una línea; reintentar
  // cuesta una generación entera y arriesga quedarse sin publicaciones.
  if (data.takes.length > count) {
    console.warn(
      `validateTakes: llegaron ${data.takes.length} tomas y se pidieron ${count}; se recortan las sobrantes`,
    );
    data.takes = data.takes.slice(0, count);
  }

  for (const [i, t] of data.takes.entries()) {
    if (!t.text || !t.angle || !t.image_query || !Array.isArray(t.hashtags)) {
      throw new Error(`takes[${i}] incompleto`);
    }
  }
  return data;
}

// Presupuesto holgado: tres posts de 1800 caracteres son ~1.500 tokens. 8k deja
// margen de sobra sin acercarse al timeout HTTP del SDK en modo no-streaming.
const MAX_TAKES_OUTPUT_TOKENS = 8000;

// Bloque de sistema propio. NO se reutiliza buildCachedSystemBlocks(): aquel
// lleva la guía del artículo, que pide 1500-2500 palabras, HTML de TipTap y
// enlaces internos obligatorios — nada de eso aplica a una toma de LinkedIn.
//
// Sin cache_control a propósito: son unos 900 tokens, por debajo del mínimo
// cacheable, y la llamada corre dos veces por semana con más de una hora entre
// una y otra, así que no habría lectura que amortizara la escritura.
function buildTakesSystemBlocks() {
  return [{ type: "text", text: LINKEDIN_GUIDE }];
}

export async function generateLinkedInTakes({
  articleTitle,
  articleContentEs,
  articleUrl,
  count,
  crossActions,
}) {
  const client = getAnthropicClient();
  const userPrompt = buildTakesPrompt({
    articleTitle,
    articleContentEs,
    articleUrl,
    count,
    crossActions,
  });

  let lastError;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TAKES_OUTPUT_TOKENS,
        system: buildTakesSystemBlocks(),
        tools: [TAKES_TOOL],
        tool_choice: { type: "tool", name: "create_linkedin_takes" },
        messages: [{ role: "user", content: userPrompt }],
      });
    } catch (err) {
      lastError = err;
      console.error(
        `generateLinkedInTakes intento ${attempt}/${MAX_GENERATION_ATTEMPTS} — error de API: ${err.message}`,
      );
      continue;
    }

    if (response.stop_reason === "max_tokens") {
      lastError = new Error(
        `Respuesta truncada por max_tokens (output_tokens=${response.usage?.output_tokens})`,
      );
      console.error(
        `generateLinkedInTakes intento ${attempt}/${MAX_GENERATION_ATTEMPTS}: ${lastError.message}`,
      );
      continue;
    }

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse) {
      lastError = new Error("Claude no llamó al tool create_linkedin_takes");
      console.error(
        `generateLinkedInTakes intento ${attempt}/${MAX_GENERATION_ATTEMPTS}: ${lastError.message}`,
      );
      continue;
    }

    try {
      const validated = validateTakes(toolUse.input, count);
      return {
        takes: validated.takes,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          cache_creation_input_tokens: response.usage.cache_creation_input_tokens,
          cache_read_input_tokens: response.usage.cache_read_input_tokens,
        },
      };
    } catch (err) {
      lastError = err;
      console.error(
        `generateLinkedInTakes intento ${attempt}/${MAX_GENERATION_ATTEMPTS} — validación falló: ${err.message}`,
      );
    }
  }

  throw new Error(
    `No se pudieron generar las tomas tras ${MAX_GENERATION_ATTEMPTS} intentos: ${lastError?.message}`,
  );
}
