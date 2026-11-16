// Utilidades compartidas por los emails de contacto.

/**
 * Remitente de los avisos internos (formularios y cuestionario), que llegan
 * al buzón del fundador. El dominio room714.com está verificado en Resend.
 */
export const REMITENTE = "José Antonio Ces · Room 714 <joseantonio.cesfranjo@room714.com>";
export const BUZON_CONTACTO = "joseantonio.cesfranjo@room714.com";

/**
 * Remitente y dirección de respuesta de los emails que recibe quien deja sus
 * datos (hoy, el diagnóstico del cuestionario): la dirección de marca, no la
 * personal. Es la misma que da la política de privacidad como contacto.
 */
export const REMITENTE_CLIENTES = "Room 714 <hello@room714.com>";
export const RESPONDER_A = "hello@room714.com";

/** Escapa un texto para meterlo en el HTML de un email. */
export function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Validación de email suficiente para un formulario (el navegador ya filtra). */
export function emailValido(email) {
  return (
    typeof email === "string" &&
    email.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  );
}
