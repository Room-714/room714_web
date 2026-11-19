// Búsquedas objetivo de los posts automáticos, por cluster y en orden de
// prioridad, y la regla que decide qué cluster y qué búsqueda toca a cada post.
//
// Lo usa el orquestador del generador (app/lib/ai/orchestrator.js): el cron de
// lunes y jueves toma el cluster que lleva más tiempo sin post (clusterQueToca)
// y, dentro de él, la primera búsqueda que ningún título publicado cubre todavía. Si no queda ninguna, el
// generador vuelve a su comportamiento anterior y el correo lo avisa.
//
// Ninguna búsqueda puede ser una reservada a una página de servicio
// (RESERVED_QUERIES en clusters.js): lo comprueba busquedasObjetivo.test.js.

import { CATEGORY_CLUSTER } from "./clusters";

/** En orden de prioridad: la primera sin cubrir es la que se usa. Lista de José, 2026-10-06. */
export const BUSQUEDAS_OBJETIVO = {
  // Ideación y discovery.
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
  // Diseño y experiencia de cliente.
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
  // Desarrollo.
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

// Orden de desempate entre clusters igual de atrasados: el mismo que la
// preferencia de la página de empresa de LinkedIn (C2 > C1 > C3).
const ORDEN_DESEMPATE = ["C2", "C1", "C3"];

/**
 * Cluster y categoría del próximo post automático: el cluster que lleva más
 * tiempo sin post (publicado o programado; los borradores no cuentan). Un
 * cluster sin ningún post va primero. El cluster de un post sale de su
 * categoría (no tiene columna propia). `corpus`: el de cargarCorpus.
 */
export function clusterQueToca(corpus = []) {
  const ultimo = Object.fromEntries(ORDEN_DESEMPATE.map((c) => [c, -Infinity]));
  for (const post of corpus) {
    if (!post.published) continue;
    const cluster = CATEGORY_CLUSTER[post.category];
    if (!cluster) continue;
    ultimo[cluster] = Math.max(ultimo[cluster], new Date(post.date).getTime());
  }
  const cluster = [...ORDEN_DESEMPATE].sort(
    (a, b) => ultimo[a] - ultimo[b] || ORDEN_DESEMPATE.indexOf(a) - ORDEN_DESEMPATE.indexOf(b),
  )[0];
  return {
    cluster,
    category: CATEGORIA_DEL_CLUSTER[cluster],
    ultimoPost: Number.isFinite(ultimo[cluster]) ? new Date(ultimo[cluster]) : null,
  };
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
 * La primera búsqueda del cluster que ningún post existente (en español)
 * cubre todavía, o null si ya están todas cubiertas.
 * `publicados` es la lista que ya recibe el generador (titulosExistentes en
 * app/lib/ai/duplicados.js: { title_es, metaTitle_es, slug_es, ... }).
 *
 * Mira el título, el metaTitle y el slug. Mirar solo el título hizo que
 * "diferencia entre diseño de producto y diseño UX" se diera por libre cuatro
 * miércoles seguidos: ningún título decía "diferencia", pero el slug del
 * primer post sí. `evitar` son búsquedas descartadas a mano ("Elegir otro
 * ángulo" en el panel).
 */
export function elegirBusqueda(cluster, publicados, lista = BUSQUEDAS_OBJETIVO, evitar = []) {
  const busquedas = lista[cluster] || [];
  const textos = (publicados || [])
    .flatMap((p) => [p.title_es, p.metaTitle_es, p.slug_es?.replace(/-/g, " ")])
    .filter(Boolean);
  const descartadas = new Set(evitar.map((t) => String(t).trim().toLowerCase()));
  const posicion = busquedas.findIndex(
    (b) => !descartadas.has(b.toLowerCase()) && !textos.some((t) => respondeABusqueda(b, t)),
  );
  return posicion === -1 ? null : { busqueda: busquedas[posicion], posicion: posicion + 1, total: busquedas.length };
}
