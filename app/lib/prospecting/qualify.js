// El cualificador: convierte "un cargo y un nombre de empresa" en los cuatro
// veredictos que hacen falta para decidir, con su evidencia y sus fuentes.
//
// Dos funciones con la MISMA forma de salida, para que la ficha no tenga que
// saber cuál la produjo:
//   quickLook()  — Haiku 4.5, automático en el cron, ~0,022 $ medido
//   deepDive()   — Opus 5, solo cuando el humano pulsa el botón, ~0,33 $ medido
//
// El cliente de Anthropic se inyecta para poder probar esto sin red.

import { costOf } from "./aiCost";

export const MODELO_VISTAZO = "claude-haiku-4-5";
export const MODELO_FONDO = "claude-opus-5";

const CRITERIOS = ["revenue", "digitalNeed", "itTeam", "advisory"];
const VEREDICTOS_VALIDOS = ["pass", "unclear", "fail"];

const ETIQUETAS = {
  revenue: "Facturación",
  digitalNeed: "Necesita producto digital",
  itTeam: "Equipo IT",
  advisory: "Necesidad de orientación",
};

// Herramienta del vistazo: la versión básica, verificada contra Haiku 4.5.
const BUSQUEDA_VISTAZO = { type: "web_search_20250305", name: "web_search", max_uses: 2 };

// Herramienta del análisis a fondo: versión con filtrado dinámico, que criba
// los resultados antes de que entren en contexto. NO se declara
// `code_execution` aparte: la API lo provisiona sola para el filtrado.
//
// max_uses 3, medido: con 3 búsquedas el análisis consumió 49.974 tokens de
// ENTRADA. Los resultados entran como input aunque el filtrado los criba;
// `response_inclusion: "excluded"` recorta la SALIDA, no la entrada. Cada
// búsqueda de más son ~0,08 $, así que este número es la palanca de coste real.
const BUSQUEDA_FONDO = {
  type: "web_search_20260318",
  name: "web_search",
  max_uses: 3,
  response_inclusion: "excluded",
};

const SISTEMA = `Eres el analista de prospección de Room714, un estudio que ayuda a
empresas medianas a decidir y construir el producto digital que su negocio
necesita: e-commerce, ERP, portales de cliente, SaaS que entregan a sus clientes.

Room714 NO vende soporte al puesto de trabajo ni administración de sistemas.
Vende criterio técnico y ejecución para empresas que no tienen quien decida eso
dentro.

Tu trabajo es juzgar si una empresa encaja como cliente, según cuatro criterios:

1. revenue — factura entre 50 y 100 millones de euros. Devuelve la cifra que
   encuentres en el campo amountEurM, EN MILLONES DE EUROS y como número (424,
   no "424 millones"; 0.5 para medio millón), o null si no la encuentras. El
   veredicto es "pass" SOLO si la cifra está dentro de 50-100: una empresa de
   424 M€ es "fail", no "pass", por mucho que encaje en todo lo demás.
2. digitalNeed — su actividad NO es hacer producto digital, pero necesita uno
   para funcionar. Una empresa de software, una agencia digital o una
   consultora tecnológica NO encaja: resuelven dentro lo que vendemos.
3. itTeam — tiene equipo de IT propio, pero pequeño (orientativamente 2 a 6
   personas) y dedicado a tareas operativas: sistemas, soporte, redes. Si hay
   perfiles de producto, diseño o desarrollo, o el equipo es grande, no encaja.
4. advisory — necesita orientación o soporte en un sentido amplio: hay
   decisiones técnicas sin dueño dentro de la casa. Necesitar solo soporte al
   puesto de trabajo NO cuenta.

Reglas de disciplina, y son lo más importante de estas instrucciones:

- NO ADIVINES. Si no encuentras fuente para algo, el veredicto es "unclear".
  "unclear" es una respuesta correcta y esperada, no un fracaso.
- Solo pon "fail" cuando la evidencia lo sostenga, no cuando falte evidencia.
- Cita siempre de dónde sale cada dato, con URL cuando la tengas.
- En España las cuentas se depositan con uno o dos años de retraso y los grupos
  con varias sociedades no consolidan en público. Di el ejercicio del dato y no
  presentes una estimación como un dato verificado.

Dónde buscar la facturación de una empresa española, por orden de utilidad:
einforma, Axesor, Infoempresa, Empresite de El Economista y el Registro
Mercantil. Buscar el nombre de la empresa junto a "facturación", "ingresos" o
"cuentas anuales" suele dar antes que buscar el nombre solo. Si con las búsquedas
que tienes no llegas a una cifra con fuente, el veredicto es "unclear" y
amountEurM es null: eso es correcto, y alguien profundizará después.`;

