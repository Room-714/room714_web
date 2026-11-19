"use server";

// Acciones del panel para LinkedIn. Ninguna publica nada: como mucho dejan un
// post en APROBADO, y es el cron /api/cron/publish-linkedin el que lo envía.
//
// Desde noviembre de 2026 LinkedIn se publica solo (app/lib/linkedin/autopost.js)
// y este flujo de aprobación queda apagado detrás de LINKEDIN_APPROVAL_FLOW:
// sin "true", todas las acciones responden que está desactivado y el panel no
// las enseña (configLinkedInPanel).
//
// Base de datos: una consulta detrás de otra, nunca en paralelo ni en bucle,
// siempre con el cliente compartido de @/app/lib/prisma.
import { cookies, headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/app/lib/prisma";
import {
  ESTADOS,
  construirPublicacion,
  conflictosSemana,
  fechaPrevistaLinkedIn,
  semanaMadrid,
  transicion,
} from "@/app/lib/linkedin/aprobacion";
import { generarBorradorPerfil } from "@/app/lib/linkedin/borradorPerfil";
import { flujoAprobacionActivo } from "@/app/lib/linkedin/config";

// Las server actions se pueden invocar por POST desde cualquier ruta, no solo
// desde /admin, así que la protección del proxy no basta: se comprueba aquí la
// misma sesión de NextAuth.
async function exigirAdmin() {
  const token = await getToken({
    req: { cookies: await cookies(), headers: await headers() },
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!token) throw new Error("No autorizado");
}

function exigirFlujoAprobacion() {
  if (!flujoAprobacionActivo()) {
    throw new Error("El flujo de aprobación de LinkedIn está desactivado (LINKEDIN_APPROVAL_FLOW)");
  }
}

/** Lo que el panel necesita saber para enseñar u ocultar la parte de LinkedIn. */
export async function configLinkedInPanel() {
  try {
    await exigirAdmin();
    return { success: true, flujoAprobacion: flujoAprobacionActivo() };
  } catch (err) {
    return { success: false, error: err.message, flujoAprobacion: false };
  }
}

const idValido = (postId) => {
  const id = Number(postId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Post no válido");
  return id;
};

const selectTomas = {
  id: true,
  variant: true,
  angle: true,
  text: true,
  hashtags: true,
  imageBlobUrl: true,
  crossNote: true,
};

/**
 * Estado de LinkedIn de un post y la vista previa de lo que se publicaría.
 */
export async function obtenerLinkedIn(postId) {
  try {
    await exigirAdmin();
    exigirFlujoAprobacion();
    const id = idValido(postId);
    const post = await prisma.post.findUnique({
      where: { id },
      include: { translations: true, linkedinVariants: { select: selectTomas } },
    });
    if (!post) return { success: false, error: "Post no encontrado" };

    const publicacion = construirPublicacion(post);
    return {
      success: true,
      estado: post.linkedinEstado,
      aprobadoAt: post.linkedinAprobadoAt?.toISOString() ?? null,
      publicadoAt: post.linkedinPublicadoAt?.toISOString() ?? null,
      fechaPrevista:
        post.linkedinEstado === ESTADOS.PUBLICADO
          ? post.linkedinPublicadoAt?.toISOString() ?? null
          : fechaPrevistaLinkedIn(post).toISOString(),
      vistaPrevia: publicacion
        ? {
            texto: publicacion.linkedin_post,
            hashtags: publicacion.linkedin_hashtags_string,
            url: publicacion.url,
          }
        : null,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Casilla "Publicar en LinkedIn". Marcarla deja el post PENDIENTE de
 * aprobación; desmarcarla lo devuelve a solo web (y retira una aprobación).
 */
export async function marcarLinkedIn(postId, marcado) {
  try {
    await exigirAdmin();
    exigirFlujoAprobacion();
    const id = idValido(postId);
    const post = await prisma.post.findUnique({
      where: { id },
      select: { linkedinEstado: true },
    });
    if (!post) return { success: false, error: "Post no encontrado" };

    const r = transicion(post.linkedinEstado, marcado ? "marcar" : "desmarcar");
    if (r.error) return { success: false, error: r.error };
    if (r.estado === post.linkedinEstado) return { success: true, estado: r.estado };

    // La condición sobre el estado leído evita pisar un cambio simultáneo (por
    // ejemplo, que el cron lo acabe de publicar).
    const { count } = await prisma.post.updateMany({
      where: { id, linkedinEstado: post.linkedinEstado },
      data: { linkedinEstado: r.estado, linkedinAprobadoAt: null },
    });
    if (count === 0) {
      return { success: false, error: "El post cambió mientras tanto. Recarga y vuelve a probar." };
    }
    return { success: true, estado: r.estado };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Aprobación explícita. Si esa semana ya hay otra publicación en la página de
 * empresa, no aprueba: devuelve los conflictos para que el panel lo avise y
 * pida confirmación (confirmarSegunda: true).
 */
export async function aprobarLinkedIn(postId, { confirmarSegunda = false } = {}) {
  try {
    await exigirAdmin();
    exigirFlujoAprobacion();
    const id = idValido(postId);
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        date: true,
        linkedinEstado: true,
        linkedinPublicadoAt: true,
      },
    });
    if (!post) return { success: false, error: "Post no encontrado" };

    const r = transicion(post.linkedinEstado, "aprobar");
    if (r.error) return { success: false, error: r.error };

    const now = new Date();
    const semana = semanaMadrid(fechaPrevistaLinkedIn(post, now));
    const tituloEs = { where: { lang: "es" }, select: { lang: true, title: true } };

    const otros = await prisma.post.findMany({
      where: {
        id: { not: id },
        OR: [
          { linkedinEstado: ESTADOS.APROBADO },
          {
            linkedinEstado: ESTADOS.PUBLICADO,
            linkedinPublicadoAt: { gte: semana.inicio, lt: semana.fin },
          },
        ],
      },
      select: {
        id: true,
        date: true,
        linkedinEstado: true,
        linkedinPublicadoAt: true,
        translations: tituloEs,
      },
    });

    // Las publicaciones que hizo el sistema anterior de tomas también cuentan.
    const tomasEnviadas = await prisma.linkedInVariant.findMany({
      where: { sent: true, sentAt: { gte: semana.inicio, lt: semana.fin } },
      select: {
        variant: true,
        sentAt: true,
        post: { select: { id: true, date: true, translations: tituloEs } },
      },
    });

    const limite = conflictosSemana({ post, otros, tomasEnviadas, now });
    if (limite.superaLimite && !confirmarSegunda) {
      return {
        success: false,
        necesitaConfirmacion: true,
        fechaPrevista: limite.fecha,
        conflictos: limite.conflictos,
      };
    }

    const { count } = await prisma.post.updateMany({
      where: { id, linkedinEstado: post.linkedinEstado },
      data: { linkedinEstado: ESTADOS.APROBADO, linkedinAprobadoAt: now },
    });
    if (count === 0) {
      return { success: false, error: "El post cambió mientras tanto. Recarga y vuelve a probar." };
    }
    return { success: true, estado: ESTADOS.APROBADO, fechaPrevista: limite.fecha };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Retira una aprobación que aún no se ha enviado: vuelve a PENDIENTE.
 */
export async function retirarAprobacionLinkedIn(postId) {
  try {
    await exigirAdmin();
    exigirFlujoAprobacion();
    const id = idValido(postId);
    const { count } = await prisma.post.updateMany({
      where: { id, linkedinEstado: ESTADOS.APROBADO },
      data: { linkedinEstado: ESTADOS.PENDIENTE, linkedinAprobadoAt: null },
    });
    if (count === 0) {
      return { success: false, error: "No había una aprobación pendiente de envío que retirar." };
    }
    return { success: true, estado: ESTADOS.PENDIENTE };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Borrador para el perfil personal de José. Solo devuelve texto: no guarda ni
 * publica nada.
 */
export async function borradorPerfilJose(postId) {
  try {
    await exigirAdmin();
    exigirFlujoAprobacion();
    const id = idValido(postId);
    const es = await prisma.postTranslation.findFirst({
      where: { postId: id, lang: "es" },
      select: { title: true, content: true },
    });
    if (!es) return { success: false, error: "El post no tiene versión en español" };

    const texto = await generarBorradorPerfil({
      titulo: es.title,
      contenidoHtml: es.content,
    });
    return { success: true, texto };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
