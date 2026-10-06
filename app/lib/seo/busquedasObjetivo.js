// Búsquedas objetivo de los posts automáticos, por cluster y en orden de
// prioridad, y la regla que decide qué cluster y qué búsqueda toca cada día.
//
// Lo usa el orquestador del generador (app/lib/ai/orchestrator.js): el cron de
// lunes y miércoles toma el cluster del día y, dentro de él, la primera
// búsqueda que ningún título publicado cubre todavía. Si no queda ninguna, el
// generador vuelve a su comportamiento anterior y el correo lo avisa.
//
// Ninguna búsqueda puede ser una reservada a una página de servicio
// (RESERVED_QUERIES en clusters.js): lo comprueba busquedasObjetivo.test.js.

/** En orden de prioridad: la primera sin cubrir es la que se usa. Lista de José, 2026-10-06. */
export const BUSQUEDAS_OBJETIVO = {
  // Ideación y discovery (lunes de semanas ISO impares).
  C1: [
    "qué es el discovery de producto digital",
    "cómo validar una idea de producto digital",
    "cómo definir el MVP de un producto digital",
    "cómo priorizar funcionalidades de un producto digital",
    "errores al lanzar un producto digital",
    "design sprint para validar un producto",
    "business case de un producto digital",
    "roadmap de producto digital: cómo hacerlo",
  ],
  // Diseño y experiencia de cliente (miércoles).
  C2: [
    "cómo medir la experiencia de cliente en un producto digital",
    "diferencia entre diseño de producto y diseño UX",
    "métricas de experiencia de usuario en productos digitales",
    "cómo mejorar la experiencia de cliente en una app",
    "customer journey de un producto digital",
    "investigación de usuarios para productos digitales",
    "experiencia de empleado en herramientas internas",
    "sistema de diseño: cuándo merece la pena",
  ],
  // Desarrollo (lunes de semanas ISO pares).
  C3: [
    "fases del desarrollo de un producto digital",
    "cuánto cuesta desarrollar un producto digital",
    "software a medida o estándar: cómo decidir",
    "cómo modernizar software interno heredado",
    "cómo integrar IA en un producto digital existente",
    "cómo elegir el stack tecnológico de un producto digital",
    "deuda técnica en productos digitales",
    "equipo de desarrollo interno o externo",
  ],
};

/** Categoría del blog con la que se publica cada cluster. */
export const CATEGORIA_DEL_CLUSTER = { C1: "PRODUCT", C2: "UX", C3: "TECH" };

/** Año, mes, día y día de la semana de una fecha en el calendario de Madrid. */
function fechaMadrid(date) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return { y: Number(partes.year), m: Number(partes.month), d: Number(partes.day), weekday: partes.weekday };
}

/** Semana ISO 8601 (1-53) del día de Madrid en que cae `date`. */
export function semanaIso(date) {
  const { y, m, d } = fechaMadrid(date);
  const dia = new Date(Date.UTC(y, m - 1, d));
  // El jueves de esa semana decide a qué año ISO pertenece.
  const diaSemana = dia.getUTCDay() || 7;
  dia.setUTCDate(dia.getUTCDate() + 4 - diaSemana);
  const inicioAnio = new Date(Date.UTC(dia.getUTCFullYear(), 0, 1));
  return Math.ceil(((dia - inicioAnio) / 86400000 + 1) / 7);
}

/**
 * Cluster y categoría del post que se publica en `date` (hora de Madrid).
 * Miércoles: C2. Lunes: C1 en semanas ISO impares y C3 en las pares.
 * Cualquier otro día: null (el generador usa la rotación de categorías de siempre).
 */
export function clusterDelDia(date) {
  const { weekday } = fechaMadrid(date);
  let cluster = null;
  if (weekday === "Wed") cluster = "C2";
  else if (weekday === "Mon") cluster = semanaIso(date) % 2 === 1 ? "C1" : "C3";
  return cluster ? { cluster, category: CATEGORIA_DEL_CLUSTER[cluster] } : null;
}

const VACIAS = new Set(
  "a al con como cual cuando cuanto de del donde el en entre es la las lo los o para por que se sin su sus tu tus un una uno y".split(" "),
);

/** Palabras con significado de un texto: minúsculas, sin acentos ni palabras vacías. */
function palabras(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9ñ]+/)
    .filter((p) => p && !VACIAS.has(p));
}

// Raíz tosca para que el singular y el plural cuenten igual ("producto" y
// "productos", "error" y "errores").
const raiz = (p) => (p.length > 4 ? p.replace(/(es|s)$/, "") : p);

/**
 * Un texto responde a una búsqueda si contiene todas sus palabras con
 * significado, en cualquier orden y sin importar acentos ni plurales.
 */
export function respondeABusqueda(busqueda, texto) {
  const delTexto = new Set(palabras(texto).map(raiz));
  const deLaBusqueda = palabras(busqueda).map(raiz);
  return deLaBusqueda.length > 0 && deLaBusqueda.every((p) => delTexto.has(p));
}

/**
 * La primera búsqueda del cluster que ningún título publicado (en español)
 * cubre todavía, o null si ya están todas cubiertas.
 * `publicados` es la lista de títulos que ya recibe el generador
 * (getPublishedTitles: { title_es, title_en, ... }).
 */
export function elegirBusqueda(cluster, publicados, lista = BUSQUEDAS_OBJETIVO) {
  const busquedas = lista[cluster] || [];
  const titulos = (publicados || []).map((p) => p.title_es).filter(Boolean);
  const posicion = busquedas.findIndex((b) => !titulos.some((t) => respondeABusqueda(b, t)));
  return posicion === -1 ? null : { busqueda: busquedas[posicion], posicion: posicion + 1, total: busquedas.length };
}
