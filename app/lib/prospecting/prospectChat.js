// El chat de una ficha. Está anclado a LA EMPRESA, no a la persona: hasta que
// se acepta, de la persona solo tenemos el cargo y una inicial, porque Apollo
// ofusca el apellido en la búsqueda. Prometer más sería mentir en la interfaz.
//
// El hilo no se persiste: vive en el cliente mientras se decide la ficha. Lo
// que merezca sobrevivir se escribe en la nota, y esa nota sí entra en la
// memoria. Guardar conversaciones enteras sería acumular material que nadie
// relee.

import { costOf } from "./aiCost";

export const MODELO = "claude-opus-5";

const BUSQUEDA = {
  type: "web_search_20260318",
  name: "web_search",
  max_uses: 3,
  response_inclusion: "excluded",
};

export const SUGERENCIAS = [
  "¿Quién decide ahí la inversión en tecnología?",
  "¿Trabajan ya con alguna consultora tecnológica?",
  "¿Han hecho algún proyecto digital antes?",
];

function sistema(ficha) {
  return `Ayudas a decidir si merece la pena contactar con una empresa como cliente
de Room714, un estudio que ayuda a empresas medianas a decidir y construir el
producto digital que su negocio necesita.

La conversación es sobre LA EMPRESA, no sobre la persona: todavía no sabemos
quién es más allá de su cargo.

Empresa: ${ficha.company ?? "(sin nombre)"}
Cargo del contacto: ${ficha.title ?? "(sin cargo)"}

Análisis previo:
${ficha.dossier?.report ?? "(todavía no hay análisis)"}

Veredictos: ${JSON.stringify(ficha.dossier?.veredictos ?? {}, null, 1)}

Reglas: cita las fuentes de todo lo que afirmes, y separa siempre lo que has
comprobado de lo que estás suponiendo. Si no lo sabes, dilo. Respuestas cortas.`;
}

export async function askAboutCompany({ client, ficha, historial = [], pregunta }) {
  try {
    const respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: sistema(ficha),
      tools: [BUSQUEDA],
      messages: [...historial, { role: "user", content: pregunta }],
    });

    const texto = respuesta.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return { ok: true, text: texto, cost: costOf(MODELO, respuesta.usage) };
  } catch (err) {
    console.error("[prospeccion] el chat falló:", err.message);
    return { ok: false, error: err.message, cost: 0 };
  }
}
