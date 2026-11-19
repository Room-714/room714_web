// Interruptores de LinkedIn, todos por variable de entorno.
//
// - LINKEDIN_APPROVAL_FLOW (por defecto false): el flujo de noviembre de 2026
//   con casilla, aprobación en el panel, límite semanal y borrador para el
//   perfil. Desactivado no se borra: con "true" vuelve tal cual, y entonces la
//   página de empresa sale solo por aprobación (la automática se apaga para
//   que no publiquen las dos).
// - LINKEDIN_COMPANY_AUTOPOST y LINKEDIN_PERSONAL_AUTOPOST (por defecto true):
//   interruptores de emergencia de las publicaciones automáticas. Con "false"
//   el canal no consulta la base de datos ni envía nada.
// - MAKE_WEBHOOK_URL: escenario de Make de la página de empresa (el de siempre).
// - MAKE_WEBHOOK_LINKEDIN_PERSONAL: escenario de Make del perfil de José. Sin
//   él, el canal personal se salta (no falla ni avisa): es el estado normal
//   hasta que se cree el escenario.

const leer = (valor, porDefecto) => {
  if (valor == null || String(valor).trim() === "") return porDefecto;
  return String(valor).trim().toLowerCase() === "true";
};

export function configLinkedIn(env = process.env) {
  const flujoAprobacion = leer(env.LINKEDIN_APPROVAL_FLOW, false);
  return {
    flujoAprobacion,
    empresa: {
      activo: leer(env.LINKEDIN_COMPANY_AUTOPOST, true) && !flujoAprobacion,
      interruptor: leer(env.LINKEDIN_COMPANY_AUTOPOST, true),
      webhook: env.MAKE_WEBHOOK_URL || null,
    },
    personal: {
      activo: leer(env.LINKEDIN_PERSONAL_AUTOPOST, true),
      interruptor: leer(env.LINKEDIN_PERSONAL_AUTOPOST, true),
      webhook: env.MAKE_WEBHOOK_LINKEDIN_PERSONAL || null,
    },
  };
}

export const flujoAprobacionActivo = (env = process.env) =>
  configLinkedIn(env).flujoAprobacion;
