import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { POSITION_LABEL, EDUCATION_LABEL } from "@/app/lib/candidateLabels";
import DeleteCandidateButton from "../DeleteCandidateButton";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({ params }) {
  const { id } = await params;

  const candidate = /^\d+$/.test(id)
    ? await prisma.candidate.findUnique({ where: { id: Number(id) } })
    : null;

  if (!candidate) {
    return (
      <main className="min-h-screen bg-gray-100 text-black p-8 max-w-3xl mx-auto">
        <Link href="/admin/candidates" className="text-sm font-bold underline">
          ← Volver al listado
        </Link>
        <div className="mt-8 bg-white rounded-3xl p-10 border border-gray-200 text-center">
          <h1 className="text-2xl font-black">Este CV ya no está disponible</h1>
          <p className="text-gray-500 mt-2">
            Pudo borrarse manualmente o por la política de retención de 30 días.
          </p>
        </div>
      </main>
    );
  }

  const positionLabel = POSITION_LABEL[candidate.position] || candidate.position;
  const educationLabel =
    EDUCATION_LABEL[candidate.education] || candidate.education;

  return (
    <main className="min-h-screen bg-gray-100 text-black p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Link href="/admin/candidates" className="text-sm font-bold underline">
          ← Volver al listado
        </Link>
        <DeleteCandidateButton candidateId={candidate.id} />
      </div>

      <div className="mt-6 bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm">
        <h1 className="text-3xl font-black mb-6">
          Candidato #{candidate.id} — {positionLabel}
        </h1>

        <table className="text-sm mb-8">
          <tbody>
            <tr>
              <td className="pr-6 py-1 text-gray-500">País</td>
              <td className="py-1 font-bold">{candidate.country}</td>
            </tr>
            <tr>
              <td className="pr-6 py-1 text-gray-500">Formación</td>
              <td className="py-1 font-bold">{educationLabel}</td>
            </tr>
            <tr>
              <td className="pr-6 py-1 text-gray-500">Recibido</td>
              <td className="py-1">
                {new Date(candidate.createdAt).toLocaleString("es-ES")}
              </td>
            </tr>
            <tr>
              <td className="pr-6 py-1 text-gray-500">Borrado automático</td>
              <td className="py-1">
                {new Date(candidate.expiresAt).toLocaleDateString("es-ES")}
              </td>
            </tr>
          </tbody>
        </table>

        <h2 className="text-xl font-black mb-2">Resumen ejecutivo (IA)</h2>
        <div className="bg-gray-50 rounded-2xl p-5 text-sm leading-relaxed whitespace-pre-wrap mb-8">
          {candidate.aiSummary || "No se pudo generar resumen automático."}
        </div>

        <h2 className="text-xl font-black mb-2">CV (PDF)</h2>
        <iframe
          src={`/api/admin/candidates/${candidate.id}/cv`}
          title={`CV del candidato ${candidate.id}`}
          className="w-full h-[80vh] rounded-2xl border border-gray-200"
        />
      </div>
    </main>
  );
}
