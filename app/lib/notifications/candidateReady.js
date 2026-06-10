import { Resend } from "resend";

const POSITION_LABEL = {
  DEVELOPER: "Desarrollador",
  DESIGNER: "Diseñador",
  PRODUCT_MANAGER: "Product Manager",
};

const EDUCATION_LABEL = {
  GRADO: "Grado Universitario",
  MASTER: "Máster Universitario",
  DOCTORADO: "Doctorado",
  OTHER: "Otra",
};

function markdownToBasicHtml(md) {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
}

export async function sendCandidateSummaryEmail({
  candidateId,
  position,
  country,
  education,
  cvBlobUrl,
  aiSummary,
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.HR_EMAIL || "rrhh@room714.com";

  if (!apiKey) {
    console.warn("RESEND_API_KEY no configurada, saltando email a RRHH");
    return { success: false, skipped: true };
  }

  const resend = new Resend(apiKey);

  const positionLabel = POSITION_LABEL[position] || position;
  const educationLabel = EDUCATION_LABEL[education] || education;
  const summaryHtml = aiSummary
    ? `<p>${markdownToBasicHtml(aiSummary)}</p>`
    : "<p><em>No se pudo generar resumen automático.</em></p>";

  try {
    const { error } = await resend.emails.send({
      from: "Room 714 Careers <rrhh@room714.com>",
      to: [to],
      subject: `Nuevo CV: ${positionLabel} (${country})`,
      html: `
<div style="font-family: sans-serif; color: #333; max-width: 680px; margin: 0 auto;">
  <h2 style="border-bottom: 2px solid #E63946; padding-bottom: 10px; color: #000;">Nuevo CV recibido</h2>

  <table style="border-collapse: collapse; margin: 16px 0; font-size: 14px;">
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Candidato ID:</td><td style="padding: 4px 0;"><strong>#${candidateId}</strong></td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Posición:</td><td style="padding: 4px 0;"><strong>${positionLabel}</strong></td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">País:</td><td style="padding: 4px 0;">${country}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Formación:</td><td style="padding: 4px 0;">${educationLabel}</td></tr>
  </table>

  <h3 style="color: #000; margin-top: 24px;">Resumen ejecutivo (IA)</h3>
  <div style="background: #f7f7f7; padding: 16px 20px; border-radius: 8px; font-size: 14px; line-height: 1.6;">
    ${summaryHtml}
  </div>

  <p style="margin-top: 24px;">
    <a href="${cvBlobUrl}" style="background:#000;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
      Descargar CV original (PDF)
    </a>
  </p>

  <p style="margin-top: 30px; font-size: 12px; color: #999;">
    El CV se borra automáticamente 1 mes después de la recepción según política de privacidad.
  </p>
</div>
      `,
    });

    if (error) {
      console.error("Resend error candidateReady:", error);
      return { success: false, error };
    }
    return { success: true };
  } catch (error) {
    console.error("candidateReady email error:", error);
    return { success: false, error: error.message };
  }
}
