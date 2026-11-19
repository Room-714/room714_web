// Publicación automática en LinkedIn, sin aprobaciones (noviembre de 2026).
//
// - Página de empresa: viernes 08:30. El mejor post del blog de la semana
//   (C2 > C1 > C3, y entre empates el más reciente) con el texto de su toma y
//   el enlace con UTM, al escenario de Make de siempre (MAKE_WEBHOOK_URL).
//   Semana sin posts: no sale nada.
// - Perfil de José: martes y jueves 08:30. Un texto nuevo a partir del post
//   más reciente que no se haya usado en el perfil, al escenario de Make del
//   perfil (MAKE_WEBHOOK_LINKEDIN_PERSONAL).
// - Fallo: se guarda como FALLIDO y la ejecución de las 08:45 lo reintenta
//   una vez (reenvía lo mismo; si ni siquiera se llegó a generar, lo genera).
//   Si vuelve a fallar, correo a José y nada más ese día.
//
// Base de datos (la de producción se ha quedado sin conexiones otras veces):
// cada ejecución hace UNA lectura, una sola sentencia SQL con todo lo que
// necesita (leerEstado), y como mucho UNA escritura al final para dejar
// constancia del envío (texto, fecha y estado). Nada en bucle ni en paralelo,
// y con el cliente compartido de @/app/lib/prisma.

import { prisma } from "@/app/lib/prisma";
import { madridDateString } from "@/app/lib/time/madrid";
import { construirPublicacion, semanaMadrid, SITE } from "./aprobacion";
import { configLinkedIn } from "./config";
import { generarTextoPerfil, RECIENTES } from "./perfilPersonal";
import { paraLinkedIn } from "./littleText";
import {
  clusterDePost,
  mejorPostDeLaSemana,
  proximaEjecucion,
  siguientePostPerfil,
} from "./selectores";
import { sendLinkedInFalloEmail } from "@/app/lib/notifications/linkedinFallo";

const CANAL_BD = { empresa: "EMPRESA", personal: "PERSONAL" };
const TIMEOUT_MAKE_MS = 60_000;
// Posts que se leen: los de la semana (empresa) están siempre entre los más
// recientes, y para el perfil basta con los últimos (se publica el más reciente
// sin usar).
const POSTS_LEIDOS = 12;
const DIAS_ATRAS = 60;

/* ─── Lectura: una sola sentencia ─────────────────────────────────────────── */

