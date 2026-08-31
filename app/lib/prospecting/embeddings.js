// Cliente de Voyage AI. Solo transporte: aquí no hay ninguna decisión sobre qué
// se embebe ni para qué (eso vive en memory.js y en rankPool.js).
//
// Anthropic no ofrece API de embeddings y recomienda Voyage. `voyage-4-lite`
// cuesta 0,02 $ por millón de tokens CON LOS PRIMEROS 200 MILLONES GRATIS: a
// nuestro volumen —unos 125 candidatos al día a ~20 tokens— son 900k tokens al
// año, así que esto no va a costar dinero en toda la vida del proyecto.
//
// `fetch` y `apiKey` se inyectan para poder probar esto sin red.

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

export const VOYAGE_MODEL = "voyage-4-lite";
export const VOYAGE_DIMS = 1024;

// Voyage acepta hasta 128 textos por llamada.
const LOTE = 128;

export async function embedTexts(
  textos = [],
  { fetch: fetchImpl = fetch, apiKey = process.env.VOYAGE_API_KEY, inputType = "document" } = {},
) {
  if (textos.length === 0) return [];
  if (!apiKey) {
    throw new Error(
      "VOYAGE_API_KEY no está definida: la memoria de prospección no puede embeber nada",
    );
  }

  const vectores = [];

  for (let i = 0; i < textos.length; i += LOTE) {
    const trozo = textos.slice(i, i + LOTE);

    const respuesta = await fetchImpl(VOYAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: trozo,
        model: VOYAGE_MODEL,
        input_type: inputType,
        output_dimension: VOYAGE_DIMS,
      }),
    });

    const texto = await respuesta.text();
    if (!respuesta.ok) {
      throw new Error(`Voyage respondió ${respuesta.status}: ${texto.slice(0, 300)}`);
    }

    const datos = JSON.parse(texto);
    // Voyage no garantiza el orden de `data`: trae un `index` por elemento y
    // hay que respetarlo. Confiar en el orden de llegada emparejaría cada
    // vector con el candidato equivocado, y el fallo sería silencioso — la
    // memoria simplemente ordenaría mal para siempre.
    const ordenados = new Array(trozo.length);
    for (const fila of datos.data ?? []) {
      ordenados[fila.index] = fila.embedding;
    }
    vectores.push(...ordenados);
  }

  return vectores;
}

// El texto con el que se representa a un candidato ANTES de mirarlo. Es todo lo
// que Apollo da gratis, y el nombre de la empresa es lo que más señal semántica
// aporta: "Herrajes Nordeste" dice más de a qué se dedican que la etiqueta de
// sector con la que los buscamos.
export function textoDeCandidato({ title, company } = {}) {
  return [title, company]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}
