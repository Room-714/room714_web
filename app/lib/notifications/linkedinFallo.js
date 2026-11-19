// Aviso a José cuando una publicación automática de LinkedIn no sale ni con
// el reintento. Solo informa: no hay nada que hacer a mano, el siguiente
// envío del canal sale a su hora como siempre.
import { Resend } from "resend";

const CANAL = { empresa: "la página de empresa", personal: "tu perfil" };

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderFalloHtml({ canal, error, titulo, texto, intentos, fecha }) {
  return `
<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;color:#111;">
  <h2 style="margin:0 0 8px;">No se ha publicado en ${esc(CANAL[canal] ?? canal)}</h2>
  <p style="margin:0 0 16px;color:#555;">${esc(fecha)} · ${esc(intentos)} ${intentos === 1 ? "intento" : "intentos"}. Hoy no se vuelve a intentar.</p>
  <p style="margin:0 0 6px;"><strong>Error:</strong></p>
  <pre style="white-space:pre-wrap;background:#f6f6f6;padding:10px;border-radius:6px;margin:0 0 16px;">${esc(error)}</pre>
  ${titulo ? `<p style="margin:0 0 16px;"><strong>Artículo:</strong> ${esc(titulo)}</p>` : ""}
  ${texto ? `<p style="margin:0 0 6px;"><strong>Texto que iba a salir:</strong></p><pre style="white-space:pre-wrap;background:#f6f6f6;padding:10px;border-radius:6px;margin:0 0 16px;">${esc(texto)}</pre>` : ""}
  <p style="margin:0;color:#555;font-size:13px;">No tienes que hacer nada: la próxima publicación de este canal sale a su hora. Si el error se repite, revisa el escenario de Make.</p>
</div>`.trim();
}

/** Nunca lanza: un fallo del correo no puede romper el cron. */
export async function sendLinkedInFalloEmail(datos) {
  const apiKey = process.env.RESEND_API_KEY;
  const to =
    process.env.LINKEDIN_ALERT_EMAIL ||
    process.env.BRIEFING_EMAIL ||
    process.env.DRAFT_REVIEW_EMAIL;
  if (!apiKey || !to) {
    console.warn("linkedinFallo: sin RESEND_API_KEY o sin destinatario; no se envía el aviso");
    return { success: false, skipped: true };
  }
  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: "Room 714 <onboarding@resend.dev>",
      to: [to],
      subject: `LinkedIn: no se ha publicado en ${CANAL[datos.canal] ?? datos.canal} (${datos.fecha})`,
      html: renderFalloHtml(datos),
    });
    if (error) {
      console.error("Resend error (linkedinFallo):", error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.error("linkedinFallo email error:", err);
    return { success: false, error: err.message };
  }
}
