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

// Caja copiable: texto tal cual, respetando saltos de línea.
function copyBox(text) {
  return `<pre style="white-space:pre-wrap;word-wrap:break-word;background:#f6f6f6;border-radius:6px;padding:12px;margin:8px 0;font-family:inherit;font-size:14px;line-height:1.5;color:#222;">${esc(text)}</pre>`;
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
    case "review_own":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">Artículo: ${esc(task.articleTitle)}</p>
        ${copyBox(task.text)}
        <p style="margin:0 0 10px;font-size:13px;color:#444;">${esc((task.hashtags || []).join(" "))}</p>
        <p style="margin:0;font-size:13px;color:#8a5a00;background:#fff8e6;padding:10px;border-radius:6px;">${esc(task.voiceHint)}</p>
      `);

    case "first_comment":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">El cuerpo del post va sin enlace; el enlace vive en el primer comentario.</p>
        ${copyBox(task.articleUrl)}
        ${button(task.linkUrl, "Ir al post")}
      `);

    case "reshare_company":
    case "comment_personal":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">Artículo: ${esc(task.articleTitle)}</p>
        ${
          task.suggestion
            ? copyBox(task.suggestion)
            : `<p style="margin:10px 0;font-size:13px;color:#999;font-style:italic;">Sin sugerencia generada para esta variante — escríbelo a mano.</p>`
        }
        ${button(task.linkUrl, "Ir al post")}
      `);

    case "blog_review":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        <p style="margin:0 0 4px;font-size:15px;color:#111;"><strong>${esc(task.articleTitle)}</strong></p>
        ${button(task.articleUrl, "Ver artículo")}${button(task.adminUrl, "Editar en el admin")}
      `);

    case "not_published":
      return block(`
        ${eyebrow(`Ayer a las ${task.time}`)}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">${esc(task.articleTitle)}. Revisa el escenario de Make o resetea la variante para que el cron la reintente.</p>
      `);

    default:
      return "";
  }
}

export function renderBriefingHtml({ tasks = [], incidents = [], dateLabel }) {
  const incidentsHtml = incidents.length
    ? `<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#b00020;margin:26px 0 12px;">No salió ayer</h2>${incidents.map(renderTaskHtml).join("")}`
    : "";

  return `
<div style="font-family: sans-serif; color: #333; max-width: 640px;">
  <h2 style="border-bottom:1px solid #eee;padding-bottom:10px;margin:0 0 6px;">Tus tareas de LinkedIn — ${esc(dateLabel)}</h2>
  <p style="margin:0 0 20px;color:#666;font-size:13px;">${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"}. Todo lo que necesitas está en este correo.</p>
  ${tasks.map(renderTaskHtml).join("")}
  ${incidentsHtml}
  <p style="margin-top:28px;font-size:12px;color:#999;">Las publicaciones salen solas vía Make. Esto es solo lo que tienes que hacer tú.</p>
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
      subject: `Tus ${tasks.length} tareas de LinkedIn — ${dateLabel}`,
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
