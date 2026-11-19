// Tomas de LinkedIn de un artículo del blog.
//
// Desde noviembre de 2026 (publicación automática, sin aprobaciones) el blog
// publica lunes y jueves a las 07:30 de Madrid, y cada artículo lleva UNA toma:
// el texto para la página de empresa. No sale a su hora: el viernes a las 08:30
// el cron publish-linkedin elige el mejor artículo de la semana y publica su
// toma (app/lib/linkedin/autopost.js). scheduledFor queda como referencia (ese
// viernes a las 08:30).
//
// El perfil personal de José ya no usa tomas: su texto se genera aparte, en el
// momento de publicar (app/lib/linkedin/perfilPersonal.js). Por eso tampoco
// hay acciones cruzadas (recompartir, comentar): nada pide trabajo manual.
//
// Sumar milisegundos es seguro: de lunes o jueves a viernes no se cruza
// ningún domingo de cambio de hora.
import { getMadridWeekday } from "./madrid";

const MIN_MS = 60 * 1000;

// offsetMin: minutos desde la publicación del artículo (07:30) hasta el viernes
// a las 08:30. 5820 = 4 días y 1 hora; 1500 = 1 día y 1 hora.
const TAKE_PLAN = {
  Mon: [{ offsetMin: 5820, jitter: { min: 0, max: 0 }, canal: "empresa", cross: null }],
  Thu: [{ offsetMin: 1500, jitter: { min: 0, max: 0 }, canal: "empresa", cross: null }],
};

// Si un artículo cae en un día no previsto (recuperación manual, cambio de
// calendario), se aplica el plan del lunes en vez de fallar: publicar con el
// calendario equivocado es preferible a no publicar.
const FALLBACK_PLAN = TAKE_PLAN.Mon;

// Días en que un artículo tiene plan propio de tomas. Un artículo fechado
// fuera de estos días cae en FALLBACK_PLAN y además no lo recoge el cron de
// las 08:30, así que se queda sin tomas: por eso hay que poder preguntarlo
// desde fuera y no solo deducirlo.
export const PLANNED_WEEKDAYS = Object.keys(TAKE_PLAN);

function planFor(postPublishDate) {
  const weekday = getMadridWeekday(postPublishDate);
  return TAKE_PLAN[weekday] || FALLBACK_PLAN;
}

// FNV-1a de 32 bits. No necesitamos calidad criptográfica: solo dispersión
// estable entre ejecuciones y entornos (nada de Math.random, que rompería los
// tests y daría horarios distintos en cada despliegue).
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function jitterMinutesFor(postPublishDate, takeIndex) {
  const plan = planFor(postPublishDate);
  const window = (plan[takeIndex] || plan[0]).jitter;
  const seed = hash32(`${postPublishDate.toISOString()}#t${takeIndex + 1}`);
  return window.min + (seed % (window.max - window.min + 1));
}

// Cuántas tomas de LinkedIn lleva el artículo de esa fecha. Lo consume el
// generador para pedirle al modelo exactamente ese número.
export function takeCountFor(postPublishDate) {
  return planFor(postPublishDate).length;
}

export function variantScheduleFor(postPublishDate) {
  const base = postPublishDate.getTime();
  return planFor(postPublishDate).map(
    (take, idx) =>
      new Date(
        base +
          take.offsetMin * MIN_MS +
          jitterMinutesFor(postPublishDate, idx) * MIN_MS,
      ),
  );
}

export function slotFor({ postPublishDate, variant }) {
  const plan = planFor(postPublishDate);
  const take = plan[variant - 1];
  if (take) return take;

  // Variante fuera del plan. Pasa con las filas del calendario anterior, que
  // tenía tres tomas también los miércoles. Se avisa y se sigue: publicar por
  // el canal de la primera toma es menos malo que no publicar, pero tiene que
  // quedar rastro.
  console.warn(
    `slotFor: variante ${variant} fuera del plan de ${postPublishDate.toISOString()}; se usa la primera toma`,
  );
  return plan[0];
}

export function channelForVariant({ postPublishDate, variant }) {
  return slotFor({ postPublishDate, variant }).canal;
}

// Las acciones cruzadas en el orden de las tomas. Lo consume el generador para
// decirle al modelo qué sugerencia escribir en cada una.
export function crossActionsFor(postPublishDate) {
  return planFor(postPublishDate).map((take) => take.cross);
}
