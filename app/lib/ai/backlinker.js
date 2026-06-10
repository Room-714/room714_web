import { prisma } from "@/app/lib/prisma";
import { getAnthropicClient, MODEL } from "./anthropic";

const ELIGIBLE_DAYS = 30;
const CANDIDATE_LIMIT = 20;
const SELECTION_TOOL = {
  name: "select_backlinks",
  description:
    "Selecciona 0-3 posts antiguos para enlazar al nuevo, indicando frase-ancla a sustituir en cada uno.",
  input_schema: {
    type: "object",
    properties: {
      selections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slug_es: { type: "string" },
            slug_en: { type: "string" },
            anchor_phrase_es: {
              type: "string",
              description:
                "Frase de 3-7 palabras que aparece LITERALMENTE en el content_es del post antiguo. Se usará para reemplazar por <a href='/es/blog/NUEVO_SLUG_ES'>anchor_phrase_es</a>. La frase debe ser tal cual aparece, mismas mayúsculas, mismos acentos.",
            },
            anchor_phrase_en: {
              type: "string",
              description:
                "Frase de 3-7 palabras que aparece LITERALMENTE en el content_en del post antiguo.",
            },
            reason: {
              type: "string",
              description:
                "Una frase explicando por qué este post antiguo conecta temáticamente con el nuevo.",
            },
          },
          required: [
            "slug_es",
            "slug_en",
            "anchor_phrase_es",
            "anchor_phrase_en",
            "reason",
          ],
        },
        minItems: 0,
        maxItems: 3,
      },
    },
    required: ["selections"],
  },
};

