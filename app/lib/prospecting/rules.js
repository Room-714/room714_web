// Las reglas que ajustan la búsqueda salen de CONTAR las decisiones, no de una
// tabla de estado. Esa es la decisión de diseño importante de este módulo, y
// tiene una consecuencia que conviene entender antes de cambiarla: si un día
// cambias de opinión sobre un descarte, la regla que ese descarte provocó
// desaparece sola. No hay estado que corregir ni migración que hacer.
//
// La contrapartida es que la política vive en los umbrales de aquí abajo, y
// tocarlos cambia la búsqueda de mañana. Por eso son constantes exportadas y
// tienen tests propios.

// Tres descartes por cargo bastan para sacarlo. Es agresivo a propósito: la
// consulta lleva catorce cargos y sobra con que funcionen unos pocos; el coste
// de excluir uno bueno por error es bajo y reversible.
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
// tramos, ni la tasa de acierto de sectores), así que se filtra una sola vez
// aquí y se comprueba antes de tocar cualquier acumulador.
const REASON_LEGACY = "legacy";

function normalizeTitle(title) {
  return String(title || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function deriveRules(decisions = []) {
  const titleStrikes = new Map(); // título normalizado → { original, count }
  const sizeStats = new Map(); // tramo → { no, yes }
  const sectorStats = new Map(); // sector → { hits, total }

  for (const d of decisions) {
    const esNo = d.decision === "no";
    const esSi = d.decision === "yes";
    if (!esNo && !esSi) continue;

    // Un 'no' legacy no es un descarte real: nadie lo decidió. No debe contar
    // ni para el cargo, ni para el tramo, ni como fallo de sector.
    const esLegacy = esNo && d.reasonCode === REASON_LEGACY;

    if (esNo && !esLegacy && d.reasonCode === REASON_ROLE && d.title) {
      const key = normalizeTitle(d.title);
      const prev = titleStrikes.get(key);
      titleStrikes.set(key, {
        original: prev?.original ?? d.title.trim(),
        count: (prev?.count ?? 0) + 1,
      });
    }

    if (d.sizeQuery && !esLegacy) {
      const prev = sizeStats.get(d.sizeQuery) ?? { no: 0, yes: 0 };
      if (esSi) prev.yes += 1;
      else if (d.reasonCode === REASON_SIZE) prev.no += 1;
      sizeStats.set(d.sizeQuery, prev);
    }

    // Al sector le cuenta todo: un sí es un acierto, y cualquier no —por el
    // motivo que sea, salvo legacy— es una vez que ese sector no dio fruto.
    if (d.sectorQuery && !esLegacy) {
      const prev = sectorStats.get(d.sectorQuery) ?? { hits: 0, total: 0 };
      prev.total += 1;
      if (esSi) prev.hits += 1;
      sectorStats.set(d.sectorQuery, prev);
    }
  }

  const excludedTitles = [...titleStrikes.values()]
    .filter((t) => t.count >= TITLE_STRIKES)
    .map((t) => t.original);

  const excludedSizes = [...sizeStats.entries()]
    .filter(([, s]) => s.no >= SIZE_STRIKES && s.yes === 0)
    .map(([size]) => size);

  const sectorsByHitRate = [...sectorStats.entries()]
    .map(([sector, s]) => ({
      sector,
      hits: s.hits,
      total: s.total,
      rate: s.total > 0 ? s.hits / s.total : 0,
    }))
    // Desempate por volumen: entre dos sectores con la misma tasa, va delante
    // el que tiene más decisiones detrás, que es del que más sabemos.
    .sort((a, b) => b.rate - a.rate || b.total - a.total);

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
    decided: decisions.filter((d) => d.decision !== "pending").length,
    accepted: decisions.filter((d) => d.decision === "yes").length,
  };
}
