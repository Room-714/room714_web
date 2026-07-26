import { prisma } from "@/app/lib/prisma";
import { getAnthropicClient, MODEL } from "./anthropic";
import { htmlSnippet, insertLinkAroundPhrase } from "./backlinker";

const CANDIDATE_LIMIT = 12;

const SELECTION_TOOL = {
  name: "select_outbound_links",
  description:
    "Selecciona 2-3 posts relacionados para enlazar DESDE este post, con la frase-ancla exacta (del contenido de ESTE post) a convertir en enlace.",
  input_schema: {
    type: "object",
    properties: {
      selections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slug_es: {
              type: "string",
              description: "slug_es del post DESTINO (de la lista de candidatos).",
            },
            slug_en: {
              type: "string",
              description: "slug_en del post DESTINO (de la lista de candidatos).",
            },
            anchor_phrase_es: {
              type: "string",
              description:
                "Frase de 3-7 palabras que aparece LITERALMENTE en el CONTENIDO DE ESTE POST (español). Se convertirá en enlace al destino. Misma capitalización, acentos y puntuación.",
            },
            anchor_phrase_en: {
              type: "string",
              description:
                "Frase de 3-7 palabras que aparece LITERALMENTE en el CONTENIDO DE ESTE POST (inglés).",
            },
            reason: {
              type: "string",
              description: "Por qué el destino conecta temáticamente con este post.",
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

// Calcula 2-3 enlaces salientes contextuales DESDE un post hacia posts
// relacionados de su categoría. Usa IA para elegir frases-ancla que aparecen
// literalmente en su contenido. NO escribe en BD: devuelve el contenido
// editado + stats, para que el llamador decida (sirve para dry-run).
export async function computeOutboundLinksForPost({
  postId,
  category,
  contentEs,
  contentEn,
}) {
  const candidates = await prisma.post.findMany({
    where: {
      id: { not: postId },
      category,
      published: true,
      date: { lte: new Date() },
    },
    include: { translations: true },
    orderBy: { date: "desc" },
    take: CANDIDATE_LIMIT,
  });

  const forPrompt = candidates
    .map((p) => {
      const es = p.translations.find((t) => t.lang === "es");
      const en = p.translations.find((t) => t.lang === "en");
      if (!es?.slug || !en?.slug) return null;
      return {
        slug_es: es.slug,
        slug_en: en.slug,
        title_es: es.title,
        snippet_es: htmlSnippet(es.content, 200),
      };
    })
    .filter(Boolean);

  if (forPrompt.length === 0 || !contentEs || !contentEn) {
    return { contentEs, contentEn, eligible: forPrompt.length, added: [], skipped: [] };
  }

  const userPrompt = `Este es un post del blog de Room 714 al que queremos añadir 2-3 ENLACES INTERNOS SALIENTES hacia posts relacionados (de su misma categoría). Elige 2-3 destinos de la lista y, para cada uno, una frase (3-7 palabras) que aparezca LITERALMENTE en el contenido de ESTE post y tenga sentido convertir en enlace al destino.

## Contenido de ESTE post (origen del enlace)
- Categoría: ${category}
- Contenido (ES): ${htmlSnippet(contentEs, 1200)}

## Posts destino candidatos (misma categoría)
${forPrompt
  .map(
    (c, i) => `### Candidato ${i + 1}
- slug_es: ${c.slug_es}
- slug_en: ${c.slug_en}
- Título: "${c.title_es}"
- De qué va: ${c.snippet_es}`,
  )
  .join("\n\n")}

## Reglas
1. Elige 2-3 destinos donde el enlace SE LEA NATURAL. Si ninguno encaja honestamente, elige menos (incluso 0). Mejor pocos buenos que muchos forzados.
2. La anchor_phrase_es debe aparecer LITERALMENTE en el contenido de ESTE post (arriba), sin inventar ni cambiar acentos/mayúsculas. La anchor_phrase_en es su equivalente en la versión inglesa del mismo post.
3. No enlaces dos veces a la misma frase ni al mismo destino. Frases cortas y autosuficientes.

Llama a select_outbound_links con tus selecciones.`;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    tools: [SELECTION_TOOL],
    tool_choice: { type: "tool", name: "select_outbound_links" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  const selections = toolUse?.input?.selections || [];

  let es = contentEs;
  let en = contentEn;
  const added = [];
  const skipped = [];
  const usedTargets = new Set();

  for (const sel of selections) {
    const cand = forPrompt.find((c) => c.slug_es === sel.slug_es);
    if (!cand) {
      skipped.push({ slug_es: sel.slug_es, why: "destino no está en candidatos" });
      continue;
    }
    if (usedTargets.has(cand.slug_es)) {
      skipped.push({ slug_es: cand.slug_es, why: "destino duplicado" });
      continue;
    }

    const esRes = insertLinkAroundPhrase({
      html: es,
      phrase: sel.anchor_phrase_es,
      href: `/es/blog/${cand.slug_es}`,
    });
    const enRes = insertLinkAroundPhrase({
      html: en,
      phrase: sel.anchor_phrase_en,
      href: `/en/blog/${cand.slug_en}`,
    });

    if (!esRes.replaced || !enRes.replaced) {
      skipped.push({
        slug_es: cand.slug_es,
        why: `anchor no encontrado (es=${esRes.replaced} en=${enRes.replaced})`,
      });
      continue;
    }

    es = esRes.html;
    en = enRes.html;
    usedTargets.add(cand.slug_es);
    added.push({
      slug_es: cand.slug_es,
      anchor_es: sel.anchor_phrase_es,
      anchor_en: sel.anchor_phrase_en,
      reason: sel.reason,
    });
  }

  return { contentEs: es, contentEn: en, eligible: forPrompt.length, added, skipped };
}