// json_agg devuelve los timestamp sin zona; en la BD están en UTC.
const fechaUtc = (v) =>
  v == null ? null : new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`);

/** Pasa la fila de la consulta a la forma que usan los selectores y Make. */
export function normalizarEstado(fila = {}) {
  const posts = (fila.posts || []).map((p) => ({
    id: p.id,
    date: fechaUtc(p.date),
    category: p.category,
    image: p.image,
    published: true,
    translations: [
      {
        lang: "es",
        slug: p.slug,
        title: p.title,
        content: p.content,
        tags: p.tags || [],
        linkedinPost: p.linkedinPost,
        linkedinHashtags: p.linkedinHashtags || [],
      },
    ],
    linkedinVariants: p.tomas || [],
  }));
  const envio = (e) => ({ ...e, enviadoAt: fechaUtc(e.enviadoAt) });
  return {
    posts,
    recientesPerfil: (fila.recientesPerfil || []).map(envio),
    usadosPerfil: (fila.usadosPerfil || []).filter((id) => id != null),
    enviosSemana: (fila.enviosSemana || []).map(envio),
  };
}

/**
 * Todo lo que necesitan los dos canales, en UNA sentencia: los últimos posts
 * publicados (con su traducción española y sus tomas), los últimos 20 textos
 * del perfil, los posts ya usados en el perfil y los envíos de esta semana.
 */
export async function leerEstado(ahora = new Date()) {
  const hasta = ahora.toISOString();
  const desde = new Date(ahora.getTime() - DIAS_ATRAS * 86_400_000).toISOString();
  const lunes = madridDateString(semanaMadrid(ahora).inicio);
  const [fila] = await prisma.$queryRaw`
    SELECT
      (SELECT COALESCE(json_agg(x ORDER BY x."date" DESC, x."id" DESC), '[]'::json) FROM (
         SELECT p."id", p."date", p."category"::text AS "category", p."image",
                t."slug", t."title", t."content", t."tags", t."linkedinPost", t."linkedinHashtags",
                (SELECT COALESCE(json_agg(json_build_object(
                           'id', v."id", 'variant', v."variant", 'angle', v."angle",
                           'text', v."text", 'hashtags', v."hashtags",
                           'imageBlobUrl', v."imageBlobUrl") ORDER BY v."variant"), '[]'::json)
                   FROM "LinkedInVariant" v WHERE v."postId" = p."id") AS "tomas"
         FROM "Post" p
         JOIN "PostTranslation" t ON t."postId" = p."id" AND t."lang" = 'es'
         WHERE p."published" = true
           AND p."date" <= ${hasta}::timestamp
           AND p."date" >= ${desde}::timestamp
         ORDER BY p."date" DESC, p."id" DESC
         LIMIT ${POSTS_LEIDOS}
      ) x) AS "posts",
      (SELECT COALESCE(json_agg(r ORDER BY r."enviadoAt" DESC), '[]'::json) FROM (
         SELECT e."postId", e."texto", e."idea", e."enviadoAt"
         FROM "LinkedInEnvio" e
         WHERE e."canal" = 'PERSONAL' AND e."estado" = 'ENVIADO'
         ORDER BY e."enviadoAt" DESC
         LIMIT ${RECIENTES}
      ) r) AS "recientesPerfil",
      (SELECT COALESCE(json_agg(DISTINCT e."postId"), '[]'::json)
         FROM "LinkedInEnvio" e
         WHERE e."canal" = 'PERSONAL' AND e."estado" = 'ENVIADO' AND e."postId" IS NOT NULL
      ) AS "usadosPerfil",
      (SELECT COALESCE(json_agg(s), '[]'::json) FROM (
         SELECT e."id", e."canal"::text AS "canal", to_char(e."dia", 'YYYY-MM-DD') AS "dia",
                e."postId", e."texto", e."idea", e."payload", e."estado"::text AS "estado",
                e."intentos", e."error", e."enviadoAt"
         FROM "LinkedInEnvio" e
         WHERE e."dia" >= ${lunes}::date
      ) s) AS "enviosSemana"`;
  return normalizarEstado(fila);
}

/* ─── Contenido de cada canal ─────────────────────────────────────────────── */

const tituloEs = (post) => post?.translations?.[0]?.title ?? null;

export function construirPublicacionPerfil(post, texto) {
  return {
    canal: "personal",
    texto,
    post_id: post.id,
    // Solo para el registro del escenario: el texto NO lleva enlace.
    articulo: `${SITE}/es/blog/${post.translations[0].slug}`,
  };
}

/**
 * Prepara el envío del canal sin enviar nada: { post, payload, texto, idea }
 * o { omitido: motivo }. Lanza si falla la generación del texto.
 */
export async function prepararEnvio(canal, estado, ahora, deps = {}) {
  if (canal === "empresa") {
    const post = mejorPostDeLaSemana(estado.posts, ahora);
    if (!post) return { omitido: "Esta semana no hay posts nuevos en el blog" };
    const payload = construirPublicacion(post);
    return { post, payload, texto: payload.linkedin_post, idea: null };
  }

  const post = siguientePostPerfil(estado.posts, estado.usadosPerfil, ahora);
  if (!post) return { omitido: "No queda ningún post del blog sin usar en el perfil" };
  const es = post.translations[0];
  const { texto, idea } = await (deps.generarTextoPerfil ?? generarTextoPerfil)({
    post: { id: post.id, titulo: es.title, contenidoHtml: es.content },
    recientes: estado.recientesPerfil,
  });
  return { post, payload: construirPublicacionPerfil(post, texto), texto, idea };
}

/* ─── Envío a Make ────────────────────────────────────────────────────────── */

// Único punto de salida hacia Make (empresa, perfil y flujo de aprobación).
// Aquí, y solo aquí, se escapa el texto al formato de LinkedIn (littleText.js).
export async function enviarAMake(url, payload, fetchImpl = fetch) {
  if (!url) throw new Error("Falta la URL del webhook de Make");
  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paraLinkedIn(payload)),
      signal: AbortSignal.timeout(TIMEOUT_MAKE_MS),
    });
  } catch (err) {
    throw new Error(`No se pudo contactar con Make: ${err.message}`);
  }
  if (!res.ok) throw new Error(`Make respondió ${res.status}`);
}

/* ─── Una ejecución del cron ──────────────────────────────────────────────── */

const resumenPost = (post) =>
  post && { id: post.id, titulo: tituloEs(post), cluster: clusterDePost(post), fecha: post.date };

/**
 * Ejecuta el canal en su franja. `modo`: "principal" (08:30) o "reintento"
 * (08:45). Devuelve un resumen para la respuesta del cron.
 */
export async function ejecutarCanal({ canal, modo, ahora = new Date(), deps = {} }) {
  const config = deps.config ?? configLinkedIn();
  const cfg = config[canal];
  if (!cfg.activo) {
    const motivo =
      canal === "empresa" && config.flujoAprobacion
        ? "LINKEDIN_APPROVAL_FLOW=true: la página de empresa sale solo por aprobación"
        : `Interruptor ${canal === "empresa" ? "LINKEDIN_COMPANY_AUTOPOST" : "LINKEDIN_PERSONAL_AUTOPOST"} desactivado`;
    return { canal, modo, omitido: motivo };
  }
  if (!cfg.webhook) {
    return {
      canal,
      modo,
      omitido: `Sin webhook de Make (${canal === "empresa" ? "MAKE_WEBHOOK_URL" : "MAKE_WEBHOOK_LINKEDIN_PERSONAL"})`,
    };
  }

  const hoy = madridDateString(ahora);
  const estado = await leerEstado(ahora);
  const delCanal = estado.enviosSemana.filter((e) => e.canal === CANAL_BD[canal]);
  const deHoy = delCanal.find((e) => e.dia === hoy);
  const enviar = (payload) => enviarAMake(cfg.webhook, payload, deps.fetch);
  const avisar = deps.avisar ?? sendLinkedInFalloEmail;

  if (modo === "principal") {
    if (deHoy) return { canal, modo, omitido: `Ya hay un envío de hoy (${deHoy.estado})` };
    if (canal === "empresa" && delCanal.some((e) => e.estado === "ENVIADO")) {
      return { canal, modo, omitido: "La página de empresa ya publicó esta semana" };
    }

    let prep = null;
    let error = null;
    try {
      prep = await prepararEnvio(canal, estado, ahora, deps);
      if (prep.omitido) return { canal, modo, omitido: prep.omitido };
      await enviar(prep.payload);
    } catch (err) {
      error = err.message;
    }

    await prisma.linkedInEnvio.create({
      data: {
        canal: CANAL_BD[canal],
        dia: new Date(`${hoy}T00:00:00Z`),
        postId: prep?.post?.id ?? null,
        texto: prep?.texto ?? null,
        idea: prep?.idea ?? null,
        payload: prep?.payload ?? undefined,
        estado: error ? "FALLIDO" : "ENVIADO",
        intentos: 1,
        error,
        enviadoAt: error ? null : ahora,
      },
    });

    return {
      canal,
      modo,
      enviado: !error,
      error,
      post: resumenPost(prep?.post),
      ...(error ? { siguiente: "Reintento a las 08:45" } : {}),
    };
  }

  // Reintento (08:45): solo si la principal de hoy falló una vez.
  if (!deHoy) return { canal, modo, omitido: "Hoy no hay ningún envío fallido que reintentar" };
  if (deHoy.estado === "ENVIADO") return { canal, modo, omitido: "El envío de hoy ya salió" };
  if (deHoy.intentos >= 2) return { canal, modo, omitido: "Ya se reintentó hoy" };

  let prep = deHoy.payload
    ? { payload: deHoy.payload, texto: deHoy.texto, idea: deHoy.idea, post: estado.posts.find((p) => p.id === deHoy.postId) ?? null }
    : null;
  let error = null;
  try {
    if (!prep) {
      prep = await prepararEnvio(canal, estado, ahora, deps);
      if (prep.omitido) throw new Error(prep.omitido);
    }
    await enviar(prep.payload);
  } catch (err) {
    error = err.message;
  }

  await prisma.linkedInEnvio.updateMany({
    where: { id: deHoy.id, estado: "FALLIDO", intentos: deHoy.intentos },
    data: {
      estado: error ? "FALLIDO" : "ENVIADO",
      intentos: deHoy.intentos + 1,
      error: error ?? deHoy.error,
      postId: prep?.post?.id ?? deHoy.postId ?? null,
      texto: prep?.texto ?? deHoy.texto ?? null,
      idea: prep?.idea ?? deHoy.idea ?? null,
      ...(prep?.payload && !deHoy.payload ? { payload: prep.payload } : {}),
      enviadoAt: error ? null : ahora,
    },
  });

  let aviso = null;
  if (error) {
    aviso = await avisar({
      canal,
      error: `1.º intento: ${deHoy.error ?? "?"}\n2.º intento: ${error}`,
      titulo: tituloEs(prep?.post),
      texto: prep?.texto ?? null,
      intentos: deHoy.intentos + 1,
      fecha: hoy,
    });
  }

  return {
    canal,
    modo,
    enviado: !error,
    error,
    post: resumenPost(prep?.post),
    ...(error ? { aviso: aviso?.success === true ? "correo enviado" : "correo NO enviado" } : {}),
  };
}

/* ─── Vista previa ────────────────────────────────────────────────────────── */

/**
 * Lo que saldría en la próxima ejecución de cada canal, con los datos de
 * ahora. No envía nada ni escribe en la BD. Para el perfil genera el texto
 * (una llamada al modelo): el de verdad se vuelve a generar al publicar.
 */
export async function vistaPrevia({ ahora = new Date(), deps = {} } = {}) {
  const config = deps.config ?? configLinkedIn();
  const estado = await leerEstado(ahora);
  const canales = {};

  for (const canal of ["empresa", "personal"]) {
    const cuando = proximaEjecucion(canal, ahora);
    const cfg = config[canal];
    const info = {
      proximaEjecucion: cuando?.toISOString() ?? null,
      activo: cfg.activo,
      webhookConfigurado: Boolean(cfg.webhook),
    };
    if (!cfg.activo) {
      info.nota =
        canal === "empresa" && config.flujoAprobacion
          ? "Desactivado: LINKEDIN_APPROVAL_FLOW=true"
          : "Desactivado por su interruptor";
    }
    try {
      // La empresa mira la semana de su próxima ejecución, con lo publicado hasta ahora.
      const enLaFecha = canal === "empresa" && cuando ? cuando : ahora;
      const datos =
        canal === "empresa"
          ? { ...estado, posts: estado.posts.filter((p) => p.date <= ahora) }
          : estado;
      const prep = await prepararEnvio(canal, datos, enLaFecha, deps);
      if (prep.omitido) {
        info.post = null;
        info.motivo = prep.omitido;
      } else {
        info.post = resumenPost(prep.post);
        info.texto = prep.texto;
        if (prep.idea) info.idea = prep.idea;
        info.payload = prep.payload;
        // Lo que recibiría Make, ya escapado al formato de LinkedIn.
        info.payloadMake = paraLinkedIn(prep.payload);
      }
    } catch (err) {
      info.error = err.message;
    }
    canales[canal] = info;
  }

  return {
    mode: "preview",
    message: "Vista previa: nada enviado ni guardado",
    ahora: ahora.toISOString(),
    flujoAprobacion: config.flujoAprobacion,
    canales,
    ultimosTextosPerfil: estado.recientesPerfil.length,
  };
}
