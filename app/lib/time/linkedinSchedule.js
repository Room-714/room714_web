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
