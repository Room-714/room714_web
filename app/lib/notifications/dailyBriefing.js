import { Resend } from "resend";

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function block(inner) {
  return `<div style="border:1px solid #eaeaea;border-radius:10px;padding:16px;margin:0 0 14px;">${inner}</div>`;
}

function eyebrow(text) {
  return `<div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#888;">${esc(text)}</div>`;
}

function heading(text) {
  return `<h3 style="margin:6px 0 8px;font-size:16px;color:#111;">${esc(text)}</h3>`;
}

function button(href, label) {
  return `<a href="${esc(href)}" style="background:#000;color:#fff;padding:9px 16px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:bold;display:inline-block;margin:4px 8px 0 0;">${esc(label)}</a>`;
}

// Caja de texto literal. La etiqueta es obligatoria: sin ella, dos cajas con el
// mismo aspecto (una URL para pegar y un texto sugerido) se confunden.
function note(text) {
  return `<p style="margin:0;color:#666;font-size:13px;">${esc(text)}</p>`;
}

function timing(task) {
  const canal =
    task.channel === "personal"
      ? " · tu perfil"
      : task.channel === "empresa"
        ? " · página Room714"
        : "";
  const momento =
    task.when === "before"
      ? `Antes de las ${task.time}`
      : `A partir de las ${task.time}`;
  return `${momento}${canal}`;
}

export function renderTaskHtml(task) {
  switch (task.kind) {
    case "blog_review":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        <p style="margin:0 0 4px;font-size:15px;color:#111;"><strong>${esc(task.articleTitle)}</strong></p>
        ${note(`Se publicó a las ${task.time}.`)}
        ${button(task.articleUrl, "Ver artículo")}${button(task.adminUrl, "Editar en el admin")}
      `);

    // Solo informan: desde noviembre de 2026 todo es automático y el correo
    // no pide nada a mano. Dicen qué pasa solo, sin que nadie intervenga.
    case "no_takes":
      return block(`
        ${eyebrow("Hoy · cron de las 08:30")}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">${esc(task.articleTitle)}. Si el viernes es el elegido para la página de empresa, saldrá con un resumen del artículo en vez de su toma.</p>
      `);

    case "no_article":
      return block(`
        ${eyebrow("Hoy · cron de las 06:00")}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">Esta semana habrá un artículo menos. El siguiente se genera a su hora, sin hacer nada.</p>
      `);

    default:
      return "";
  }
}

export function renderBriefingHtml({ tasks = [], incidents = [], dateLabel }) {
  const incidentsHtml = incidents.length
    ? `<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#b00020;margin:26px 0 12px;">Incidencias</h2>${incidents.map(renderTaskHtml).join("")}`
    : "";

  return `
<div style="font-family: sans-serif; color: #333; max-width: 640px;">
  <h2 style="border-bottom:1px solid #eee;padding-bottom:10px;margin:0 0 6px;">Resumen del blog — ${esc(dateLabel)}</h2>
  <p style="margin:0 0 20px;color:#666;font-size:13px;">Solo para que lo sepas: no tienes que hacer nada.</p>
  ${tasks.map(renderTaskHtml).join("")}
  ${incidentsHtml}
  <p style="margin-top:28px;font-size:12px;color:#999;">El blog y LinkedIn (página de empresa y tu perfil) se publican solos.</p>
</div>
  `.trim();
}

export async function sendDailyBriefingEmail({ tasks, incidents, dateLabel }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to =
    process.env.BRIEFING_EMAIL ||
    process.env.DRAFT_REVIEW_EMAIL ||
    "joseantonio.cesfranjo@room714.com";

  if (!apiKey) {
    console.warn("RESEND_API_KEY no configurada, saltando briefing");
    return { success: false, skipped: true };
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: "Room 714 <onboarding@resend.dev>",
      to: [to],
      subject: `Resumen del blog — ${dateLabel}`,
      html: renderBriefingHtml({ tasks, incidents, dateLabel }),
    });

    if (error) {
      console.error("Resend error (briefing):", error);
      return { success: false, error };
    }
    return { success: true };
  } catch (error) {
    console.error("dailyBriefing email error:", error);
    return { success: false, error: error.message };
  }
}
