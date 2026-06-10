// Calcula las fechas de publicación de las 3 variantes de LinkedIn para
// un post. Asume que el post se publica un Lunes o Miércoles a las 10:00
// Madrid. Variantes:
//   1 → mismo día del post
//   2 → día siguiente
//   3 → dos días después
// Resultado:
//   Lunes  → [Lun, Mar, Mié]
//   Miérc. → [Mié, Jue, Vie]
//
// Notas:
// - DST puede desplazar la hora ±1 entre variantes (cambio horario en marzo
//   u octubre). No es crítico porque el cron /publish-linkedin corre cada
//   día y recoge las variantes con scheduledFor <= now.
export function variantScheduleFor(postPublishDate) {
  const base = postPublishDate.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  return [
    new Date(base),
    new Date(base + 1 * dayMs),
    new Date(base + 2 * dayMs),
  ];
}
