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
        data: { lastEngagedAt: now },
      }),
    ]);

    revalidatePath("/admin/prospects");
    return { success: true, engagementId: engagement.id };
  } catch (err) {
    console.error("[prospects] registrar engagement falló:", err);
    return { success: false, error: err.message };
  }
}
