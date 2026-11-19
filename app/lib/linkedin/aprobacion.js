// Publicación de posts del blog en la página de empresa de LinkedIn.
//
// Regla de fondo: nada sale a LinkedIn sin una aprobación explícita en el
// panel. Un post nace en SOLO_WEB; marcar la casilla lo pasa a PENDIENTE
// ("Pendiente de aprobar para LinkedIn"); solo el botón de aprobar lo pasa a
// APROBADO, y solo entonces el cron /api/cron/publish-linkedin lo envía a Make,
// una única publicación por post y siempre por el canal "empresa". Tras el
// envío queda en PUBLICADO y ya no se vuelve a tocar.
//
// Todo lo de este fichero es puro (sin base de datos ni red) para poder
// probarlo: las server actions y el cron le pasan los datos ya consultados.
import { withLinkedInUtm } from "@/app/lib/links";
import {
  getMadridHour,
  getMadridWeekday,
  madridDayRange,
} from "@/app/lib/time/madrid";

export const SITE = "https://www.room714.com";

export const ESTADOS = Object.freeze({
  SOLO_WEB: "SOLO_WEB",
  PENDIENTE: "PENDIENTE",
  APROBADO: "APROBADO",
  PUBLICADO: "PUBLICADO",
});

export const ETIQUETAS = Object.freeze({
  SOLO_WEB: "Solo web",
  PENDIENTE: "Pendiente de aprobar para LinkedIn",
  APROBADO: "Aprobado para LinkedIn",
  PUBLICADO: "Publicado en LinkedIn",
});

// Publicaciones por semana (lunes a domingo, hora de Madrid) en la página de
// empresa. Pasarlo exige confirmarlo en el panel.
export const LIMITE_SEMANAL = 1;

// Ventana del cron publish-linkedin en vercel.json: cada 5 minutos de 07:00 a
// 09:55 de Madrid, de lunes a viernes. Un post aprobado sale en la primera
// pasada de la ventana en la que ya esté publicado en la web.
const VENTANA_HORAS = [7, 8, 9];
const FIN_DE_SEMANA = ["Sat", "Sun"];
const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;
const DIAS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ─── Transiciones de estado ──────────────────────────────────────────────── */

// Devuelve { estado } con el estado nuevo, o { error } si la acción no vale
// desde el estado actual. Acciones: "marcar", "desmarcar", "aprobar",
// "retirar".
export function transicion(estadoActual, accion) {
  if (estadoActual === ESTADOS.PUBLICADO) {
    return {
      error:
        "Este post ya está publicado en LinkedIn. Desde el panel no se modifica ni se borra.",
    };
  }

  switch (accion) {
    case "marcar":
      return {
        estado:
          estadoActual === ESTADOS.SOLO_WEB ? ESTADOS.PENDIENTE : estadoActual,
      };
    case "desmarcar":
      return { estado: ESTADOS.SOLO_WEB };
    case "aprobar":
      if (estadoActual === ESTADOS.PENDIENTE || estadoActual === ESTADOS.APROBADO) {
        return { estado: ESTADOS.APROBADO };
      }
      return {
        error:
          "Marca antes la casilla «Publicar en LinkedIn»: solo se aprueba lo que está pendiente.",
      };
    case "retirar":
      if (estadoActual === ESTADOS.APROBADO) return { estado: ESTADOS.PENDIENTE };
      return { error: "Este post no tiene una aprobación que retirar." };
    default:
      return { error: `Acción desconocida: ${accion}` };
  }
}

/* ─── Calendario ──────────────────────────────────────────────────────────── */

export function enVentana(date) {
  return (
    !FIN_DE_SEMANA.includes(getMadridWeekday(date)) &&
    VENTANA_HORAS.includes(getMadridHour(date))
  );
}

// Primer instante >= `desde` en que corre el cron de publicación.
export function proximaVentana(desde) {
  if (enVentana(desde)) return new Date(desde);
  const base = new Date(desde);
  base.setUTCMinutes(0, 0, 0);
  for (let i = 1; i <= 24 * 14; i += 1) {
    const candidato = new Date(base.getTime() + i * HORA_MS);
    if (enVentana(candidato)) return candidato;
  }
  throw new Error("proximaVentana: no hay ventana en las próximas dos semanas");
}

// Cuándo sale (o salió) en LinkedIn. Un post aprobado sale cuando ya está en la
// web (su `date`) y además corre el cron; si se aprueba uno ya publicado en la
// web, sale en la siguiente ventana.
export function fechaPrevistaLinkedIn(post, now = new Date()) {
  if (post.linkedinPublicadoAt) return new Date(post.linkedinPublicadoAt);
  const base = Math.max(new Date(post.date).getTime(), now.getTime());
  return proximaVentana(new Date(base));
}

// Semana natural de Madrid (lunes 00:00 a lunes 00:00) que contiene `date`.
// Se ancla al mediodía para que un cambio de hora no desplace el día.
export function semanaMadrid(date) {
  const indice = DIAS.indexOf(getMadridWeekday(date));
  const mediodia = madridDayRange(date).start.getTime() + 12 * HORA_MS;
  return {
    inicio: madridDayRange(new Date(mediodia - indice * DIA_MS)).start,
    fin: madridDayRange(new Date(mediodia + (7 - indice) * DIA_MS)).start,
  };
}

