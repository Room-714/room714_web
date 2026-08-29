// Calendario de las tomas de LinkedIn de un artículo.
//
// Supuesto de entrada: el artículo se publica a las 07:30 de Madrid, un lunes
// o un miércoles. Todo lo de aquí se calcula como desplazamiento respecto a esa
// fecha, así que si cambia la hora de publicación hay que revisar TAKE_PLAN.
//
// La semana queda así:
//   L 08:35  art.1 toma 1  personal  → Room714 recomparte
//   M 07:30  art.1 toma 2  empresa   → José comenta desde su perfil
//   X 08:35  art.2 toma 1  personal  → Room714 recomparte
//   J 07:30  art.2 toma 2  empresa   → José comenta desde su perfil
//   V 07:30  art.1 toma 3  personal  → Room714 recomparte
//
// Por qué la toma 1 sale a las 08:35 y no en la franja de las 07:30: se genera
// a las 08:30, a partir del artículo que se acaba de revisar a mano. No puede
// existir antes. Es la única excepción del calendario y es deliberada.
//
// Por qué se puede sumar milisegundos sin preocuparse del cambio de hora: las
// tomas de un artículo van de lunes a viernes y los cambios de horario ocurren
// en domingo de madrugada, así que ninguna suma cruza uno.
import { getMadridWeekday } from "./madrid";

const MIN_MS = 60 * 1000;

// El plan completo, en un solo sitio: cuándo sale cada toma respecto al
// artículo, con cuánto margen aleatorio, por qué cuenta y qué le deja que hacer
// a la otra. Cambiar la estrategia de publicación es cambiar esta tabla.
//
// `offsetMin` es la distancia en minutos desde la publicación del artículo
// (07:30): 65 son las 08:35 del mismo día, 1440 las 07:30 del día siguiente y
// 5760 las 07:30 del viernes.
//
// `jitter` evita que las cinco publicaciones semanales caigan siempre en el
// mismo minuto exacto, que es lo que delata a un robot. La ventana de la toma 1
// es corta a propósito: el briefing sale a las 08:50 y tiene que encontrarla ya
// publicada.
const TAKE_PLAN = {
  Mon: [
    { offsetMin: 65, jitter: { min: 0, max: 8 }, canal: "personal", cross: "reshare_company" },
    { offsetMin: 1440, jitter: { min: 0, max: 28 }, canal: "empresa", cross: "comment_personal" },
    { offsetMin: 5760, jitter: { min: 0, max: 28 }, canal: "personal", cross: "reshare_company" },
  ],
  Wed: [
    { offsetMin: 65, jitter: { min: 0, max: 8 }, canal: "personal", cross: "reshare_company" },
    { offsetMin: 1440, jitter: { min: 0, max: 28 }, canal: "empresa", cross: "comment_personal" },
  ],
};

// Si un artículo cae en un día no previsto (recuperación manual, cambio de
// calendario), se aplica el plan del lunes en vez de fallar: perder el
// equilibrio de la semana es preferible a quedarse sin publicar.
const FALLBACK_PLAN = TAKE_PLAN.Mon;

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
  return plan[variant - 1] || plan[0];
}

export function channelForVariant({ postPublishDate, variant }) {
  return slotFor({ postPublishDate, variant }).canal;
}

// Las acciones cruzadas en el orden de las tomas. Lo consume el generador para
// decirle al modelo qué sugerencia escribir en cada una.
export function crossActionsFor(postPublishDate) {
  return planFor(postPublishDate).map((take) => take.cross);
}
