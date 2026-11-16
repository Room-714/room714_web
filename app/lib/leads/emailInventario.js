import { escaparHtml as e } from "@/app/lib/leads/email";
import { NOTA_RESULTADO, PUNTOS } from "@/app/lib/inventarioIa";
import { ANCLA_FORMULARIO, DESCARGAS } from "@/app/data/incorporarIa";
import { SITE_URL } from "@/app/lib/seo/urls";
import { path } from "@/app/lib/routes.mjs";

// Email que recibe quien termina el inventario de IA: el resultado que vio
// en pantalla, las dos plantillas y el enlace a la sesión de diagnóstico.
// HTML de tablas y estilos en línea, que es lo que respetan los clientes de
// correo. Sin logo en imagen: Gmail no pinta SVG.

export const ASUNTO_INVENTARIO = "Tu inventario de IA y las dos plantillas";

const ROJO = "#DC2626"; // red-600, el de los botones de la web
const FUENTE = "Gantari, Montserrat, Helvetica, Arial, sans-serif";
const TITULAR = `Montserrat, ${FUENTE}`;

export function urlFormulario() {
  return `${SITE_URL}${path("incorporarIa", "es")}#${ANCLA_FORMULARIO}`;
}

const puntosDe = (resultado) =>
  resultado.buenaBase ? [PUNTOS.buenaBase] : resultado.puntos;

const enlaceDoc = (doc) => `
  <tr><td style="padding:6px 0;font-family:${FUENTE};font-size:16px;color:#1A1A1A;">
    <strong>${e(doc.titulo)}</strong><br>
    <a href="${SITE_URL}${doc.pdf}" style="color:${ROJO};font-weight:700;">PDF para leer</a>
    &nbsp;·&nbsp;
    <a href="${SITE_URL}${doc.docx}" style="color:${ROJO};font-weight:700;">DOCX para editar</a>
  </td></tr>`;

export function htmlInventario(resultado) {
  const puntos = `<ul style="margin:0 0 16px;padding-left:20px;font-family:${FUENTE};font-size:16px;line-height:1.5;color:#1A1A1A;">${puntosDe(
    resultado,
  )
    .map((p) => `<li style="margin-bottom:8px;">${e(p)}</li>`)
    .join("")}</ul>`;

  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#F2F2F2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F2;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:24px;">
  <tr><td style="background:#1A1A1A;border-radius:24px 24px 0 0;padding:24px 32px;font-family:${TITULAR};font-size:22px;font-weight:900;color:#FFFFFF;">
    Room 714
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="margin:0 0 8px;font-family:${FUENTE};font-size:14px;text-transform:uppercase;font-weight:700;color:#6B7280;">Tu inventario de IA</p>
    <h1 style="margin:0 0 20px;font-family:${TITULAR};font-size:24px;line-height:1.3;font-weight:900;color:#1A1A1A;">${e(resultado.encabezado)}</h1>
    ${puntos}
    <p style="margin:0 0 28px;font-family:${FUENTE};font-size:14px;color:#6B7280;">${e(NOTA_RESULTADO)}</p>

    <p style="margin:0 0 8px;font-family:${FUENTE};font-size:16px;font-weight:700;color:#1A1A1A;">Las dos plantillas</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      ${enlaceDoc(DESCARGAS.politica)}
      ${enlaceDoc(DESCARGAS.checklist)}
    </table>

    <p style="margin:0 0 20px;font-family:${FUENTE};font-size:16px;line-height:1.5;color:#1A1A1A;">Si quieres, lo repasamos contigo en la sesión de diagnóstico.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px;"><tr>
      <td style="background:${ROJO};border-radius:999px;">
        <a href="${urlFormulario()}" style="display:inline-block;padding:12px 24px;font-family:${TITULAR};font-size:15px;font-weight:900;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">Reservar sesión de diagnóstico</a>
      </td>
    </tr></table>

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

export function textoInventario(resultado) {
  const doc = (d) =>
    `${d.titulo}: ${SITE_URL}${d.pdf} (PDF) · ${SITE_URL}${d.docx} (DOCX)`;
  return [
    resultado.encabezado,
    "",
    ...puntosDe(resultado).map((p) => `- ${p}`),
    "",
    NOTA_RESULTADO,
    "",
    "Las dos plantillas:",
    doc(DESCARGAS.politica),
    doc(DESCARGAS.checklist),
    "",
    "Si quieres, lo repasamos contigo en la sesión de diagnóstico:",
    urlFormulario(),
    "",
    "José Antonio Ces",
    "Fundador y CEO · Room 714",
    "room714.com",
  ].join("\n");
}