// El rango de facturación que buscamos, en millones de euros. Vive aquí porque
// es lo único de los cuatro criterios que se puede comprobar con aritmética en
// vez de con juicio (ver `forzarRangoDeFacturacion`).
export const FACTURACION_MIN_M = 50;
export const FACTURACION_MAX_M = 100;

function propiedadesDeCriterio(extra = {}) {
  const propiedades = {
    verdict: { type: "string", enum: VEREDICTOS_VALIDOS },
    value: { type: "string" },
    evidence: { type: "string" },
    sources: { type: "array", items: { type: "string" } },
    ...extra,
  };
  return {
    type: "object",
    properties: propiedades,
    required: Object.keys(propiedades),
    additionalProperties: false,
  };
}

const ESQUEMA_SALIDA = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: Object.fromEntries([
      ...CRITERIOS.map((c) => [
        c,
        // A la facturación se le pide además la cifra COMO NÚMERO, para poder
        // comprobar el rango en código en vez de creernos el veredicto.
        propiedadesDeCriterio(
          c === "revenue"
            ? {
                amountEurM: {
                  type: ["number", "null"],
                  description:
                    "Facturación anual en millones de euros, como número. null si no se ha encontrado.",
                },
              }
            : {},
        ),
      ]),
      ["summary", { type: "string" }],
    ]),
    required: [...CRITERIOS, "summary"],
    additionalProperties: false,
  },
};

// ─── Puro ───────────────────────────────────────────────────────────────────

// Saca el JSON de una respuesta, aunque venga envuelto en prosa o en un bloque
// de código: con salida estructurada no debería hacer falta, pero el coste de
// tolerarlo es una línea y el de no tolerarlo es tirar un análisis ya pagado.
function extraerJSON(texto) {
  const limpio = String(texto ?? "").trim();
  const enBloque = limpio.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidato = (enBloque ? enBloque[1] : limpio).trim();

  const inicio = candidato.indexOf("{");
  if (inicio === -1) return null;

  // Se recorre contando llaves para quedarse con el PRIMER objeto completo y
  // bien balanceado, ignorando las llaves que van dentro de cadenas.
  //
  // Antes esto era `slice(indexOf("{"), lastIndexOf("}") + 1)`, y se rompió en
  // un caso real: cuando la respuesta trae dos objetos JSON seguidos, ese corte
  // los abarca a los dos y produce algo que no parsea
  // ("Unexpected non-whitespace character after JSON at position 2987").
  // Descubrirlo costó un análisis ya pagado, así que el recorrido con contador
  // se queda aunque parezca desproporcionado para un `slice`.
  let profundidad = 0;
  let enCadena = false;
  let escapado = false;

  for (let i = inicio; i < candidato.length; i++) {
    const ch = candidato[i];
    if (enCadena) {
      if (escapado) escapado = false;
      else if (ch === "\\") escapado = true;
      else if (ch === '"') enCadena = false;
      continue;
    }
    if (ch === '"') enCadena = true;
    else if (ch === "{") profundidad += 1;
    else if (ch === "}") {
      profundidad -= 1;
      if (profundidad === 0) return candidato.slice(inicio, i + 1);
    }
  }

  return null;
}

export function parseVerdicts(texto) {
  const json = extraerJSON(texto);
  if (!json) return { ok: false, error: "la respuesta no contenía JSON" };

  let datos;
  try {
    datos = JSON.parse(json);
  } catch (err) {
    return { ok: false, error: `JSON inválido: ${err.message}` };
  }

  const faltan = CRITERIOS.filter((c) => !datos?.[c] || typeof datos[c] !== "object");
  if (faltan.length) {
    return { ok: false, error: `faltan criterios en el JSON: ${faltan.join(", ")}` };
  }

  // Un veredicto que no reconocemos se normaliza a "unclear", nunca a "pass":
  // ante una respuesta rara, el sesgo va hacia mirar más, no hacia colar a
  // alguien en la cola.
  const veredictos = { summary: String(datos.summary ?? "") };
  for (const c of CRITERIOS) {
    const bruto = datos[c];
    veredictos[c] = {
      verdict: VEREDICTOS_VALIDOS.includes(bruto.verdict) ? bruto.verdict : "unclear",
      value: String(bruto.value ?? ""),
      evidence: String(bruto.evidence ?? ""),
      sources: Array.isArray(bruto.sources) ? bruto.sources.filter(Boolean).map(String) : [],
      // Solo la facturación trae cifra numérica, y se conserva porque
      // `forzarRangoDeFacturacion` la necesita para comprobar el rango.
      ...(c === "revenue"
        ? { amountEurM: Number.isFinite(bruto.amountEurM) ? bruto.amountEurM : null }
        : {}),
    };
  }

  return { ok: true, veredictos: forzarRangoDeFacturacion(veredictos) };
}

