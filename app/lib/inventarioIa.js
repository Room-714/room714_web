// Inventario de IA de la landing de IA en tu empresa: preguntas y reglas del
// resultado. Módulo puro, sin React ni servidor, porque lo usan los dos: el
// navegador para pintar el resultado y la API para recalcularlo (no se fía
// del que mande el cliente) y escribir el email.
//
// Los textos son los aprobados, tal cual.

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
];

export const PUNTOS = {
  visibilidad:
    "No hay visibilidad completa de qué se usa ni con qué datos. El primer paso es cerrar este inventario con cada equipo.",
  porSuCuenta:
    "Hay uso por iniciativa propia. Conviene acordar qué herramientas están aprobadas.",
  sensible:
    "Se introduce información sensible. Conviene decidir qué datos pueden usarse y en qué herramientas.",
  politica: "No hay una política de uso de IA escrita y comunicada.",
  formacion:
    "La formación no llega a toda la plantilla ni está adaptada a cada perfil.",
  buenaBase:
    "Tienes una buena base. El siguiente paso es decidir dónde incorporar la IA en tus procesos.",
};

export const NOTA_RESULTADO =
  "Es una orientación a partir de cinco respuestas, no una valoración legal.";

const DATOS_SENSIBLES = ["clientes", "empleados", "financiera"];

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

/** Nº de tipos de herramienta marcados, sin contar "No lo sé con certeza". */
export function contarHerramientas(respuestas) {
  return (respuestas.herramientas || []).filter((id) => id !== "nose").length;
}

/**
 * Los puntos a revisar, en el orden fijado y solo los que aplican. Si no
 * aplica ninguno, `puntos` va vacío y `buenaBase` es true.
 */
export function calcularResultado(respuestas) {
  const r = respuestas;
  const puntos = [];
  if (r.herramientas.includes("nose") || r.datos.includes("nose")) {
    puntos.push(PUNTOS.visibilidad);
  }
  if (r.quien.includes("porSuCuenta")) puntos.push(PUNTOS.porSuCuenta);
  if (r.datos.some((id) => DATOS_SENSIBLES.includes(id))) {
    puntos.push(PUNTOS.sensible);
  }
  if (!r.normas.includes("politica")) puntos.push(PUNTOS.politica);
  if (!r.formacion.includes("adaptada")) puntos.push(PUNTOS.formacion);

  const herramientas = contarHerramientas(r);
  return {
    herramientas,
    puntos,
    buenaBase: puntos.length === 0,
    encabezado: encabezado(herramientas, puntos.length),
  };
}

/** "N tipos de herramienta en uso y M puntos a revisar.", con su singular. */
export function encabezado(n, m) {
  const tipos = n === 1 ? "tipo" : "tipos";
  const puntos = m === 1 ? "punto" : "puntos";
  return `${n} ${tipos} de herramienta en uso y ${m} ${puntos} a revisar.`;
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
