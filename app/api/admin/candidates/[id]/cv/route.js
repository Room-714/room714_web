import { isAuthorizedAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const maxDuration = 60;

export async function GET(request, { params }) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const { id } = await params;
  // Solo IDs decimales positivos; Number("") o "0x10" colarían valores raros.
  if (!/^\d+$/.test(id)) {
    return new Response("No encontrado", { status: 404 });
  }
  const candidateId = Number(id);

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { cvBlobUrl: true },
  });
  if (!candidate || !candidate.cvBlobUrl) {
    return new Response("No encontrado", { status: 404 });
  }

  const blobRes = await fetch(candidate.cvBlobUrl);
  if (!blobRes.ok) {
    return new Response("CV no disponible", { status: 502 });
  }

  // Streameamos los bytes sin exponer nunca la URL del blob al navegador.
  // X-Frame-Options: SAMEORIGIN permite incrustarlo en el <iframe> del
  // detalle (el config global pone DENY, por eso esta ruta se excluye allí).
  return new Response(blobRes.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="cv.pdf"',
      "X-Frame-Options": "SAMEORIGIN",
      "Cache-Control": "private, no-store",
    },
  });
}
