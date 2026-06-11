"use server";

import { del } from "@vercel/blob";
import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Borrado manual de un candidato: replica la lógica del cron
// (cleanup-candidates) para uno solo. La ruta del action vive bajo /admin,
// así que el proxy ya exige sesión antes de invocarla.
export async function deleteCandidate(id) {
  const candidateId = Number(id);
  if (!Number.isInteger(candidateId)) {
    redirect("/admin/candidates");
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { cvBlobUrl: true },
  });

  if (candidate) {
    try {
      await del(candidate.cvBlobUrl);
    } catch (err) {
      // Igual que el cron: si el blob falla, seguimos borrando la fila
      // para no dejar registros huérfanos.
      console.error(`Borrar blob ${candidate.cvBlobUrl} falló:`, err.message);
    }
    await prisma.candidate.delete({ where: { id: candidateId } });
  }

  revalidatePath("/admin/candidates");
  redirect("/admin/candidates");
}
