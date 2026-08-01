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
// Único sitio donde se decide qué cuenta publica cada variante. El Router de
// Make solo filtra por el campo `canal` del payload, así que cambiar el
// reparto es cambiar esta tabla (Make no se toca).
//
// Con dos posts por semana (Lunes y Miércoles), los 6 slots quedan 3 y 3:
//   Post del LUNES      → v1 Lun 10:00 personal · v2 Mar 10:00 empresa · v3 Mié 16:00 empresa
//   Post del MIÉRCOLES  → v1 Mié 10:00 personal · v2 Jue 10:00 empresa · v3 Vie 16:00 personal
//
// Ojo a la asimetría de v3: es intencionada. Es lo que equilibra la semana
// (personal = Lun, Mié mañana, Vie · empresa = Mar, Mié tarde, Jue) y evita
// que el miércoles las dos publicaciones salgan por la misma cuenta.
const CHANNEL_BY_PUBLISH_WEEKDAY = {
  Mon: ["personal", "empresa", "empresa"],
  Wed: ["personal", "empresa", "personal"],
};

// Si un post cae en un día no previsto (recuperación manual, cambio de
// calendario), aplicamos el reparto del lunes en vez de fallar: perder el
// equilibrio de la semana es preferible a no publicar.
const FALLBACK_CHANNELS = CHANNEL_BY_PUBLISH_WEEKDAY.Mon;

export function channelForVariant({ postPublishDate, variant }) {
  const weekday = getMadridWeekday(postPublishDate);
  const channels = CHANNEL_BY_PUBLISH_WEEKDAY[weekday] || FALLBACK_CHANNELS;
  return channels[variant - 1] || FALLBACK_CHANNELS[0];
}