function htmlSnippet(html, max = 400) {
  if (!html) return "";
  const stripped = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return stripped.length > max ? stripped.slice(0, max) + "…" : stripped;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function insertLinkAroundPhrase({ html, phrase, href }) {
  if (!html || !phrase) return { html, replaced: false };
  // Sólo reemplaza la primera ocurrencia. Caso-sensitive para evitar tocar
  // texto ya marcado o lugares inesperados.
  const escaped = escapeRegExp(phrase);
  const re = new RegExp(escaped, "");
  if (!re.test(html)) return { html, replaced: false };
  const next = html.replace(re, `<a href="${href}">${phrase}</a>`);
  return { html: next, replaced: true };
}

export async function backlinkOldPosts({
  newPostId,
  newPostCategory,
  newPostTitle,
  newSlugEs,
  newSlugEn,
  newContentEs,
}) {
  const cutoff = new Date(Date.now() - ELIGIBLE_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.post.findMany({
    where: {
      id: { not: newPostId },
      category: newPostCategory,
      published: true,
      date: { lte: new Date() },
      updatedAt: { lt: cutoff },
    },
    include: { translations: true },
    orderBy: { date: "desc" },
    take: CANDIDATE_LIMIT,
  });

  if (candidates.length === 0) {
    return { eligible: 0, edited: 0, skippedNoAnchor: 0, reasons: [] };
  }

  const candidatesForPrompt = candidates
    .map((p) => {
      const es = p.translations.find((t) => t.lang === "es");
      const en = p.translations.find((t) => t.lang === "en");
      if (!es || !en) return null;
      return {
        slug_es: es.slug,
        slug_en: en.slug,
        title_es: es.title,
        snippet_es: htmlSnippet(es.content, 350),
        snippet_en: htmlSnippet(en.content, 250),
      };
    })
    .filter(Boolean);

  const newSnippet = htmlSnippet(newContentEs, 600);

  const userPrompt = `Acabamos de publicar un post nuevo en el blog de Room 714 y queremos crear enlaces internos DESDE 2-3 posts antiguos HACIA el nuevo. Tu tarea es elegir 2-3 candidatos y, para cada uno, identificar una frase corta (3-7 palabras) que aparece LITERALMENTE en su contenido y que tenga sentido convertir en enlace al nuevo post.

## Post nuevo (objetivo del enlace)

- Categoría: ${newPostCategory}
- Título: "${newPostTitle}"
- URL ES: /es/blog/${newSlugEs}
- URL EN: /en/blog/${newSlugEn}
- Resumen: ${newSnippet}

## Posts antiguos candidatos (de la misma categoría, no editados en 30 días)

Para cada candidato te paso un snippet del contenido en cada idioma. La frase ancla que elijas debe aparecer EXACTAMENTE en ese snippet o en el resto del post.

${candidatesForPrompt
  .map(
    (c, i) => `### Candidato ${i + 1}
- slug_es: ${c.slug_es}
- slug_en: ${c.slug_en}
- Título ES: "${c.title_es}"
- Snippet ES: ${c.snippet_es}
- Snippet EN: ${c.snippet_en}`,
  )
  .join("\n\n")}

## Reglas

1. Selecciona 2-3 candidatos donde el enlace al post nuevo SE LEA NATURAL al lector. Si ninguno encaja honestamente, selecciona menos (incluso 0). Mejor pocos enlaces buenos que muchos forzados.
2. La frase ancla (anchor_phrase) debe aparecer LITERALMENTE en el snippet o en el contenido completo del post antiguo. NO inventes frases. NO modifiques mayúsculas, acentos o puntuación.
3. La frase ancla debe ser corta (3-7 palabras) y autosuficiente — debe servir como texto de enlace que dé pista al lector de qué va el destino.
4. ES y EN son posts independientes con slugs distintos. Para cada candidato debes dar una anchor_phrase_es para el contenido en español y una anchor_phrase_en para el inglés. Si en uno de los idiomas no encuentras una frase ancla buena, omite ese candidato completo (mejor no enlazar que enlazar a medias).

Llama al tool select_backlinks con tus selecciones.`;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    tools: [SELECTION_TOOL],
    tool_choice: { type: "tool", name: "select_backlinks" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) {
    return { eligible: candidates.length, edited: 0, skippedNoAnchor: 0, reasons: [] };
  }

  const { selections = [] } = toolUse.input;

  const stats = {
    eligible: candidates.length,
    suggested: selections.length,
    edited: 0,
    skippedNoAnchor: 0,
    reasons: [],
  };

  for (const sel of selections) {
    const candidate = candidates.find((c) => {
      const es = c.translations.find((t) => t.lang === "es");
      return es?.slug === sel.slug_es;
    });
    if (!candidate) {
      stats.skippedNoAnchor++;
      continue;
    }
    const esTr = candidate.translations.find((t) => t.lang === "es");
    const enTr = candidate.translations.find((t) => t.lang === "en");
    if (!esTr || !enTr) {
      stats.skippedNoAnchor++;
      continue;
    }

    const esResult = insertLinkAroundPhrase({
      html: esTr.content,
      phrase: sel.anchor_phrase_es,
      href: `/es/blog/${newSlugEs}`,
    });
    const enResult = insertLinkAroundPhrase({
      html: enTr.content,
      phrase: sel.anchor_phrase_en,
      href: `/en/blog/${newSlugEn}`,
    });

    if (!esResult.replaced || !enResult.replaced) {
      stats.skippedNoAnchor++;
      stats.reasons.push(
        `slug ${sel.slug_es}: anchor no encontrado (es=${esResult.replaced} en=${enResult.replaced})`,
      );
      continue;
    }

    try {
      await prisma.post.update({
        where: { id: candidate.id },
        data: {
          updatedAt: new Date(),
          translations: {
            update: [
              {
                where: { id: esTr.id },
                data: { content: esResult.html },
              },
              {
                where: { id: enTr.id },
                data: { content: enResult.html },
              },
            ],
          },
        },
      });
      stats.edited++;
      stats.reasons.push(`slug ${sel.slug_es}: OK (${sel.reason})`);
    } catch (err) {
      console.error(`Backlink update falló para ${sel.slug_es}:`, err.message);
      stats.reasons.push(`slug ${sel.slug_es}: error DB (${err.message})`);
    }
  }

  return stats;
}
