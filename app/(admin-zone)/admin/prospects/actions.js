"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/authOptions";

// Defensa en profundidad, como en candidates/actions.js: el proxy ya exige
// sesión bajo /admin, pero estas acciones escriben en BD.
async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("No autorizado");
}

const VALID_STATUS = ["ACTIVE", "PAUSED", "CLIENT", "DISCARDED"];
const VALID_KIND = ["buyer", "reference"];

export async function listProspects() {
  try {
    const prospects = await prisma.prospect.findMany({
      orderBy: [{ status: "asc" }, { lastEngagedAt: { sort: "asc", nulls: "first" } }],
      include: {
        engagements: { orderBy: { createdAt: "desc" }, take: 3 },
      },
    });
    return { success: true, prospects };
  } catch (err) {
    console.error("[prospects] listar falló:", err);
    return { success: false, error: err.message };
  }
}

export async function saveProspect(data) {
  await requireSession();

  const linkedinUrl = (data.linkedinUrl || "").trim();
  const name = (data.name || "").trim();
  if (!name || !linkedinUrl) {
    return { success: false, error: "Nombre y URL de LinkedIn son obligatorios" };
  }
  let host;
  try {
    host = new URL(linkedinUrl).hostname;
  } catch {
    return { success: false, error: "URL de LinkedIn no válida" };
  }
  if (!/(^|\.)linkedin\.com$/.test(host)) {
    return { success: false, error: "La URL debe ser de linkedin.com" };
  }

  const payload = {
    name,
    linkedinUrl,
    company: (data.company || "").trim() || null,
    role: (data.role || "").trim() || null,
    sector: (data.sector || "").trim() || null,
    interest: (data.interest || "").trim() || null,
    notes: (data.notes || "").trim() || null,
    keywords: Array.isArray(data.keywords)
      ? data.keywords
      : String(data.keywords || "")
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
    status: VALID_STATUS.includes(data.status) ? data.status : "ACTIVE",
    kind: VALID_KIND.includes(data.kind) ? data.kind : "buyer",
  };

  try {
    const prospect = data.id
      ? await prisma.prospect.update({
          where: { id: Number(data.id) },
          data: payload,
        })
      : await prisma.prospect.create({ data: payload });

    revalidatePath("/admin/prospects");
    return { success: true, prospect };
  } catch (err) {
    if (err.code === "P2002") {
      return { success: false, error: "Ya existe un prospecto con esa URL" };
    }
    console.error("[prospects] guardar falló:", err);
    return { success: false, error: err.message };
  }
}

export async function setProspectStatus(id, status) {
  await requireSession();
  if (!VALID_STATUS.includes(status)) {
    return { success: false, error: "Estado no válido" };
  }
  try {
    await prisma.prospect.update({
      where: { id: Number(id) },
      data: { status },
    });
    revalidatePath("/admin/prospects");
    return { success: true };
  } catch (err) {
    console.error("[prospects] cambiar estado falló:", err);
    return { success: false, error: err.message };
  }
}

// Tras tres saltos seguidos dejamos de intentarlo: quien no publica nada tres
// veces no sirve para una estrategia que consiste en comentarle.
const MAX_CONSECUTIVE_SKIPS = 3;

// El prospecto salió en el briefing pero no había nada que comentar. Cuenta
// como atención —mueve `lastTouchedAt`— sin tocar `lastEngagedAt`, que sigue
// midiendo comentarios reales. Es lo que desbloquea la cola.
export async function skipProspect(id, reason) {
  await requireSession();
  const prospectId = Number(id);
  if (!Number.isInteger(prospectId) || prospectId <= 0) {
    return { success: false, error: "Identificador no válido" };
  }

  try {
    const current = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { skipCount: true, notes: true, name: true },
    });
    if (!current) return { success: false, error: "Ese prospecto ya no existe" };

    const skipCount = (current.skipCount || 0) + 1;
    const paused = skipCount >= MAX_CONSECUTIVE_SKIPS;

    const trimmedReason = (reason || "").trim();
    const notes = trimmedReason
      ? [current.notes, `[salto ${skipCount}] ${trimmedReason}`]
          .filter(Boolean)
          .join("\n")
      : current.notes;

    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        lastTouchedAt: new Date(),
        skipCount,
        notes,
        ...(paused ? { status: "PAUSED" } : {}),
      },
    });

    revalidatePath("/admin/prospects");
    return {
      success: true,
      skipCount,
      paused,
      message: paused
        ? `${current.name} pasa a pausado tras ${skipCount} saltos seguidos`
        : `Saltado. Vuelve al final de la cola (${skipCount}/${MAX_CONSECUTIVE_SKIPS})`,
    };
  } catch (err) {
    console.error("[prospects] saltar falló:", err);
    return { success: false, error: err.message };
  }
}

// Borrado real, no un cambio de estado. Hace falta poder eliminar de verdad:
// son datos personales de terceros y alguien puede pedir que se le borre.
// Los ProspectEngagement caen en cascada por el onDelete del esquema.
export async function deleteProspect(id) {
  await requireSession();
  const prospectId = Number(id);
  if (!Number.isInteger(prospectId) || prospectId <= 0) {
    return { success: false, error: "Identificador no válido" };
  }
  try {
    await prisma.prospect.delete({ where: { id: prospectId } });
    revalidatePath("/admin/prospects");
    return { success: true };
  } catch (err) {
    if (err.code === "P2025") {
      return { success: false, error: "Ese prospecto ya no existe" };
    }
    console.error("[prospects] borrar falló:", err);
    return { success: false, error: err.message };
  }
}

// Lanza el cron de descubrimiento a demanda, para no esperar al lunes.
// `preview` no gasta créditos: solo enseña a quién encontraría.
export async function runDiscovery({ preview = false } = {}) {
  await requireSession();

  const baseUrl = process.env.NEXTAUTH_URL || "https://www.room714.com";
  const url = `${baseUrl}/api/cron/discover-prospects${preview ? "?preview=1" : ""}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) {
      return { success: false, error: result?.error || `HTTP ${response.status}` };
    }
    revalidatePath("/admin/prospects");
    return { success: true, result };
  } catch (err) {
    console.error("[prospects] descubrimiento falló:", err);
    return { success: false, error: err.message };
  }
}

// Registra que José publicó un comentario: guarda el engagement y actualiza
// lastEngagedAt, que es lo que mueve la rotación del briefing.
export async function registerEngagement({ prospectId, comment, postUrl, postExcerpt }) {
  await requireSession();

  const text = (comment || "").trim();
  if (!prospectId || !text) {
    return { success: false, error: "Falta el prospecto o el comentario" };
  }

  try {
    const now = new Date();
    const [engagement] = await prisma.$transaction([
      prisma.prospectEngagement.create({
        data: {
          prospectId: Number(prospectId),
          comment: text,
          postUrl: (postUrl || "").trim() || null,
          postExcerpt: (postExcerpt || "").trim().slice(0, 1000) || null,
        },
      }),
      prisma.prospect.update({
        where: { id: Number(prospectId) },
        // Los dos relojes: `lastEngagedAt` es la métrica de trabajo hecho y
        // `lastTouchedAt` mueve la cola. Comentar reinicia los saltos.
        data: { lastEngagedAt: now, lastTouchedAt: now, skipCount: 0 },
      }),
    ]);

    revalidatePath("/admin/prospects");
    return { success: true, engagementId: engagement.id };
  } catch (err) {
    console.error("[prospects] registrar engagement falló:", err);
    return { success: false, error: err.message };
  }
}
