import { escaparHtml as e } from "@/app/lib/leads/email";
import { CIERRE } from "@/app/lib/inventarioIa";
import { SITE_URL } from "@/app/lib/seo/urls";
import { path } from "@/app/lib/routes.mjs";

// Email que recibe quien termina el cuestionario de IA: su diagnóstico
// completo (nivel de criticidad, lo que dice la normativa y sus tres primeros
// pasos) y el cierre con el enlace a Hablemos.
// HTML de tablas y estilos en línea, que es lo que respetan los clientes de
// correo. Sin logo en imagen: Gmail no pinta SVG.

export const ASUNTO_INVENTARIO = "Tu diagnóstico de IA";

const ROJO = "#DC2626"; // red-600, el de los botones de la web
const FUENTE = "Gantari, Montserrat, Helvetica, Arial, sans-serif";
const TITULAR = `Montserrat, ${FUENTE}`;

/** Color del nivel: rojo para los dos graves, negro para el resto. */
const colorNivel = (nivel) => (nivel === "critico" || nivel === "alto" ? ROJO : "#1A1A1A");

export function urlFormulario() {
  return `${SITE_URL}${path("hablemos", "es")}`;
}

const parrafo = (html, extra = "") =>
  `<p style="margin:0 0 16px;font-family:${FUENTE};font-size:16px;line-height:1.5;color:#1A1A1A;${extra}">${html}</p>`;

const subtitulo = (texto) =>
  `<p style="margin:28px 0 12px;font-family:${TITULAR};font-size:18px;font-weight:900;color:#1A1A1A;">${e(texto)}</p>`;

export function htmlInventario(d) {
  const normativa = d.normativa.length
    ? subtitulo("Lo que dice la normativa") +
      d.normativa.map((n) => parrafo(`<strong>${e(n.titulo)}:</strong> ${e(n.texto)}`)).join("")
    : "";
  const pasos = d.pasos.length
    ? subtitulo(d.pasos.length === 1 ? "Tu primer paso" : "Tus primeros pasos") +
      `<ol style="margin:0 0 16px;padding-left:22px;font-family:${FUENTE};font-size:16px;line-height:1.5;color:#1A1A1A;">${d.pasos
        .map((p) => `<li style="margin-bottom:8px;">${e(p)}</li>`)
        .join("")}</ol>`
    : "";

  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#F2F2F2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F2;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:24px;">
  <tr><td style="background:#1A1A1A;border-radius:24px 24px 0 0;padding:24px 32px;font-family:${TITULAR};font-size:22px;font-weight:900;color:#FFFFFF;">
    Room 714
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="margin:0 0 8px;font-family:${FUENTE};font-size:14px;text-transform:uppercase;font-weight:700;color:#6B7280;">Tu diagnóstico de IA · <span style="color:${colorNivel(d.nivel)};">${e(d.etiqueta)}</span></p>
    <h1 style="margin:0 0 16px;font-family:${TITULAR};font-size:26px;line-height:1.25;font-weight:900;color:${colorNivel(d.nivel)};">${e(d.titular)}</h1>
    ${parrafo(e(d.texto))}
    ${normativa}
    ${pasos}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 32px;background:#F2F2F2;border-radius:16px;">
      <tr><td style="padding:24px;">
        <p style="margin:0 0 8px;font-family:${TITULAR};font-size:18px;font-weight:900;color:#1A1A1A;">${e(CIERRE.titulo)}</p>
        ${parrafo(e(CIERRE.texto), "margin-bottom:20px;")}
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="background:${ROJO};border-radius:999px;">
            <a href="${urlFormulario()}" style="display:inline-block;padding:12px 24px;font-family:${TITULAR};font-size:15px;font-weight:900;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">${e(CIERRE.cta)}</a>
          </td>
        </tr></table>
      </td></tr>
    </table>

    <p style="margin:0;font-family:${FUENTE};font-size:16px;line-height:1.5;color:#1A1A1A;">
      José Antonio Ces<br>
      <span style="color:#6B7280;">Fundador y CEO · Room 714</span><br>
      <a href="${SITE_URL}" style="color:${ROJO};">room714.com</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export function textoInventario(d) {
  return [
    `Tu diagnóstico de IA · ${d.etiqueta}`,
    "",
    d.titular,
    d.texto,
    ...(d.normativa.length
      ? ["", "Lo que dice la normativa:", ...d.normativa.map((n) => `- ${n.titulo}: ${n.texto}`)]
      : []),
    ...(d.pasos.length
      ? ["", d.pasos.length === 1 ? "Tu primer paso:" : "Tus primeros pasos:", ...d.pasos.map((p, i) => `${i + 1}. ${p}`)]
      : []),
    "",
    CIERRE.titulo,
    CIERRE.texto,
    `${CIERRE.cta}: ${urlFormulario()}`,
    "",
    "José Antonio Ces",
    "Fundador y CEO · Room 714",
    "room714.com",
  ].join("\n");
}
