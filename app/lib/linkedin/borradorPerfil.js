// Borrador de post para el perfil personal de José en LinkedIn.
//
// Solo genera texto: no guarda nada en base de datos, no llama a Make y no
// publica. El panel lo enseña con un botón de copiar y José lo publica a mano
// desde su perfil, si quiere.
import { getAnthropicClient, MODEL } from "@/app/lib/ai/anthropic";

export const CIERRE_POR_DEFECTO =
  "Si te suena, te propongo una sesión de diagnóstico: escríbeme por privado y lo vemos.";

const SYSTEM = `Escribes posts de LinkedIn para el perfil personal de José, fundador de Room 714, una consultora de producto digital y experiencia de cliente.

Voz: primera persona, directa, crítica y pragmática. Frases cortas. Nada de tono de nota de prensa, emojis en cadena ni frases motivacionales.`;

function textoPlano(html) {
  return (html || "")
    .replace(/<\/(p|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<[^>]*>?/gm, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export function buildBorradorPerfilPrompt({ titulo, contenidoHtml }) {
  return `A partir de este artículo del blog de Room 714, escribe un post corto para el perfil personal de José en LinkedIn.

## Artículo

Título: ${titulo}

${textoPlano(contenidoHtml)}

## Cómo tiene que ser el post

1. Arranca con un problema concreto de un cliente en producto digital o experiencia de cliente: una situación reconocible (qué pasaba, a quién le dolía, qué se notaba en el negocio). Sin nombres de clientes ni de empresas, y sin inventar cifras que no estén en el artículo.
2. Cuenta en dos o tres párrafos breves qué había detrás y cómo se aborda, apoyándote en las ideas del artículo.
3. Entre 600 y 1.100 caracteres en total.
4. Sin enlaces ni URLs en el cuerpo, y sin mencionar "el enlace en comentarios". Sin hashtags.
5. Termina con una invitación a una sesión de diagnóstico con José (por ejemplo, que le escriban por privado).

Devuelve solo el texto del post, sin título, sin comillas y sin comentarios tuyos.`;
}

// Quita cualquier URL que se haya colado y garantiza el cierre con la
// invitación al diagnóstico.
export function limpiarBorrador(texto) {
  const sinEnlaces = (texto || "")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "")
    .split("\n")
    .map((linea) => linea.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (/diagn[oó]stico/i.test(sinEnlaces)) return sinEnlaces;
  return `${sinEnlaces}\n\n${CIERRE_POR_DEFECTO}`.trim();
}

export async function generarBorradorPerfil({
  titulo,
  contenidoHtml,
  client = getAnthropicClient(),
}) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    messages: [
      { role: "user", content: buildBorradorPerfilPrompt({ titulo, contenidoHtml }) },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("El modelo no ha querido escribir este borrador. Prueba con otro post.");
  }

  const texto = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!texto) throw new Error("El modelo devolvió un borrador vacío.");
  return limpiarBorrador(texto);
}
