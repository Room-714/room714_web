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
// Por qué se puede sumar milisegundos sin hacer aritmética de zona horaria: con
// los planes de lunes y miércoles, las tomas van de lunes a viernes y los
// cambios de horario ocurren en domingo de madrugada, así que ninguna suma
// cruza uno. Comprobado contra las semanas del 29 de marzo y del 25 de octubre.
//
// Ojo: eso NO vale para FALLBACK_PLAN. Un artículo publicado un jueves o un
// viernes hereda los offsets del lunes, y entonces +1d puede caer en sábado
// (donde el cron de publicación no corre) y +4d puede cruzar un domingo de
// cambio de hora y desviar la publicación ±1 hora. Es un camino de
// recuperación manual, no el flujo normal; si deja de serlo, hay que calcular
// los días en zona horaria en vez de en milisegundos.
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
// calendario), se aplica el plan del lunes en vez de fallar: publicar con el
// calendario equivocado es preferible a no publicar. Hereda los offsets del
// lunes además del reparto de canales — ver el aviso de la cabecera.
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