const enRango = (fecha, { inicio, fin }) => fecha >= inicio && fecha < fin;

const tituloEs = (post) =>
  post?.translations?.find((t) => t.lang === "es")?.title ?? `Post ${post?.id ?? "?"}`;

// Publicaciones de la página de empresa que caen en la misma semana que la de
// `post`. `otros` son los posts APROBADO o PUBLICADO (con traducciones);
// `tomasEnviadas` son las tomas que publicó el sistema anterior (sent=true),
// de las que solo cuentan las de la página de empresa.
export function conflictosSemana({ post, otros = [], tomasEnviadas = [], now = new Date() }) {
  const fecha = fechaPrevistaLinkedIn(post, now);
  const semana = semanaMadrid(fecha);
  const conflictos = [];

  for (const otro of otros) {
    if (otro.id === post.id) continue;
    const suFecha = fechaPrevistaLinkedIn(otro, now);
    if (enRango(suFecha, semana)) {
      conflictos.push({
        postId: otro.id,
        titulo: tituloEs(otro),
        estado: otro.linkedinEstado,
        fecha: suFecha.toISOString(),
      });
    }
  }

  for (const toma of tomasEnviadas) {
    if (!toma.sentAt || toma.post?.id === post.id) continue;
    const enviada = new Date(toma.sentAt);
    if (!enRango(enviada, semana)) continue;
    // Solo el sistema anterior enviaba tomas, y en su calendario la de la
    // página de empresa era siempre la 2.
    if (toma.variant !== 2) continue;
    conflictos.push({
      postId: toma.post.id,
      titulo: tituloEs(toma.post),
      estado: ESTADOS.PUBLICADO,
      fecha: enviada.toISOString(),
    });
  }

  conflictos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return {
    fecha: fecha.toISOString(),
    semana: { inicio: semana.inicio.toISOString(), fin: semana.fin.toISOString() },
    conflictos,
    superaLimite: conflictos.length >= LIMITE_SEMANAL,
  };
}

/* ─── Contenido de la publicación ─────────────────────────────────────────── */

// De las tomas que escribe el cron generate-linkedin, la de la página de
// empresa. Desde noviembre de 2026 cada artículo lleva una sola toma, la de
// empresa. Los artículos anteriores llevan dos o tres (calendario antiguo) y
// en ellos la de empresa era siempre la 2; las otras se escribieron para el
// perfil de José.
export function elegirTomaEmpresa(post) {
  const tomas = [...(post.linkedinVariants || [])].sort(
    (a, b) => a.variant - b.variant,
  );
  if (tomas.length <= 1) return tomas[0] ?? null;
  return tomas.find((t) => t.variant === 2) ?? tomas[0];
}

function resumen(html) {
  const texto = (html || "")
    .replace(/<[^>]*>?/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
  return texto.length > 250 ? `${texto.slice(0, 250).trim()}…` : texto;
}

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Si el texto trae el enlace del artículo (el prompt pide que no, pero un
// texto escrito a mano puede llevarlo), se cambia por la versión con UTM.
export function utmEnTexto(texto, slug, urlConUtm) {
  if (!texto) return texto;
  const patron = new RegExp(
    `https?://(?:www\\.)?room714\\.com/es/blog/${escaparRegex(slug)}(?![\\w/?#-])`,
    "g",
  );
  return texto.replace(patron, urlConUtm);
}

// Lo que se manda al webhook de Make. Conserva los campos que ya lee el
// escenario (title, url, image, linkedin_post, link_for_first_comment,
// variant_id, canal...) para no tener que tocarlo; `canal` es siempre
// "empresa", así que solo corre la rama "Create a Company Image Post".
export function construirPublicacion(post) {
  const es = post.translations?.find((t) => t.lang === "es");
  if (!es) return null;

  const urlArticulo = `${SITE}/es/blog/${es.slug}`;
  const url = withLinkedInUtm(urlArticulo, es.slug);
  const toma = elegirTomaEmpresa(post);
  const texto = toma?.text || es.linkedinPost || resumen(es.content);
  const hashtags = (toma ? toma.hashtags : es.linkedinHashtags) || [];

  return {
    title: es.title,
    summary: resumen(es.content),
    url,
    image: toma?.imageBlobUrl || post.image,
    date: new Date(post.date).toISOString().split("T")[0],
    tags: es.tags || [],
    linkedin_post: utmEnTexto(texto, es.slug, url),
    linkedin_hashtags: hashtags,
    linkedin_hashtags_string: hashtags
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" "),
    link_for_first_comment: url,
    // El callback de Make guarda la URL del post publicado en esta toma. Sin
    // toma va vacío y el callback responde 400, que Make ignora a propósito.
    variant_id: toma?.id ?? "",
    variant_number: toma?.variant ?? null,
    variant_angle: toma?.angle ?? null,
    post_id: post.id,
    canal: "empresa",
  };
}
