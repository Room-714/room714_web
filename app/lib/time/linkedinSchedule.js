// Calcula las fechas de publicación de las 3 variantes de LinkedIn para
// un post. Asume que el post se publica un Lunes o Miércoles a las 10:00
// Madrid. Variantes (horas base, antes del jitter):
//   1 → mismo día del post a las 10:00 (anuncio principal)
//   2 → día siguiente a las 10:00 (refuerzo)
//   3 → dos días después a las 16:00 (recall por la tarde)
//
// El offset de 6 horas en la variante 3 evita que choque con la variante 1
// del siguiente post (que se publica el miércoles a las 10:00). Resultado:
//   Lunes    → [Lun ~10, Mar ~10, Mié ~16]
//   Miércoles→ [Mié ~10, Jue ~10, Vie ~16]
// El miércoles tiene dos publicaciones espaciadas: ~10:00 (anuncio del post
// nuevo) + ~16:00 (recall del post del lunes).
//
// DST puede desplazar la hora ±1 entre variantes. No es crítico porque el
// cron /publish-linkedin corre múltiples veces al día y recoge variantes
// con scheduledFor <= now.
import { getMadridWeekday } from "./madrid";

// ─── Jitter humano ──────────────────────────────────────────────────────────
// Publicar siempre a en punto delata al robot y concentra las 6 publicaciones
// semanales en el mismo minuto exacto. Cada variante recibe un desplazamiento
// en minutos DETERMINISTA (mismo post → mismo horario, lo que mantiene puras
// las funciones y estables los tests) pero impredecible a simple vista,
// derivado de un hash de la fecha del post y el número de variante.
//
// Ventanas por variante (minutos respecto a la hora base):
//   v1: [+4, +52]  — solo hacia delante: el artículo se hace visible en la web
//                    exactamente a las 10:00 (blog.js filtra date <= now), así
//                    que anunciar antes enlazaría a una página aún no publicada.
//   v2: [-25, +65] — 9:35 a 11:05, dentro de la franja alta de LinkedIn
//                    (media mañana laborable).
//   v3: [-35, +55] — 15:25 a 16:55, la franja de después de comer.
//
// El cron publish-linkedin corre cada 10 minutos en la ventana laboral (ver
// vercel.json), así que el instante real de publicación respeta el jitter con
// una granularidad de ~10 min en vez de redondearse a la hora.
const JITTER_WINDOWS = [
  { min: 4, max: 52 },
  { min: -25, max: 65 },
  { min: -35, max: 55 },
];

// FNV-1a de 32 bits. No necesitamos calidad criptográfica: solo dispersión
// estable entre ejecuciones y entornos (nada de Math.random).
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function jitterMinutesFor(postPublishDate, variantIndex) {
  const window = JITTER_WINDOWS[variantIndex] || JITTER_WINDOWS[0];
  const seed = hash32(`${postPublishDate.toISOString()}#v${variantIndex + 1}`);
  return window.min + (seed % (window.max - window.min + 1));
}

export function variantScheduleFor(postPublishDate) {
  const base = postPublishDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const minMs = 60 * 1000;
  const bases = [base, base + 1 * dayMs, base + 2 * dayMs + 6 * hourMs];
  return bases.map(
    (b, idx) =>
      new Date(b + jitterMinutesFor(postPublishDate, idx) * minMs),
  );
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
