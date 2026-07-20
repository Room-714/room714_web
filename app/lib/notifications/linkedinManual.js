import { Resend } from "resend";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleString("es-ES", {
      timeZone: "Europe/Madrid",
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return String(d);
  }
}

// Bloque HTML de UNA variante de LinkedIn (sin envoltura de email): texto
// listo para copiar + hashtags, enlace, imagen incrustada y descarga.
export function renderVariantBlock({ variant, postUrl }) {
  const hashtags = (variant.hashtags || [])
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ");
  const fullText = `${variant.text || ""}${hashtags ? `\n\n${hashtags}` : ""}`;

  return `
  <div style="border:1px solid #eee; border-radius:10px; padding:16px; margin:16px 0;">
    <p style="margin:0 0 8px; font-size:13px; color:#888;">Variante ${variant.variant} · ${variant.angle} · publicar aprox. <strong>${fmtDate(variant.scheduledFor)}</strong></p>
    <pre style="white-space:pre-wrap; word-break:break-word; background:#f6f6f6; padding:14px; border-radius:8px; font-family:inherit; font-size:15px; margin:0 0 10px;">${escapeHtml(fullText)}</pre>
    <p style="margin:0 0 10px;"><a href="${postUrl}">${postUrl}</a> <span style="color:#888;">(para el post o el primer comentario)</span></p>
    <img src="${variant.imageBlobUrl}" alt="Imagen variante ${variant.variant}" style="max-width:100%; height:auto; border-radius:8px;" />
    <p style="margin:8px 0 0;"><a href="${variant.imageBlobUrl}">Descargar imagen</a></p>
  </div>`;
}

// Sección con las N variantes (para incrustar en el email de generación).
// Devuelve "" si no hay variantes.
export function buildLinkedInVariantsSection({ variants, postUrl }) {
  if (!variants?.length) return "";
  const blocks = variants
    .slice()
    .sort((a, b) => a.variant - b.variant)
    .map((v) => renderVariantBlock({ variant: v, postUrl }))
    .join("");
  return `
  <h2 style="border-bottom:1px solid #eee; padding-bottom:10px; margin-top:28px;">LinkedIn — se publican automáticamente (${variants.length} esta semana)</h2>
  <p style="color:#666; font-size:14px;">
    Publicación <strong>automática vía Make</strong> en la <strong>página de empresa</strong>,
    en las fechas indicadas. <strong>No las publiques a mano</strong> para no duplicar.
    Si alguna no te convence, edítala o rechaza el post en el admin antes de su fecha.
  </p>
  ${blocks}`;
}

// Email individual de una variante (usado por el cron diario como red de
// seguridad / recuperación de variantes sueltas).
export function buildLinkedInManualEmail({ variant, translationEs, postUrl }) {
  const subject = `📢 LinkedIn manual: ${translationEs.title} (v${variant.variant} · ${variant.angle})`;
  const html = `
<div style="font-family: sans-serif; color:#222; max-width:640px;">
  <h2 style="border-bottom:1px solid #eee; padding-bottom:10px;">Publicación de LinkedIn</h2>
  <p style="color:#666; font-size:14px;">
    Publicación <strong>manual</strong>. Publícala en la <strong>página de empresa</strong> y
    en tu <strong>perfil personal</strong>.
  </p>
  <p><strong>Post:</strong> ${escapeHtml(translationEs.title)}</p>
  ${renderVariantBlock({ variant, postUrl })}
</div>`;
  return { subject, html };
}

// Envía (o previsualiza) el email de una variante. Con preview=true devuelve
// el contenido sin enviar ni depender de RESEND_API_KEY.
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
