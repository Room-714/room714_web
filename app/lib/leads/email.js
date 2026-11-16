// Utilidades compartidas por los emails de contacto.

/**
 * Remitente de los emails que salen hacia quien deja sus datos y de los
 * avisos internos. El dominio room714.com está verificado en Resend; la
 * dirección es la del fundador para que las respuestas le lleguen.
 */
export const REMITENTE = "José Antonio Ces · Room 714 <joseantonio.cesfranjo@room714.com>";
export const BUZON_CONTACTO = "joseantonio.cesfranjo@room714.com";

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
