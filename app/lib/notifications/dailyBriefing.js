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
function copyBox(label, text) {
  return `
    <div style="margin:10px 0;">
      <div style="font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#999;margin-bottom:4px;">${esc(label)}</div>
      <pre style="white-space:pre-wrap;word-wrap:break-word;background:#f6f6f6;border-radius:6px;padding:12px;margin:0;font-family:inherit;font-size:14px;line-height:1.5;color:#222;">${esc(text)}</pre>
    </div>`;
}

// Pasos numerados. Cada elemento puede llevar <strong> ya escrito, así que no
// se escapa aquí: las cadenas son literales del código, no datos externos.
function steps(items) {
  return `<ol style="margin:10px 0 0;padding-left:22px;font-size:14px;line-height:1.65;color:#333;">${items
    .map((s) => `<li style="margin-bottom:4px;">${s}</li>`)
    .join("")}</ol>`;
}

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
    case "first_comment":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        ${note("El post sale sin enlace en el cuerpo a propósito: LinkedIn recorta el alcance de las publicaciones con enlaces externos. El enlace va en el primer comentario.")}
        ${steps([
          `Pulsa <strong>Ir al post</strong>: se abre tu publicación de hoy.`,
          `Copia el enlace de abajo.`,
          `Pégalo como <strong>primer comentario</strong> de tu propio post. Cuanto antes, mejor.`,
        ])}
        ${copyBox("Enlace del artículo", task.articleUrl)}
        ${button(task.linkUrl, "Ir al post")}
      `);

    case "comment_personal":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        ${note(`Artículo: ${task.articleTitle}`)}
        ${steps([
          `Pulsa <strong>Ir al post</strong>: se abre la publicación de hoy de Room 714.`,
          `<strong>Comprueba que comentas desde tu perfil personal</strong>, no como la página: al ser administrador, LinkedIn puede ponerte la identidad de Room 714 por defecto.`,
          `Pega el texto de abajo, ajústalo a tu voz si quieres, y publícalo.`,
        ])}
        ${
          task.suggestion
            ? copyBox("Comentario sugerido", task.suggestion)
            : `<p style="margin:10px 0;font-size:13px;color:#999;font-style:italic;">Sin sugerencia generada para esta variante — escríbelo a mano.</p>`
        }
        ${button(task.linkUrl, "Ir al post")}
      `);

    case "reshare_company":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        ${note(`Artículo: ${task.articleTitle}`)}
        ${steps([
          `Pulsa <strong>Ir al post</strong>: se abre tu publicación de hoy.`,
          `Dale a <strong>Compartir</strong> → <strong>Compartir con tus comentarios</strong> (no el compartir simple).`,
          `<strong>Arriba del cuadro de redacción, cambia la identidad de tu nombre a Room 714.</strong> Es el paso que se olvida: sin él lo recompartes como tú y no sirve de nada.`,
          `Pega el texto de abajo como comentario de la recompartición y publica.`,
        ])}
        ${
          task.suggestion
            ? copyBox("Texto sugerido para la recompartición", task.suggestion)
            : `<p style="margin:10px 0;font-size:13px;color:#999;font-style:italic;">Sin sugerencia generada para esta variante — escríbelo a mano.</p>`
        }
        ${button(task.linkUrl, "Ir al post")}
      `);

    case "blog_review":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        <p style="margin:0 0 4px;font-size:15px;color:#111;"><strong>${esc(task.articleTitle)}</strong></p>
        ${note(`Se publicó a las ${task.time}. Si lo editas ahora el cambio solo se ve en la web: las tomas de LinkedIn ya salieron a las 08:30 con el texto de entonces.`)}
        ${button(task.articleUrl, "Ver artículo")}${button(task.adminUrl, "Editar en el admin")}
      `);

    // La prospección del día es una sola decisión: revisar la cola que trae
    // Apollo y decir sí o no a cada candidato. Sustituye a las dos tareas
    // antiguas (comentar un post, buscar referencias), que en meses no
    // produjeron ni un solo engagement registrado.
    case "prospect_queue":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        ${note("Candidatos que ha traído Apollo desde la última revisión. Para cada uno: sí, no, o pendiente.")}
        ${button(task.adminUrl, "Revisar cola")}
      `);

    case "prospect_comment": {
      const who = [task.prospectRole, task.prospectCompany]
        .filter(Boolean)
        .join(" · ");
      return block(`
        ${eyebrow("Cuando tengas 10 minutos · tu perfil")}
        ${heading(task.title)}
        ${who ? note(who) : ""}
        ${
          task.neverEngaged
            ? note("Primer contacto: todavía no le has comentado nunca. Que el comentario se sostenga solo, sin mencionar Room714.")
            : ""
        }
        ${steps([
          `Pulsa <strong>Ver su actividad</strong> y elige un post reciente (ideal, de las últimas 48 h) que toque nuestros temas.`,
          `Copia el texto del post y pégalo en <strong>Redactar comentario</strong>: la IA te propone dos opciones con tu voz.`,
          `Publica el que más te convenza (ajústalo si hace falta) y márcalo como comentado para que la rotación siga.`,
        ])}
        <p style="margin:10px 0 0;font-size:13px;color:#8a5a00;background:#fff8e6;padding:10px;border-radius:6px;">${esc(task.angle)}</p>
        ${button(task.activityUrl, "Ver su actividad")}${button(task.draftUrl, "Redactar comentario")}
      `);
    }

    case "prospect_discover":
      return block(`
        ${eyebrow("Cuando tengas 10 minutos · tu perfil")}
        ${heading(task.title)}
        ${note("La lista de prospectos aún no llena el cupo del día. Esta búsqueda abre posts recientes de LinkedIn sobre el tema; si el autor encaja con nuestro cliente ideal, coméntale y dalo de alta.")}
        ${task.profileHint ? note(task.profileHint) : ""}
        ${steps([
          `Pulsa <strong>Abrir búsqueda</strong> y ojea los posts de las últimas 24-48 h.`,
          `Si el autor encaja (decisor de producto/digital), comenta con un dato o experiencia propia.`,
          `Dalo de alta en <strong>Prospectos</strong> para que entre en la rotación diaria.`,
        ])}
        <p style="margin:10px 0 0;font-size:13px;color:#8a5a00;background:#fff8e6;padding:10px;border-radius:6px;">${esc(task.angle)}</p>
        ${button(task.searchUrl, "Abrir búsqueda")}${button(task.adminUrl, "Prospectos")}
      `);

    case "not_published":
      return block(`
        ${eyebrow(`Ayer a las ${task.time}`)}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">${esc(task.articleTitle)}. Revisa el escenario de Make o resetea la variante para que el cron la reintente.</p>
      `);

    // El cron de las 08:30 no llegó a generar las tomas (fallo o timeout) y,
    // al no reintentar Vercel, nadie más lo detecta antes del viernes. El
    // eyebrow no usa task.time: esa es la hora de publicación del artículo
    // (07:30), y el fallo ocurre en el cron de las 08:30 — mezclarlas despista.
    // No hay botón "Generar en el admin" porque no existe: no hay pantalla de
    // admin que dispare la generación de tomas. Lo que sí existe es la propia
    // ruta del cron, protegida por CRON_SECRET, con un ?force=1 (arreglo 4)
    // pensado justo para esto: recuperar a mano una generación fallida sin
    // esperar a que vuelva a tocarle su hora.
    case "no_takes":
      return block(`
        ${eyebrow("Hoy · cron de las 08:30")}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">${esc(task.articleTitle)}. Revisa los logs del cron de las 08:30 en Vercel, o vuelve a lanzarlo a mano: GET /api/cron/generate-linkedin?force=1 con el header Authorization: Bearer CRON_SECRET.</p>
      `);

    // El cron de las 06:00 no llegó a generar el artículo (fallo o timeout) y
    // Vercel no reintenta. No hay post que enlazar —por eso no lleva botón—,
    // así que la única acción posible es mirar los logs o generarlo a mano.
    case "no_article":
      return block(`
        ${eyebrow("Hoy · cron de las 06:00")}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">Revisa los logs del cron de las 06:00 en Vercel, o genera el artículo a mano desde el admin (botón "Generar borrador").</p>
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
