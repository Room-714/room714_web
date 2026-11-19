// Texto de las publicaciones automáticas del perfil personal de José.
//
// Se genera en el momento de publicar, a partir de un post del blog, y sale
// sin revisión. Por eso las reglas que se pueden comprobar se comprueban en
// código y no se dejan al prompt:
// - sin enlaces, sin emojis y como mucho 3 hashtags: se limpian;
// - el cierre con la invitación al diagnóstico: se añade siempre igual;
// - entre 600 y 1.200 caracteres: si no, se vuelve a pedir;
// - ni la idea ni la frase inicial pueden repetir las de los últimos 20 textos
//   publicados en el perfil: si se repiten, se vuelve a pedir.
// Dos intentos como mucho; si el segundo tampoco vale, lanza un error y el
// envío cuenta como fallido (autopost.js lo reintenta a los 15 minutos).

import { getAnthropicClient, MODEL } from "@/app/lib/ai/anthropic";
import { terminosClave } from "@/app/lib/ai/duplicados";

export const CIERRE =
  "Si te pasa algo parecido, escríbeme o pide una sesión de diagnóstico (enlace en mi perfil).";
export const MIN_CARACTERES = 600;
export const MAX_CARACTERES = 1200;
export const MAX_HASHTAGS = 3;
export const RECIENTES = 20;
const INTENTOS = 2;

// Umbrales de parecido (Jaccard sobre términos clave). La frase inicial es
// corta: compartir el 60 % de sus términos ya es repetirla. La idea se resume
// en una frase y se compara igual; el texto completo, más largo y con
// vocabulario del sector en común, solo cuenta si comparte la mitad.
const UMBRAL_FRASE = 0.6;
const UMBRAL_IDEA = 0.5;
const UMBRAL_TEXTO = 0.5;

/* ─── Limpieza y reglas ───────────────────────────────────────────────────── */

const URL = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|es|io|net|org|ai|co|eu)(?:\/\S*)?/gi;
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
const HASHTAG_EN_CUERPO = /(^|\s)#[\p{L}\p{N}_]+/gu;

/** "#Producto Digital!" → "ProductoDigital". Vacío si no queda nada. */
export function normalizarHashtag(h) {
  return String(h || "")
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}_]/gu, "");
}

/**
 * Monta el texto final: cuerpo limpio + cierre + hashtags (máx. 3).
 * Quita del cuerpo enlaces, emojis, hashtags sueltos y cualquier cierre
 * propio del modelo (para no invitar dos veces).
 */
export function montarTextoPerfil({ texto, hashtags = [] }) {
  const parrafos = String(texto || "")
    .replace(URL, "")
    .replace(EMOJI, "")
    .replace(HASHTAG_EN_CUERPO, "$1")
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split("\n")
        .map((l) => l.replace(/[ \t]+/g, " ").trim())
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean)
    .filter((p) => !/sesi[oó]n de diagn[oó]stico|escr[ií]beme/i.test(p));

  const tags = [...new Set(hashtags.map(normalizarHashtag).filter(Boolean))]
    .slice(0, MAX_HASHTAGS)
    .map((h) => `#${h}`);

  return [...parrafos, CIERRE, ...(tags.length ? [tags.join(" ")] : [])].join("\n\n");
}

/** Lo que incumple el texto final, o [] si cumple. */
export function incumplimientos(final) {
  const fallos = [];
  const n = [...final].length;
  if (n < MIN_CARACTERES) fallos.push(`tiene ${n} caracteres y el mínimo es ${MIN_CARACTERES}`);
  if (n > MAX_CARACTERES) fallos.push(`tiene ${n} caracteres y el máximo es ${MAX_CARACTERES}`);
  if (new RegExp(URL.source, "i").test(final)) fallos.push("lleva un enlace");
  if (!final.includes(CIERRE)) fallos.push("no lleva el cierre");
  return fallos;
}

/* ─── Deduplicación ───────────────────────────────────────────────────────── */

/** La primera frase del texto (hasta el primer punto, interrogación o salto). */
export function fraseInicial(texto) {
  const t = String(texto || "").trim();
  const m = t.match(/^[\s\S]*?(?:[.!?…](?=\s|$)|\n|$)/);
  return (m ? m[0] : t).trim();
}

function parecido(a, b) {
  const A = new Set(terminosClave(a));
  const B = new Set(terminosClave(b));
  if (A.size === 0 || B.size === 0) return 0;
  let comunes = 0;
  for (const t of A) if (B.has(t)) comunes += 1;
  return comunes / (A.size + B.size - comunes);
}

/**
 * Compara un texto nuevo con los publicados. Devuelve la primera repetición
 * ({ tipo: "frase" | "idea", con, parecido }) o null.
 * `recientes`: [{ texto, idea, postId }], del más nuevo al más viejo.
 */
export function buscarRepeticion({ texto, idea, postId }, recientes = []) {
  const frase = fraseInicial(texto);
  for (const r of recientes.slice(0, RECIENTES)) {
    const suFrase = fraseInicial(r.texto);
    const pf = parecido(frase, suFrase);
    if (
      (frase && suFrase && frase.toLowerCase() === suFrase.toLowerCase()) ||
      (terminosClave(frase).length >= 3 && pf >= UMBRAL_FRASE)
    ) {
      return { tipo: "frase", con: suFrase, parecido: Math.round(pf * 100) / 100 };
    }
    if (postId != null && r.postId != null && Number(r.postId) === Number(postId)) {
      return { tipo: "idea", con: r.idea || suFrase, parecido: 1 };
    }
    const pi = idea && r.idea ? parecido(idea, r.idea) : 0;
    const pt = parecido(texto, r.texto);
    if (pi >= UMBRAL_IDEA || pt >= UMBRAL_TEXTO) {
      return {
        tipo: "idea",
        con: r.idea || suFrase,
        parecido: Math.round(Math.max(pi, pt) * 100) / 100,
      };
    }
  }
  return null;
}

