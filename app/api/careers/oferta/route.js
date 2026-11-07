import { NextResponse, after } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/app/lib/prisma";
import { summarizeCv } from "@/app/lib/ai/cvSummary";
import { clasificarRespuestas, decidir } from "@/app/lib/ai/cribaOferta";
import { sendCandidateSummaryEmail } from "@/app/lib/notifications/candidateReady";
import { OFERTAS_POR_POSICION, textoOferta } from "@/app/data/ofertas";

// Candidatura a una oferta publicada, desde el chat de su página.
//
// El journey es idéntico para todos: quien cumple y quien no ven las mismas
// preguntas, los mismos errores (solo de forma: PDF, tamaño, respuesta vacía)
// y la misma respuesta final. La diferencia está solo aquí dentro: si la
// criba descarta, no se guarda nada (ni PDF, ni fila, ni email).

export const maxDuration = 60;

const MAX_CV_BYTES = 5 * 1024 * 1024;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días ≈ 1 mes
const MAX_RESPUESTA = 600;

const ok = () => NextResponse.json({ success: true });
const mal = (error) => NextResponse.json({ error }, { status: 400 });

function sanitizarNombre(nombre) {
  return (
    nombre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "cv.pdf"
  );
}

export async function POST(request) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return mal("Cuerpo de la petición no válido");
  }

  const position = String(form.get("position") || "").toUpperCase();
  const oferta = OFERTAS_POR_POSICION[position];
  if (!oferta) return mal("Oferta no válida");

  const respuestas = {
    residencia: String(form.get("residencia") || "").trim(),
    formacion: String(form.get("formacion") || "").trim(),
    experiencia: String(form.get("experiencia") || "").trim(),
  };
  for (const valor of Object.values(respuestas)) {
    if (!valor) return mal("Falta alguna respuesta");
    if (valor.length > MAX_RESPUESTA) return mal("Alguna respuesta es demasiado larga");
  }

  if (form.get("acceptedPrivacy") !== "true") {
    return mal("Debes aceptar la política de privacidad");
  }
  const cv = form.get("cv");
  if (!cv || typeof cv === "string") return mal("CV requerido");
  if (cv.type !== "application/pdf") return mal("El CV debe ser un PDF");
  if (cv.size > MAX_CV_BYTES) return mal("El CV no puede pesar más de 5MB");

  // Criba. Si la llamada falla, la candidatura pasa marcada para revisión a
  // mano: perder a alguien que cumple por un fallo técnico es peor que
  // revisar a uno que no.
  let clasificacion = null;
  let cribaFallida = false;
  try {
    clasificacion = await clasificarRespuestas({
      textoOferta: textoOferta(oferta),
      respuestas,
    });
  } catch (err) {
    console.error("Criba de candidatura falló:", err);
    cribaFallida = true;
  }

  if (!cribaFallida && !decidir(clasificacion)) {
    // Sin datos personales en el log.
    console.log(`Candidatura a ${position} descartada por la criba`);
    return ok();
  }

  // Cumple: CV y fila se guardan ANTES de responder, para no perder la
  // candidatura si algo falla después.
  const buffer = Buffer.from(await cv.arrayBuffer());
  const blob = await put(
    `careers/${position.toLowerCase()}/${sanitizarNombre(cv.name)}`,
    buffer,
    { access: "public", contentType: "application/pdf", addRandomSuffix: true },
  );
  const cvBlobUrl = blob.url;

  const education =
    clasificacion && clasificacion.titulacion !== "NINGUNA"
      ? clasificacion.titulacion
      : "OTHER";
  const country = "ES";

  const candidate = await prisma.candidate.create({
    data: {
      position,
      country,
      education,
      cvBlobUrl,
      expiresAt: new Date(Date.now() + RETENTION_MS),
    },
  });

  // Las respuestas del chat van delante del resumen del CV: es lo primero
  // que RRHH quiere ver, y así quedan también en el admin.
  const cabecera = [
    "## Respuestas en el chat",
    "",
    cribaFallida
      ? "⚠️ La criba automática falló: comprueba a mano residencia, formación y experiencia."
      : null,
    `- **¿Dónde resides?** ${respuestas.residencia}`,
    `- **¿Qué has estudiado?** ${respuestas.formacion}`,
    `- **Experiencia:** ${respuestas.experiencia}`,
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");

  // Lo lento (resumen IA + email) va después de responder.
  after(async () => {
    let resumen = null;
    try {
      resumen = await summarizeCv({ pdfBase64: buffer.toString("base64"), position });
    } catch (err) {
      console.error("CV summary falló:", err);
    }
    const aiSummary = resumen ? `${cabecera}\n${resumen}` : cabecera;

    let emailSent = false;
    try {
      const r = await sendCandidateSummaryEmail({
        candidateId: candidate.id,
        position,
        country,
        education,
        cvBlobUrl,
        aiSummary,
      });
      emailSent = !!r.success;
    } catch (err) {
      console.error("Email a RRHH falló:", err);
    }

    try {
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: { aiSummary, emailSent },
      });
    } catch (err) {
      console.error("Update post-procesado falló:", err);
    }
  });

  return ok();
}
