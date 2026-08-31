// La nota de invitación de LinkedIn que se genera al validar un prospecto.
//
// Se genera DESPUÉS de gastar el crédito de Apollo, así que un fallo aquí no
// puede tirar nada: si la generación falla, el prospecto se crea igual y la
// nota se puede pedir después desde la pantalla. Por eso ninguna función de
// este módulo lanza.

import { costOf } from "./aiCost";

export const MODELO = "claude-opus-5";

// LinkedIn corta las notas de invitación en 300 caracteres.
export const LIMITE_CARACTERES = 300;

// Recorta sin dejar la nota inservible. Cortar a mitad de palabra produce un
// texto que hay que arreglar a mano antes de enviarlo, que es justo lo que esta
// función existe para evitar.
export function recortar(texto) {
  const limpio = String(texto ?? "").trim();
  if (limpio.length <= LIMITE_CARACTERES) return limpio;

  // Primero por frase completa.
  const hastaLimite = limpio.slice(0, LIMITE_CARACTERES);
  const ultimoPunto = Math.max(
    hastaLimite.lastIndexOf(". "),
    hastaLimite.lastIndexOf("? "),
    hastaLimite.lastIndexOf("! "),
  );
  if (ultimoPunto > 0) return hastaLimite.slice(0, ultimoPunto + 1).trim();

  // Si ni la primera frase cabe, por palabra.
  const ultimoEspacio = hastaLimite.lastIndexOf(" ");
  return (ultimoEspacio > 0 ? hastaLimite.slice(0, ultimoEspacio) : hastaLimite).trim();
}

const SISTEMA = `Escribes notas de invitación de LinkedIn para Room714, un estudio
que ayuda a empresas medianas a decidir y construir el producto digital que su
negocio necesita.

Reglas:
- Máximo 300 caracteres. Es un límite duro de LinkedIn.
- En español, tuteando, sin tratamientos formales.
- Arranca por la señal CONCRETA que hemos encontrado sobre esa empresa. La nota
  tiene que ser imposible de enviar a otra empresa distinta.
- Cierra con una pregunta corta y fácil de contestar.

Prohibido: vender, describir servicios, prometer resultados, pedir una reunión
larga, usar "espero que estés bien", "me ha llamado la atención tu perfil", o
cualquier fórmula que valga para cualquiera.`;

export async function generateIntro(
  prospecto,
  { client, dossier = {}, notasAnteriores = [] } = {},
) {
  const ejemplos = notasAnteriores.filter(Boolean).slice(0, 5);

  // Las notas anteriores van TAL Y COMO quedaron tras las ediciones del
  // usuario: si reescribe sistemáticamente de una manera, las siguientes salen
  // ya así. Es el único aprendizaje de tono que tiene el sistema.
  const bloqueEjemplos = ejemplos.length
    ? "\n\nNotas anteriores, ya revisadas por el usuario. Imita el tono, no el contenido:\n" +
      ejemplos.map((n) => "- " + n).join("\n")
    : "";

  const contexto = [
    "Persona: " + (prospecto.name ?? "(sin nombre)"),
    "Cargo: " + (prospecto.role ?? "(sin cargo)"),
    "Empresa: " + (prospecto.company ?? "(sin empresa)"),
    dossier.summary ? "Lo que sabemos: " + dossier.summary : null,
    dossier.veredictos?.digitalNeed?.value
      ? "Producto digital que necesita: " + dossier.veredictos.digitalNeed.value
      : null,
    dossier.veredictos?.itTeam?.value ? "Equipo IT: " + dossier.veredictos.itTeam.value : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: 512,
      thinking: { type: "adaptive" },
      system: SISTEMA + bloqueEjemplos,
      messages: [
        { role: "user", content: contexto + "\n\nEscribe la nota. Devuelve solo la nota." },
      ],
    });

    const texto = respuesta.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return { ok: true, text: recortar(texto), cost: costOf(MODELO, respuesta.usage) };
  } catch (err) {
    console.error("[prospeccion] generar la nota de conexión falló:", err.message);
    return { ok: false, error: err.message, cost: 0 };
  }
}
