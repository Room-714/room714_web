// Planificación del tema de un post ANTES de generarlo.
//
// Una llamada corta al modelo (sin escribir el post) que:
// - fija el tema: la búsqueda objetivo del día, el tema que se pida a mano o,
//   si no hay ninguno, uno que propone a partir de las tendencias;
// - propone un ángulo que no repita lo ya escrito;
// - asigna uno de los tres clusters del posicionamiento, o NINGUNO si el tema
//   no encaja (y entonces no se genera);
// - hace la comprobación semántica de duplicados: recibe la lista numerada de
//   títulos existentes y dice cuál cubre ya el tema, si alguno lo cubre.
//
// La comprobación léxica (duplicados.js) va aparte y no depende del modelo.

import { getAnthropicClient, MODEL } from "./anthropic";
import { CLUSTERS, CLUSTERS_POSICIONAMIENTO, RESERVED_QUERIES } from "../seo/clusters";
import { MAX_PLANIFICADOR_MS, esTimeout, opcionesDeTiempo, segundos } from "./tiempos";

export const SIN_CLUSTER = "NINGUNO";

const PLAN_TOOL = {
  name: "planificar_post",
  description: "Fija el tema, el ángulo y el cluster de un post, y comprueba si ya existe uno que lo cubre.",
  input_schema: {
    type: "object",
    properties: {
      tema_es: {
        type: "string",
        description: "El tema del post en español, como una búsqueda o pregunta corta (4-10 palabras).",
      },
      tema_en: { type: "string", description: "El mismo tema en inglés." },
      angulo_es: {
        type: "string",
        description: "En una o dos frases, el ángulo concreto que tendrá el post y que ningún post existente tiene.",
      },
      cluster: {
        type: "string",
        enum: [...CLUSTERS_POSICIONAMIENTO, SIN_CLUSTER],
        description: `Cluster del tema. ${SIN_CLUSTER} si no encaja con claridad en ninguno.`,
      },
      duplicado_de: {
        type: "integer",
        description:
          "Número (de la lista de posts existentes) del post que ya cubre este tema: misma pregunta o misma tesis central, aunque cambien las palabras o el enfoque. 0 si ninguno lo cubre.",
      },
      motivo: {
        type: "string",
        description:
          "Una frase: por qué es duplicado, o por qué no encaja en ningún cluster. Nombra los posts por su título, nunca por su número de la lista (el panel no lo enseña). Vacío si nada de eso.",
      },
    },
    required: ["tema_es", "tema_en", "angulo_es", "cluster", "duplicado_de", "motivo"],
  },
};

const ESTADO = { publicado: "publicado", programado: "programado", borrador: "borrador" };

/** La lista numerada que ve el modelo. El número es el que devuelve en `duplicado_de`. */
export function listaNumerada(existentes) {
  return existentes
    .map((p, i) => {
      const titulo = p.title_es || p.title_en || "(sin título)";
      const meta = p.metaTitle_es && p.metaTitle_es !== titulo ? ` · metaTitle: "${p.metaTitle_es}"` : "";
      const slug = p.slug_es ? ` · /${p.slug_es}` : "";
      return `${i + 1}. "${titulo}" (${ESTADO[p.estado] ?? p.estado}, ${p.date})${meta}${slug}`;
    })
    .join("\n");
}

function bloqueClusters() {
  return CLUSTERS_POSICIONAMIENTO.map((c) => {
    const cl = CLUSTERS[c];
    return `- **${c}** — ${cl.name.es}. Búsquedas de ejemplo: ${cl.postQueries.es.join("; ")}.`;
  }).join("\n");
}