// La facturación es el único criterio donde el NÚMERO manda sobre el juicio del
// modelo, y hace falta porque falló en una prueba real: a Grupo Siro, con 424
// millones de euros, le puso veredicto "pass" — con la cifra correcta escrita
// al lado, en el mismo objeto. Comprobar si un número cae dentro de un rango es
// aritmética, no criterio, y la aritmética no se delega.
//
// Solo corrige hacia "fail" cuando la cifra está fuera de rango. Si está
// dentro, se respeta el veredicto del modelo: puede tener motivos para dudar
// que nosotros no vemos (un grupo que no consolida, una cifra de hace tres
// años), y esos sí son criterio.
export function forzarRangoDeFacturacion(veredictos) {
  const cifra = veredictos?.revenue?.amountEurM;
  if (!Number.isFinite(cifra)) return veredictos;
  if (cifra >= FACTURACION_MIN_M && cifra <= FACTURACION_MAX_M) return veredictos;

  return {
    ...veredictos,
    revenue: {
      ...veredictos.revenue,
      verdict: "fail",
      evidence:
        `${veredictos.revenue.evidence} ` +
        `[${cifra} M€ está fuera del rango ${FACTURACION_MIN_M}-${FACTURACION_MAX_M} M€: ` +
        `veredicto corregido en código.]`.trim(),
    },
  };
}

// Los ejemplos que van en el prompt: las decisiones pasadas más parecidas a
// este candidato. Es el mecanismo por el que el juicio del modelo converge con
// el del usuario — no con más datos de la empresa, sino con más ejemplos de
// dónde pone él la frontera.
export function construirEjemplos(vecinos = []) {
  const decisiones = vecinos.filter((v) => (v.kind ?? "decision") === "decision" && v.metadata?.decision);
  if (decisiones.length === 0) return "";

  const filas = decisiones.map((v) => {
    const motivo = v.metadata?.reasonCode ? ` (motivo: ${v.metadata.reasonCode})` : "";
    return `- ${v.text}${motivo}`;
  });

  return `\n\nDecisiones anteriores de este usuario sobre empresas parecidas.
Úsalas para calibrar dónde pone él la frontera, no para copiar el veredicto:\n${filas.join("\n")}`;
}

// Cuando el vistazo va en una sola llamada, la respuesta ES el JSON: no hay
// informe en prosa. El chat y el análisis a fondo consumen `report` como
// contexto, así que se reconstruye desde los veredictos en vez de pasarles el
// JSON en crudo, que leerían peor.
export function informeDesdeVeredictos(veredictos) {
  const lineas = CRITERIOS.map((c) => {
    const x = veredictos[c] ?? {};
    const fuentes = x.sources?.length ? ` (${x.sources.join(", ")})` : "";
    return `- ${ETIQUETAS[c]}: ${x.verdict} — ${x.value}. ${x.evidence}${fuentes}`;
  });
  return [veredictos.summary, ...lineas].filter(Boolean).join("\n");
}

function promptCandidato({ title, company }, extra = "") {
  return `Empresa: ${company ?? "(sin nombre)"}
Cargo del contacto: ${title ?? "(sin cargo)"}

Investiga esta empresa y responde a los cuatro criterios.${extra}`;
}

// ─── Con la API ─────────────────────────────────────────────────────────────

