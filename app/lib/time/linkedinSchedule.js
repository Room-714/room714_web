// Calcula las fechas de publicación de las 3 variantes de LinkedIn para
// un post. Asume que el post se publica un Lunes o Miércoles a las 10:00
// Madrid. Variantes:
//   1 → mismo día del post a las 10:00 (anuncio principal)
//   2 → día siguiente a las 10:00 (refuerzo)
//   3 → dos días después a las 16:00 (recall por la tarde)
//
// El offset de 6 horas en la variante 3 evita que choque con la variante 1
// del siguiente post (que se publica el miércoles a las 10:00). Resultado:
//   Lunes    → [Lun 10:00, Mar 10:00, Mié 16:00]
//   Miércoles→ [Mié 10:00, Jue 10:00, Vie 16:00]
// El miércoles tiene dos publicaciones espaciadas: 10:00 (anuncio del post
// nuevo) + 16:00 (recall del post del lunes).
//
// DST puede desplazar la hora ±1 entre variantes. No es crítico porque el
// cron /publish-linkedin corre múltiples veces al día y recoge variantes
// con scheduledFor <= now.
import { getMadridWeekday } from "./madrid";

export function variantScheduleFor(postPublishDate) {
  const base = postPublishDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  return [
    new Date(base),
    new Date(base + 1 * dayMs),
    new Date(base + 2 * dayMs + 6 * hourMs),
  ];
}

// ─── Reparto perfil personal / página de empresa ───────────────────────────
// Único sitio donde se decide qué cuenta publica cada variante y qué le toca
// hacer al otro canal. El Router de Make solo filtra por el campo `canal` del
// payload y el briefing diario lee `cross`, así que cambiar el reparto es
// cambiar esta tabla.
//
// Con dos posts por semana (Lunes y Miércoles), los 6 slots quedan 3 y 3:
//   L 10:00  art.1 v1  personal  → Room714 lo recomparte
//   M 10:00  art.1 v2  empresa   → José comenta desde su perfil
//   X 10:00  art.2 v1  personal  → —
//   X 16:00  art.1 v3  empresa   → —
//   J 10:00  art.2 v2  empresa   → José comenta desde su perfil
//   V 16:00  art.2 v3  personal  → Room714 lo recomparte
//
// Ojo a la asimetría de v3: es intencionada. Es lo que equilibra la semana y
// evita que el miércoles las dos publicaciones salgan por la misma cuenta.
const SLOTS_BY_PUBLISH_WEEKDAY = {
  Mon: [
    { canal: "personal", cross: "reshare_company" },
    { canal: "empresa", cross: "comment_personal" },
    { canal: "empresa", cross: null },
  ],
  Wed: [
    { canal: "personal", cross: null },
    { canal: "empresa", cross: "comment_personal" },
    { canal: "personal", cross: "reshare_company" },
  ],
};

// Si un post cae en un día no previsto (recuperación manual, cambio de
// calendario), aplicamos el reparto del lunes en vez de fallar: perder el
// equilibrio de la semana es preferible a no publicar.
const FALLBACK_SLOTS = SLOTS_BY_PUBLISH_WEEKDAY.Mon;

function slotsFor(postPublishDate) {
  const weekday = getMadridWeekday(postPublishDate);
  return SLOTS_BY_PUBLISH_WEEKDAY[weekday] || FALLBACK_SLOTS;
}

export function slotFor({ postPublishDate, variant }) {
  return slotsFor(postPublishDate)[variant - 1] || FALLBACK_SLOTS[0];
}

export function channelForVariant({ postPublishDate, variant }) {
  return slotFor({ postPublishDate, variant }).canal;
}

// Las tres acciones cruzadas en el orden de las variantes. Lo consume el
// orquestador para decirle al generador qué sugerencia escribir en cada una.
export function crossActionsFor(postPublishDate) {
  return slotsFor(postPublishDate).map((slot) => slot.cross);
}
