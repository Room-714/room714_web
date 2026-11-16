// Plazo de conservación de los contactos (tabla Lead), el que dice la política
// de privacidad: como máximo dos años desde el último mensaje de esa
// dirección de email. Lo aplica el cron /api/cron/cleanup-leads.

export const ANIOS_CONSERVACION = 2;

/** Fecha antes de la cual un último mensaje ya ha caducado. */
export function limiteConservacion(ahora = new Date()) {
  const limite = new Date(ahora);
  limite.setUTCFullYear(limite.getUTCFullYear() - ANIOS_CONSERVACION);
  return limite;
}