// `estructurarAparte` decide si van dos llamadas o una, y no es una preferencia
// de estilo: se midió contra la API.
//
//   - El VISTAZO va en UNA llamada. Haiku busca en la web y devuelve el JSON
//     estructurado en la misma petición. Ahorra ~20%.
//   - El ANÁLISIS A FONDO va en DOS. La API acepta la combinación en Opus 5,
//     pero en la prueba el modelo NO buscó ni una vez cuando se le pidió
//     también el esquema. Una sola muestra no prueba que el esquema suprima la
//     búsqueda, pero el valor entero del análisis a fondo es que investigue y
//     no vamos a jugárnosla por ahorrar una llamada corta.
async function cualificar(
  candidato,
  { client, ejemplos = [], modelo, herramienta, extraPrompt = "", thinking, estructurarAparte },
) {
  const llamadas = [];

  // El bloque de ejemplos SOLO se añade si hay ejemplos de verdad.
  //
  // Aquí había un `|| " "` para evitar mandar un bloque vacío, y no valía: la
  // API rechaza con 400 cualquier bloque de texto vacío O QUE SEA SOLO
  // ESPACIOS ("system: text content blocks must contain non-whitespace text").
  // Comprobado contra la API real: con la memoria vacía fallaban TODAS las
  // llamadas, así que la cola habría salido vacía cada mañana. Y la memoria
  // está vacía precisamente el primer día, que es cuando menos se puede
  // permitir que esto falle.
  //
  // Los ejemplos van DESPUÉS del breakpoint de caché a propósito: cambian por
  // candidato, así que dejarlos fuera del prefijo cacheado es lo que permite
  // que el bloque de sistema se pague entero una sola vez al día.
  const ejemplosTexto = construirEjemplos(ejemplos);
  const sistema = [
    { type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } },
    ...(ejemplosTexto ? [{ type: "text", text: ejemplosTexto }] : []),
  ];

  try {
    // 1 · Investigar, con búsqueda web. Si no se estructura aparte, esta misma
    // llamada devuelve ya el JSON.
    const investigacion = await client.messages.create({
      model: modelo,
      max_tokens: 4096,
      ...(thinking ? { thinking } : {}),
      ...(estructurarAparte ? {} : { output_config: { format: ESQUEMA_SALIDA } }),
      system: sistema,
      tools: [herramienta],
      messages: [{ role: "user", content: promptCandidato(candidato, extraPrompt) }],
    });
    llamadas.push({ model: modelo, usage: investigacion.usage });

    const primeraSalida = investigacion.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    let textoJSON = primeraSalida;
    let report = primeraSalida;

    if (estructurarAparte) {
      // 2 · Estructurar, sin herramientas.
      const estructura = await client.messages.create({
        model: modelo,
        max_tokens: 2048,
        output_config: { format: ESQUEMA_SALIDA },
        messages: [
          {
            role: "user",
            content: `Convierte este análisis en el JSON de los cuatro criterios.
No añadas información que no esté en el análisis.

${primeraSalida}`,
          },
        ],
      });
      llamadas.push({ model: modelo, usage: estructura.usage });
      textoJSON = estructura.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
    }

    const cost = llamadas.reduce((t, l) => t + costOf(l.model, l.usage), 0);
    const parseado = parseVerdicts(textoJSON);

    if (!parseado.ok) {
      // El coste ya se ha gastado aunque el parseo falle: devolverlo es lo que
      // impide que el tope diario del cron se quede corto y siga gastando.
      return { ok: false, error: parseado.error, cost, report };
    }

    // En una sola llamada no hay prosa que devolver: se reconstruye.
    if (!estructurarAparte) report = informeDesdeVeredictos(parseado.veredictos);

    return { ok: true, veredictos: parseado.veredictos, report, cost };
  } catch (err) {
    const cost = llamadas.reduce((t, l) => t + costOf(l.model, l.usage), 0);
    console.error("[prospeccion] cualificar falló:", err.message);
    return { ok: false, error: err.message, cost };
  }
}

// El vistazo del cron. Barato y poco exhaustivo a propósito: su trabajo no es
// acertar, es no dejar pasar lo que claramente no encaja.
export async function quickLook(candidato, { client, ejemplos = [] } = {}) {
  const r = await cualificar(candidato, {
    client,
    ejemplos,
    modelo: MODELO_VISTAZO,
    herramienta: BUSQUEDA_VISTAZO,
    // Haiku 4.5 no admite `output_config.effort` y su thinking es el antiguo
    // con budget_tokens: lo más simple y seguro es no mandar ninguno.
    thinking: null,
    estructurarAparte: false,
  });
  return { ...r, depth: "vistazo" };
}

// El análisis a demanda. Parte del vistazo ya hecho y ataca lo que quedó en
// duda, que es exactamente para lo que el humano ha pulsado el botón.
export async function deepDive(candidato, { client, ejemplos = [], dossierPrevio = null } = {}) {
  const dudas = dossierPrevio
    ? CRITERIOS.filter((c) => dossierPrevio.veredictos?.[c]?.verdict === "unclear")
    : [];

  const extra = dossierPrevio
    ? `\n\nYa existe un análisis rápido previo:\n${dossierPrevio.report ?? ""}\n\n${
        dudas.length
          ? `Céntrate en resolver lo que quedó sin confirmar: ${dudas.join(", ")}.`
          : "Confirma o corrige los veredictos anteriores con fuentes mejores."
      }`
    : "";

  const r = await cualificar(candidato, {
    client,
    ejemplos,
    modelo: MODELO_FONDO,
    herramienta: BUSQUEDA_FONDO,
    extraPrompt: extra,
    thinking: { type: "adaptive" },
    estructurarAparte: true,
  });
  return { ...r, depth: "fondo" };
}
