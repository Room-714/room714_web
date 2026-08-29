// Las reglas que ajustan la búsqueda salen de CONTAR las decisiones, no de una
// tabla de estado. Esa es la decisión de diseño importante de este módulo, y
// tiene una consecuencia que conviene entender antes de cambiarla: si un día
// cambias de opinión sobre un descarte, la regla que ese descarte provocó
// desaparece sola. No hay estado que corregir ni migración que hacer.
//
// La contrapartida es que la política vive en los umbrales de aquí abajo, y
// tocarlos cambia la búsqueda de mañana. Por eso son constantes exportadas y
// tienen tests propios.

import { normalizeTitle } from "./candidateFilter";

// Tres descartes por rol bastan para PROPONER la exclusión de un cargo, pero
// el número no es lo que evita el trinquete: es la guarda `yes === 0` de más
// abajo. Sin denominador ni ventana temporal, un recuento que solo crece hace
// que cualquier cargo con una tasa de rechazo mayor que cero acabe excluido
// tarde o temprano — un cargo bueno rechazado uno de cada diez tiene un 59% de
// probabilidad de acumular tres noes en tres semanas. Por eso "el coste de
// excluir un cargo bueno es bajo y reversible" era mentira: con solo el
// recuento, el coste es alto y el error se acumula sin que nada lo revierta.
// Exigir además que ningún sí lo haya salvado nunca es lo que de verdad hace
// barato el error: basta un acierto para que el cargo quede fuera de esta
// lista para siempre, sea cual sea su recuento de noes.
export const TITLE_STRIKES = 3;

// Cinco para un tramo de plantilla, y solo si NUNCA ha dado un sí. Aquí el coste
// del error es mucho mayor: solo hay dos tramos, y quedarse sin uno reduce a la
// mitad el pozo de candidatos.
export const SIZE_STRIKES = 5;

// Los motivos que cuentan para cada acumulador.
const REASON_ROLE = "role";
const REASON_SIZE = "size";
// 'legacy' es el motivo que una migración le pone a filas antiguas: decisiones
// que nadie tomó de verdad. No debe alimentar ninguna regla (ni cargos, ni
// tramos, ni la tasa de acierto de sectores) sea cual sea la decisión que
// lleve encima: un 'no' legacy no es un descarte real, pero un 'yes' legacy
// tampoco es un acierto real, y dejarlo colar salvaría cargos y tramos que
// nadie ha aprobado de verdad. Por eso la guarda mira solo el motivo, nunca la
// decisión, y se aplica una sola vez, antes de tocar ningún acumulador.
const REASON_LEGACY = "legacy";

export function deriveRules(decisions = []) {
  const titleStats = new Map(); // título normalizado → { original, count, yes }
  const sizeStats = new Map(); // tramo → { no, yes }
  const sectorStats = new Map(); // sector → { hits, total }

  for (const d of decisions) {
    const esNo = d.decision === "no";
    const esSi = d.decision === "yes";
    if (!esNo && !esSi) continue;

    if (d.reasonCode === REASON_LEGACY) continue;

    if (d.title) {
      const key = normalizeTitle(d.title);
      const prev = titleStats.get(key) ?? { original: d.title.trim(), count: 0, yes: 0 };
      if (esNo && d.reasonCode === REASON_ROLE) prev.count += 1;
      if (esSi) prev.yes += 1;
      titleStats.set(key, prev);
    }

    if (d.sizeQuery) {
      const prev = sizeStats.get(d.sizeQuery) ?? { no: 0, yes: 0 };
      if (esSi) prev.yes += 1;
      else if (d.reasonCode === REASON_SIZE) prev.no += 1;
      sizeStats.set(d.sizeQuery, prev);
    }

    // Al sector le cuenta todo: un sí es un acierto, y cualquier no —por el
    // motivo que sea, salvo legacy, ya descartado arriba— es una vez que ese
    // sector no dio fruto.
    if (d.sectorQuery) {
      const prev = sectorStats.get(d.sectorQuery) ?? { hits: 0, total: 0 };
      prev.total += 1;
      if (esSi) prev.hits += 1;
      sectorStats.set(d.sectorQuery, prev);
    }
  }

  // La misma política para los dos acumuladores que excluyen algo: hace falta
  // el recuento de noes Y que ningún sí lo haya salvado nunca. Sin el segundo
  // requisito, el primero es un trinquete (ver el comentario de TITLE_STRIKES).
  const excludedTitles = [...titleStats.values()]
    .filter((t) => t.count >= TITLE_STRIKES && t.yes === 0)
    .map((t) => t.original);

  const excludedSizes = [...sizeStats.entries()]
    .filter(([, s]) => s.no >= SIZE_STRIKES && s.yes === 0)
    .map(([size]) => size);

  const sectorsByHitRate = [...sectorStats.entries()]
    .map(([sector, s]) => ({
      sector,
      hits: s.hits,
      total: s.total,
      // `rate` es la tasa cruda: lo que se enseña en pantalla, porque es lo
      // que de verdad ha pasado.
      rate: s.total > 0 ? s.hits / s.total : 0,
      // `smoothedRate` es solo para ORDENAR, no para enseñar. Sin suavizar, un
      // sector con una sola decisión y un acierto (1/1 = 1.0) adelantaría a
      // uno con cuarenta aciertos de cincuenta (0.8), que es justo el sector
      // del que más sabemos. El suavizado de Laplace (+1 en aciertos, +2 en
      // total) corrige eso: 1/1 baja a 2/3 ≈ 0.667 y 40/50 sube a 41/52 ≈
      // 0.788, así que gana la muestra grande y buena, no la suerte de una
      // vez.
      smoothedRate: (s.hits + 1) / (s.total + 2),
    }))
    // Desempate por volumen: entre dos sectores con el mismo smoothedRate, va
    // delante el que tiene más decisiones detrás, que es del que más sabemos.
    .sort((a, b) => b.smoothedRate - a.smoothedRate || b.total - a.total);

  return { excludedTitles, excludedSizes, sectorsByHitRate };
}

// Las estadísticas que pinta el panel "Lo que ha aprendido el filtro". Se
// derivan de lo mismo, pero con los recuentos a la vista para que se pueda
// discrepar con conocimiento.
export function ruleStats(decisions = []) {
  const counts = new Map();
  for (const d of decisions) {
    if (d.decision !== "no" || !d.reasonCode || d.reasonCode === REASON_LEGACY) continue;
    counts.set(d.reasonCode, (counts.get(d.reasonCode) ?? 0) + 1);
  }
  return {
    ...deriveRules(decisions),
    reasonCounts: Object.fromEntries(counts),
    // Mismo criterio que deriveRules para "decidida": yes/no explícitos, no
    // "distinto de pending". Si la columna acabara admitiendo null como
    // pendiente, `!== "pending"` contaría todo lo pendiente como decidido.
    decided: decisions.filter((d) => d.decision === "yes" || d.decision === "no").length,
    accepted: decisions.filter((d) => d.decision === "yes").length,
  };
}
