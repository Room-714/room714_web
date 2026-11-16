// Cuestionario de IA de la landing «Incorporar la IA en tu empresa»: preguntas
// y reglas del diagnóstico. Módulo puro, sin React ni servidor, porque lo usan
// los dos: el navegador para enseñar el nivel y la API para recalcularlo (no
// se fía del que mande el cliente) y escribir el email.
//
// Los textos son los aprobados por José Antonio (2026-11-16), tal cual.

export const PREGUNTAS = [
  {
    id: "herramientas",
    texto: "¿Qué herramientas de IA se usan hoy en tu empresa?",
    multiple: true,
    opciones: [
      { id: "chat", texto: "Asistentes de chat generalistas" },
      { id: "ofimatica", texto: "IA integrada en ofimática y correo" },
      { id: "gestion", texto: "IA dentro de programas de gestión" },
      { id: "multimedia", texto: "Herramientas de imagen, vídeo o voz" },
      { id: "programacion", texto: "Asistentes de programación" },
      { id: "nose", texto: "No lo sé con certeza" },
    ],
  },
  {
    id: "quien",
    texto: "¿Quién las usa?",
    multiple: false,
    opciones: [
      { id: "casiNadie", texto: "Casi nadie" },
      { id: "porSuCuenta", texto: "Algunas personas, por su cuenta" },
      { id: "equipos", texto: "Algunos equipos, de forma organizada" },
      { id: "casiToda", texto: "Casi toda la plantilla" },
    ],
  },
  {
    id: "datos",
    texto: "¿Qué información se introduce en ellas?",
    multiple: true,
    opciones: [
      { id: "documentos", texto: "Documentos y textos internos" },
      { id: "clientes", texto: "Datos de clientes o proveedores" },
      { id: "empleados", texto: "Datos personales de empleados" },
      { id: "financiera", texto: "Información financiera o contractual" },
      { id: "codigo", texto: "Código o información técnica" },
      { id: "nose", texto: "No lo sé con certeza" },
    ],
  },
  {
    id: "normas",
    texto: "¿Hay normas sobre el uso de la IA?",
    multiple: false,
    opciones: [
      { id: "ninguna", texto: "No hay normas" },
      { id: "informales", texto: "Indicaciones informales" },
      { id: "politica", texto: "Política escrita y comunicada" },
    ],
  },
  {
    id: "formacion",
    texto: "¿Ha recibido formación la plantilla?",
    multiple: false,
    opciones: [
      { id: "no", texto: "No" },
      { id: "algunas", texto: "Solo algunas personas" },
      { id: "adaptada", texto: "Sí, adaptada a cada perfil" },
    ],
  },
  {
    id: "cuentas",
    texto: "¿Con qué cuentas se usa la IA?",
    multiple: false,
    opciones: [
      { id: "personales", texto: "Cada uno con su cuenta personal" },
      { id: "sinGestion", texto: "Algunas cuentas de empresa, sin gestión centralizada" },
      { id: "gestionadas", texto: "Cuentas de empresa gestionadas por IT" },
    ],
  },
  {
    id: "plan",
    texto: "¿Habéis decidido en qué procesos aplicar la IA?",
    multiple: false,
    opciones: [
      { id: "no", texto: "No" },
      { id: "pruebas", texto: "Hay pruebas sueltas" },
      { id: "plan", texto: "Sí, con un plan y prioridades" },
    ],
  },
];

export const NIVELES = {
  critico: {
    etiqueta: "Criticidad muy alta",
    titular: "Tu empresa necesita actuar ya.",
    texto:
      "La IA se usa con datos sensibles, sin normas ni control. Si mañana hay una fuga o una reclamación, la empresa no podría explicar qué se subió ni dónde.",
  },
  alto: {
    etiqueta: "Criticidad alta",
    titular: "Tu empresa necesita poner orden pronto.",
    texto:
      "Hay uso real de la IA, pero sin las reglas ni la formación que exige la normativa. El riesgo crece cada semana que pasa.",
  },
  moderado: {
    etiqueta: "Criticidad moderada",
    titular: "Vas por buen camino, pero quedan huecos.",
    texto: "Hay cierto control, pero faltan piezas para que el uso sea seguro y demostrable.",
  },
  bajo: {
    etiqueta: "Criticidad baja",
    titular: "Tienes una buena base.",
    texto: "El uso está ordenado. El siguiente paso es decidir dónde aporta la IA en tus procesos.",
  },
};

export const NORMATIVA = {
  articulo4: {
    titulo: "Reglamento europeo de IA (artículo 4)",
    texto:
      "Las empresas que usan IA deben tomar medidas para que su personal sepa utilizarla. No exige un certificado, pero conviene poder demostrar lo que se ha hecho.",
  },
  rgpd: {
    titulo: "Protección de datos (RGPD)",
    texto:
      "Introducir datos de clientes o empleados en herramientas que la empresa no controla es un tratamiento de datos del que la empresa es responsable.",
  },
};

