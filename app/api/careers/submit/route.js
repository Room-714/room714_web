import { NextResponse, after } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/app/lib/prisma";
import { summarizeCv } from "@/app/lib/ai/cvSummary";
import { sendCandidateSummaryEmail } from "@/app/lib/notifications/candidateReady";

export const maxDuration = 60;

const VALID_POSITIONS = new Set(["DEVELOPER", "DESIGNER", "PRODUCT_MANAGER"]);
const VALID_EDUCATIONS = new Set(["GRADO", "MASTER", "DOCTORADO", "OTHER"]);
const QUALIFIED_EDUCATIONS = new Set(["GRADO", "MASTER", "DOCTORADO"]);
const QUALIFIED_COUNTRY = "ES";
const VALID_COUNTRIES = new Set(["ES", "OTHER"]);

const MAX_CV_BYTES = 5 * 1024 * 1024;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días ≈ 1 mes

export async function POST(request) {
  let form;
  try {
    form = await request.formData();
  } catch (err) {
    return NextResponse.json(
      { error: "Cuerpo de la petición no válido" },
      { status: 400 },
    );
  }

  const position = String(form.get("position") || "").toUpperCase();
  const country = String(form.get("country") || "").toUpperCase();
  const education = String(form.get("education") || "").toUpperCase();
  const acceptedPrivacy = form.get("acceptedPrivacy") === "true";
  const cv = form.get("cv");

  if (!VALID_POSITIONS.has(position)) {
    return NextResponse.json({ error: "Posición no válida" }, { status: 400 });
  }
  if (!VALID_COUNTRIES.has(country)) {
    return NextResponse.json({ error: "País no válido" }, { status: 400 });
  }
  if (!VALID_EDUCATIONS.has(education)) {
    return NextResponse.json({ error: "Formación no válida" }, { status: 400 });
  }
  if (!acceptedPrivacy) {
    return NextResponse.json(
      { error: "Debes aceptar la política de privacidad" },
      { status: 400 },
    );
  }
  if (!cv || typeof cv === "string") {
    return NextResponse.json({ error: "CV requerido" }, { status: 400 });
  }
  if (cv.type !== "application/pdf") {
    return NextResponse.json(
      { error: "El CV debe ser un PDF" },
      { status: 400 },
    );
  }
  if (cv.size > MAX_CV_BYTES) {
    return NextResponse.json(
      { error: "El CV no puede pesar más de 5MB" },
      { status: 400 },
    );
  }

  // Filtro silencioso: si no cumple, devolvemos thanks sin almacenar ni avisar.
  const qualifies =
    country === QUALIFIED_COUNTRY && QUALIFIED_EDUCATIONS.has(education);
  if (!qualifies) {
    return NextResponse.json({ success: true });
  }

  // Camino feliz: subir CV + insertar fila ANTES de responder (estos pasos
  // son rápidos y queremos garantizar persistencia de los datos del
  // candidato antes de devolverle el thanks).
  const arrayBuffer = await cv.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Subcarpeta por posición + filename original sanitizado. addRandomSuffix
  // garantiza unicidad si dos candidatos suben CVs con el mismo nombre.
  const sanitizedName =
    cv.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "cv.pdf";
  const folder = position.toLowerCase();
  const fileName = `careers/${folder}/${sanitizedName}`;
  const blob = await put(fileName, buffer, {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: true,
  });
  const cvBlobUrl = blob.url;

  const candidate = await prisma.candidate.create({
    data: {
      position,
      country,
      education,
      cvBlobUrl,
      expiresAt: new Date(Date.now() + RETENTION_MS),
    },
  });

  // Trabajo lento (resumen IA + email a RRHH + update de la fila) se
  // ejecuta después de devolver la respuesta. El candidato ve la página
  // de gracias en < 2 s sin esperar 20+ s del análisis IA.
  after(async () => {
    let aiSummary = null;
    let emailSent = false;

    try {
      aiSummary = await summarizeCv({
        pdfBase64: buffer.toString("base64"),
        position,
      });
    } catch (err) {
      console.error("CV summary falló:", err);
    }

    try {
      const emailResult = await sendCandidateSummaryEmail({
        candidateId: candidate.id,
        position,
        country,
        education,
        cvBlobUrl,
        aiSummary,
      });
      emailSent = !!emailResult.success;
    } catch (err) {
      console.error("Email a RRHH falló:", err);
    }

    if (aiSummary || emailSent) {
      try {
        await prisma.candidate.update({
          where: { id: candidate.id },
          data: { aiSummary, emailSent },
        });
      } catch (err) {
        console.error("Update post-procesado falló:", err);
      }
    }
  });

  return NextResponse.json({ success: true });
}
