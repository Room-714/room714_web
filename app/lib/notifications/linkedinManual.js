import { Resend } from "resend";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Construye el email con el contenido de una variante de LinkedIn para
// publicación MANUAL. Devuelve { subject, html }. Es una función pura para
// poder previsualizarla sin enviar nada.
export function buildLinkedInManualEmail({ variant, translationEs, postUrl }) {
  const hashtags = (variant.hashtags || [])
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");

  const fullText = `${variant.text || ""}${hashtags ? `\n\n${hashtags}` : ""}`;

  let suggested = "";
  try {
    suggested = new Date(variant.scheduledFor).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    suggested = String(variant.scheduledFor);
  }

  const subject = `📢 LinkedIn manual: ${translationEs.title} (v${variant.variant} · ${variant.angle})`;

  const html = `
<div style="font-family: sans-serif; color:#222; max-width:640px;">
  <h2 style="border-bottom:1px solid #eee; padding-bottom:10px;">Publicación de LinkedIn para hoy</h2>
  <p style="color:#666; font-size:14px;">
    Publicación <strong>manual</strong> (la automática vía Make está pausada mientras
    LinkedIn aprueba la app). Publícala en la <strong>página de empresa</strong> y en
    tu <strong>perfil personal</strong>.<br>
    Hora sugerida: <strong>${suggested}</strong>.
  </p>
  <p><strong>Post:</strong> ${escapeHtml(translationEs.title)} · variante ${variant.variant} (${variant.angle})</p>

  <h3 style="margin-top:24px;">Texto (cópialo tal cual)</h3>
  <pre style="white-space:pre-wrap; word-break:break-word; background:#f6f6f6; padding:16px; border-radius:8px; font-family:inherit; font-size:15px; margin:0;">${escapeHtml(fullText)}</pre>

  <p style="margin-top:12px;"><strong>Enlace</strong> (para el post o el primer comentario):<br>
    <a href="${postUrl}">${postUrl}</a></p>

  <h3 style="margin-top:24px;">Imagen</h3>
  <p><img src="${variant.imageBlobUrl}" alt="Imagen del post" style="max-width:100%; height:auto; border-radius:8px;" /></p>
  <p><a href="${variant.imageBlobUrl}">Descargar imagen</a></p>
</div>`;

  return { subject, html };
}

// Envía (o previsualiza) el email de publicación manual. Con preview=true
// devuelve el contenido sin enviar ni depender de RESEND_API_KEY.
export async function sendLinkedInManualEmail({
  variant,
  translationEs,
  postUrl,
  preview = false,
}) {
  const to = process.env.DRAFT_REVIEW_EMAIL || "joseantonio.cesfranjo@room714.com";
  const { subject, html } = buildLinkedInManualEmail({
    variant,
    translationEs,
    postUrl,
  });

  if (preview) {
    return { success: true, preview: true, to, subject, html };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY no configurada, saltando email");
    return { success: false, skipped: true, to, subject };
  }

  const resend = new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from: "Room 714 <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    });
    if (error) {
      console.error("Resend error (linkedinManual):", error);
      return { success: false, error: JSON.stringify(error), to };
    }
    return { success: true, to };
  } catch (error) {
    console.error("linkedinManual email error:", error);
    return { success: false, error: error.message, to };
  }
}