/* ─── Prompt y generación ─────────────────────────────────────────────────── */

const SYSTEM = `Escribes las publicaciones de LinkedIn del perfil personal de José, CEO de Room 714, un estudio de producto digital y experiencia de cliente que trabaja con empresas de telco, seguros, banca y retail.

Voz: español, primera persona, directa y concreta. Frases cortas. Nada de tono de nota de prensa, frases motivacionales ni emojis.`;

const TOOL = {
  name: "publicacion_perfil",
  description: "Devuelve la publicación de LinkedIn para el perfil de José.",
  input_schema: {
    type: "object",
    properties: {
      texto: {
        type: "string",
        description:
          "El cuerpo de la publicación, SIN el cierre de la invitación al diagnóstico y SIN hashtags (se añaden aparte).",
      },
      hashtags: {
        type: "array",
        items: { type: "string" },
        description: "Entre 0 y 3 hashtags, sin el símbolo #.",
      },
      idea: {
        type: "string",
        description: "La idea central de la publicación en una sola frase (no se publica; sirve para no repetirla).",
      },
    },
    required: ["texto", "hashtags", "idea"],
    additionalProperties: false,
  },
  strict: true,
};

function textoPlano(html, max = 7000) {
  const t = (html || "")
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<[^>]*>?/gm, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

// Exportada para probarla.
export function buildPerfilPrompt({ titulo, contenidoHtml, recientes = [], correccion = null }) {
  const usados = recientes.slice(0, RECIENTES);
  const bloqueUsados = usados.length
    ? `\n## Ya publicado en el perfil (no repitas ni la idea ni la frase inicial)\n${usados
        .map((r, i) => `${i + 1}. Empieza: «${fraseInicial(r.texto)}»${r.idea ? ` · Idea: ${r.idea}` : ""}`)
        .join("\n")}\n`
    : "";
  const bloqueCorreccion = correccion
    ? `\n## Corrige esto del intento anterior\n${correccion}\n`
    : "";

  return `Escribe una publicación para el perfil de José en LinkedIn a partir de este artículo del blog de Room 714.

## Artículo

Título: ${titulo}

${textoPlano(contenidoHtml)}

## Reglas

1. Cuenta un problema real de un cliente en producto digital o experiencia de cliente, en un sector como telco, seguros, banca o retail: qué pasaba, a quién le dolía, qué se notaba en el negocio y qué había detrás. Usa las ideas del artículo. Sin nombres de clientes ni de empresas y sin inventar cifras que no estén en el artículo.
2. Primera persona, tono directo y concreto.
3. Prohibido el contenido genérico sobre IA o sobre tendencias: si el artículo habla de eso, quédate con el problema concreto del cliente.
4. La frase inicial tiene que ser distinta de todas las ya publicadas (abajo) y la idea central también.
5. Sin enlaces ni URLs, sin mencionar "enlace en comentarios", sin emojis.
6. El campo texto NO lleva la invitación final ni hashtags: el cierre «${CIERRE}» y los hashtags se añaden después.
7. Longitud: el texto final (tu cuerpo + el cierre + los hashtags) tiene que quedar entre ${MIN_CARACTERES} y ${MAX_CARACTERES} caracteres. Apunta a un cuerpo de 550-950 caracteres.
8. Como mucho ${MAX_HASHTAGS} hashtags, sin #.
${bloqueUsados}${bloqueCorreccion}
Llama a la herramienta ${TOOL.name}.`;
}

/**
 * Genera el texto para un post del blog. Devuelve { texto, idea, intentos,
 * usage } o lanza un error con el motivo si los dos intentos fallan.
 * `post`: { id, titulo, contenidoHtml }. `recientes`: los últimos textos
 * publicados en el perfil.
 */
export async function generarTextoPerfil({ post, recientes = [], client = getAnthropicClient() }) {
  let correccion = null;
  let ultimoFallo = null;

  for (let intento = 1; intento <= INTENTOS; intento += 1) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [
        {
          role: "user",
          content: buildPerfilPrompt({
            titulo: post.titulo,
            contenidoHtml: post.contenidoHtml,
            recientes,
            correccion,
          }),
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("El modelo no ha querido escribir la publicación del perfil");
    }
    const input = response.content?.find((b) => b.type === "tool_use")?.input;
    if (!input?.texto) {
      ultimoFallo = "no devolvió texto";
      correccion = "Devuelve el texto en el campo texto.";
      continue;
    }

    const texto = montarTextoPerfil(input);
    const idea = String(input.idea || "").trim();
    const fallos = incumplimientos(texto);
    const repeticion = fallos.length ? null : buscarRepeticion({ texto, idea, postId: post.id }, recientes);

    if (!fallos.length && !repeticion) {
      return {
        texto,
        idea,
        intentos: intento,
        usage: {
          input_tokens: response.usage?.input_tokens,
          output_tokens: response.usage?.output_tokens,
        },
      };
    }

    ultimoFallo = fallos.length
      ? `el texto ${fallos.join(" y ")}`
      : repeticion.tipo === "frase"
        ? `la frase inicial repite una ya publicada («${repeticion.con}»)`
        : `la idea repite una ya publicada («${repeticion.con}»)`;
    correccion = `El intento anterior no vale: ${ultimoFallo}. Escríbelo de nuevo cumpliendo las reglas.`;
  }

  throw new Error(`No se pudo generar un texto válido para el perfil en ${INTENTOS} intentos: ${ultimoFallo}`);
}