// Exportada para probarla.
export function buildPlanPrompt({ category, clusterSugerido, temaFijo, trending = [], existentes = [], evitar = [] }) {
  const tendencias = trending.length
    ? trending
        .slice(0, 12)
        .map((t, i) => `${i + 1}. ${t.title}${t.source ? ` — ${t.source}` : ""}`)
        .join("\n")
    : "(sin tendencias)";

  const tarea = temaFijo
    ? `El tema está fijado: **"${temaFijo}"**. Ponlo tal cual en tema_es (y su equivalente en tema_en). No lo cambies por otro: tu trabajo es comprobarlo y proponer el ángulo.`
    : `Propón UN tema para un post de la categoría ${category}${clusterSugerido ? ` (cluster sugerido: ${clusterSugerido})` : ""}, a partir de las tendencias de abajo, que NO esté cubierto por ningún post existente.`;

  const rechazados = evitar.length
    ? `\n## Temas ya descartados (no los propongas ni propongas uno equivalente)\n${evitar.map((t) => `- ${t}`).join("\n")}\n`
    : "";

  return `Vas a planificar el próximo post del blog de Room 714 antes de escribirlo.

## Tarea
${tarea}

1. Comprueba el tema contra la lista de posts existentes. Si alguno ya responde a la misma pregunta o defiende la misma tesis central —aunque el título, las palabras o el enfoque sean distintos—, pon su número en duplicado_de y explica por qué en motivo. Dos posts que compiten por la misma búsqueda en Google son duplicados aunque cada uno tenga su matiz.
2. Si no es duplicado, propón en angulo_es un ángulo nuevo, que no repita el de ningún post existente.
3. Asigna el cluster. Si el tema no encaja con claridad en ninguno de los tres, usa ${SIN_CLUSTER} y explica por qué en motivo.
4. Nunca uses como tema una búsqueda reservada a una página: ${RESERVED_QUERIES.es.join("; ")}.

## Clusters
${bloqueClusters()}

## Tendencias de esta semana
${tendencias}
${rechazados}
## Posts existentes (publicados, programados y borradores)
${listaNumerada(existentes) || "(ninguno)"}

Llama a la herramienta planificar_post.`;
}

/**
 * Pasa la respuesta del modelo a algo que el orquestador pueda usar.
 * Exportada para probarla sin llamar al modelo.
 */
export function interpretarPlan(input, existentes, { temaFijo } = {}) {
  const indice = Number.isInteger(input?.duplicado_de) ? input.duplicado_de : 0;
  const duplicado = indice >= 1 && indice <= existentes.length ? existentes[indice - 1] : null;
  const cluster = CLUSTERS_POSICIONAMIENTO.includes(input?.cluster) ? input.cluster : null;
  return {
    // Con tema fijado manda el tema fijado, aunque el modelo lo reformule.
    tema_es: temaFijo ?? String(input?.tema_es ?? "").trim(),
    tema_en: String(input?.tema_en ?? "").trim(),
    angulo_es: String(input?.angulo_es ?? "").trim(),
    cluster,
    sinCluster: input?.cluster === SIN_CLUSTER || !cluster,
    duplicadoDe: duplicado,
    motivo: String(input?.motivo ?? "").trim(),
  };
}

/**
 * Una sola llamada al modelo, con límite de tiempo (`timeoutMs`) y sin
 * reintentos. Lanza si el modelo no usa la herramienta o no responde a tiempo.
 */
export async function planificarTema({
  category,
  clusterSugerido,
  temaFijo,
  trending,
  existentes,
  evitar,
  timeoutMs = MAX_PLANIFICADOR_MS,
}) {
  const client = getAnthropicClient();
  let response;
  try {
    response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 1500,
        tools: [PLAN_TOOL],
        tool_choice: { type: "tool", name: PLAN_TOOL.name },
        messages: [
          {
            role: "user",
            content: buildPlanPrompt({ category, clusterSugerido, temaFijo, trending, existentes, evitar }),
          },
        ],
      },
      opcionesDeTiempo(timeoutMs),
    );
  } catch (err) {
    if (esTimeout(err)) {
      throw new Error(
        `El planificador no respondió en ${segundos(timeoutMs)}; no se ha generado nada. Vuelve a intentarlo en unos minutos.`,
      );
    }
    throw err;
  }
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("El planificador no devolvió un plan");
  return {
    ...interpretarPlan(toolUse.input, existentes, { temaFijo }),
    usage: { input_tokens: response.usage?.input_tokens, output_tokens: response.usage?.output_tokens },
  };
}
