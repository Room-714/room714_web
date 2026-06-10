import { getAnthropicClient, MODEL } from "./anthropic";

const SYSTEM_PROMPT = `Eres un analista de RRHH de Room 714, una consultora de producto digital, diseño, usabilidad y tecnología en España. Tu tarea es analizar un CV en PDF y devolver dos cosas:

1. Un resumen ejecutivo en markdown para el equipo de selección.
2. Los datos de contacto del candidato extraídos del CV.

Devuelve siempre tu análisis llamando al tool 'submit_cv_analysis' con los dos campos. NO escribas texto fuera del tool.

ESTRUCTURA OBLIGATORIA DEL RESUMEN EJECUTIVO (campo executiveSummary):

1. **Datos de contacto**: nombre completo, email, teléfono (si aparecen). Si falta alguno, márcalo como "no indicado".
2. **Perfil profesional**: una frase de 1-2 líneas describiendo qué tipo de profesional es (senior backend, mid product designer, etc.).
3. **Experiencia clave**: 3-5 bullets con los puestos y empresas más relevantes (los últimos 5-7 años máximo). Indica años aproximados en cada uno.
4. **Formación**: para cada titulación universitaria (Grado, Máster o Doctorado), indica en una línea separada el **nombre completo del título** y la **universidad** que lo emite. Ejemplos del formato esperado: "Grado en Ingeniería Informática — Universidad Politécnica de Madrid", "Máster en Diseño de Producto — IED Madrid", "Doctorado en Ciencias de la Computación — Universidad Complutense de Madrid". Si no aparece la universidad, indica "(universidad no indicada)". Lista TODAS las titulaciones universitarias relevantes, ordenadas de menor a mayor nivel (Grado, Máster, Doctorado).
5. **Stack técnico / herramientas**: lista plana, separada por comas, sólo las relevantes para el puesto al que opta.
6. **Idiomas**: nivel declarado.
7. **Fit con Room 714**: 2-3 líneas valorando encaje con la posición a la que aplica (que se indica en el contexto). Sé honesto: si no encaja bien, dilo.
8. **Banderas (opcional)**: cualquier red flag o nota destacable (gaps largos, cambios frecuentes, claims dudosos, idioma del CV inconsistente, etc.).

CAMPO contact:
- Extrae nombre completo, email y teléfono del CV. Si alguno no aparece, devuélvelo como null. NO inventes ningún dato.`;

const ANALYSIS_TOOL = {
  name: "submit_cv_analysis",
  description:
    "Devuelve el análisis estructurado del CV: resumen ejecutivo en markdown y datos de contacto extraídos.",
  input_schema: {
    type: "object",
    properties: {
      executiveSummary: {
        type: "string",
        description:
          "Resumen ejecutivo del CV en formato markdown, siguiendo la estructura definida en las instrucciones del sistema.",
      },
      contact: {
        type: "object",
        description: "Datos de contacto extraídos del CV.",
        properties: {
          name: {
            type: ["string", "null"],
            description: "Nombre completo tal como aparece en el CV.",
          },
          email: {
            type: ["string", "null"],
            description: "Email tal como aparece en el CV.",
          },
          phone: {
            type: ["string", "null"],
            description: "Teléfono tal como aparece en el CV.",
          },
        },
        required: ["name", "email", "phone"],
      },
    },
    required: ["executiveSummary", "contact"],
  },
};

export async function summarizeCv({ pdfBase64, position }) {
  const client = getAnthropicClient();

  const positionLabel =
    {
      DEVELOPER: "Desarrollador / Developer",
      DESIGNER: "Diseñador / Designer",
      PRODUCT_MANAGER: "Product Manager",
    }[position] || position;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: "submit_cv_analysis" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          {
            type: "text",
            text: `Posición a la que aplica el candidato: **${positionLabel}**.\n\nProduce el análisis llamando a submit_cv_analysis.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) {
    throw new Error("Anthropic no devolvió tool_use en la respuesta");
  }
  const { executiveSummary, contact } = toolUse.input;
  return {
    summary: executiveSummary,
    contact: {
      name: contact?.name || null,
      email: contact?.email || null,
      phone: contact?.phone || null,
    },
  };
}