// En este orden de prioridad; el diagnóstico se queda con los tres primeros
// que apliquen.
export const PASOS = {
  datos: "Decide qué datos no se meten nunca en una IA y comunícalo a toda la plantilla.",
  cuentas: "Pasa a cuentas de empresa gestionadas por IT: así sabes quién usa qué y con qué datos.",
  normas: "Deja por escrito una política de uso de una página que conozca todo el equipo.",
  visibilidad: "Haz inventario: qué herramientas se usan, quién las usa y para qué.",
  formacion:
    "Forma a la plantilla en un uso consciente, con casos de su propio trabajo, y deja constancia de ello.",
  plan: "Decide con dirección en qué procesos aporta la IA y con qué prioridad.",
};

export const CIERRE = {
  titulo: "Esto es exactamente lo que hacemos en Room 714.",
  texto:
    "En tres meses formamos a tu equipo y fijamos contigo un plan para incorporar la IA con orden. Cuéntanos tu caso y te decimos por dónde empezaríamos.",
  cta: "Hablemos",
};

const DATOS_SENSIBLES = ["clientes", "empleados", "financiera"];
const DATOS_PERSONALES = ["clientes", "empleados"];
const MAX_PASOS = 3;

/** Respuestas vacías: un array por pregunta. */
export function respuestasVacias() {
  return Object.fromEntries(PREGUNTAS.map((p) => [p.id, []]));
}

/**
 * Comprueba y normaliza lo que llega del cliente: solo ids conocidos, sin
 * repetidos, al menos una respuesta por pregunta y una sola en las de
 * respuesta única. Devuelve null si algo no cuadra.
 */
export function validarRespuestas(entrada) {
  if (!entrada || typeof entrada !== "object") return null;
  const salida = {};
  for (const p of PREGUNTAS) {
    const valor = entrada[p.id];
    if (!Array.isArray(valor)) return null;
    const validos = new Set(p.opciones.map((o) => o.id));
    const ids = [...new Set(valor)].filter((v) => validos.has(v));
    if (ids.length !== valor.length || ids.length === 0) return null;
    if (!p.multiple && ids.length > 1) return null;
    // En el orden de las opciones, para que el resultado no dependa del
    // orden en que se marcaron.
    salida[p.id] = p.opciones.map((o) => o.id).filter((id) => ids.includes(id));
  }
  return salida;
}

/** Puntos de riesgo y señales de las respuestas. */
export function riesgos(r) {
  const sensibles = r.datos.some((id) => DATOS_SENSIBLES.includes(id));
  const visibilidad = r.herramientas.includes("nose") || r.datos.includes("nose");
  const sinNormas = r.normas.includes("ninguna");
  const puntos =
    (sensibles ? 3 : 0) +
    (visibilidad ? 2 : 0) +
    (r.cuentas.includes("personales") ? 2 : r.cuentas.includes("sinGestion") ? 1 : 0) +
    (sinNormas ? 2 : r.normas.includes("informales") ? 1 : 0) +
    (r.formacion.includes("no") ? 2 : r.formacion.includes("algunas") ? 1 : 0) +
    (r.quien.includes("porSuCuenta") ? 1 : 0);
  return { puntos, sensibles, visibilidad, sinNormas };
}

/**
 * El nivel de criticidad. «Muy alta» (critico) exige datos sensibles (es lo
 * que dice su texto); con datos sensibles y sin normas, es como mínimo «Alta».
 */
export function nivel(r) {
  const { puntos, sensibles, sinNormas } = riesgos(r);
  if (sensibles && puntos >= 8) return "critico";
  if (puntos >= 5 || (sensibles && sinNormas)) return "alto";
  if (puntos >= 2) return "moderado";
  return "bajo";
}

/** Los pasos que aplican, en orden de prioridad y como mucho tres. */
export function pasos(r) {
  const { sensibles, visibilidad } = riesgos(r);
  const aplican = [
    sensibles && "datos",
    !r.cuentas.includes("gestionadas") && "cuentas",
    !r.normas.includes("politica") && "normas",
    visibilidad && "visibilidad",
    !r.formacion.includes("adaptada") && "formacion",
    !r.plan.includes("plan") && "plan",
  ].filter(Boolean);
  return aplican.slice(0, MAX_PASOS);
}

/** La normativa que se le menciona: nada en «Bajo». */
export function normativa(r, idNivel) {
  if (idNivel === "bajo") return [];
  const claves = ["articulo4"];
  if (r.datos.some((id) => DATOS_PERSONALES.includes(id))) claves.push("rgpd");
  return claves;
}

/** El diagnóstico completo, con los textos ya resueltos. */
export function diagnostico(respuestas) {
  const idNivel = nivel(respuestas);
  return {
    nivel: idNivel,
    ...NIVELES[idNivel],
    normativa: normativa(respuestas, idNivel).map((k) => NORMATIVA[k]),
    pasos: pasos(respuestas).map((k) => PASOS[k]),
  };
}

/** Las respuestas con su texto, para guardarlas legibles con el contacto. */
export function respuestasLegibles(respuestas) {
  return PREGUNTAS.map((p) => ({
    pregunta: p.texto,
    respuestas: respuestas[p.id].map(
      (id) => p.opciones.find((o) => o.id === id).texto,
    ),
  }));
}
