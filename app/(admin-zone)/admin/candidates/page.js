import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { POSITION_LABEL, EDUCATION_LABEL } from "@/app/lib/candidateLabels";

export const dynamic = "force-dynamic";

function daysLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default async function CandidatesListPage() {
  const candidates = await prisma.candidate.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-gray-100 text-black p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-3xl font-black">CVs recibidos</h1>
        <Link href="/admin" className="text-sm font-bold underline">
          ← Volver al admin
        </Link>
      </div>

      {candidates.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-gray-200 text-center text-gray-500">
          No hay CVs activos ahora mismo.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {candidates.map((c) => (
            <Link
              key={c.id}
              href={`/admin/candidates/${c.id}`}
              className="flex items-center justify-between gap-4 p-5 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-black">
                  #{c.id} — {POSITION_LABEL[c.position] || c.position}
                </p>
                <p className="text-sm text-gray-500">
                  {c.country} · {EDUCATION_LABEL[c.education] || c.education} ·{" "}
                  {new Date(c.createdAt).toLocaleDateString("es-ES")}
                </p>
              </div>
              <div className="text-right text-xs">
                <span className="block font-bold text-red-600">
                  borra en {daysLeft(c.expiresAt)} d
                </span>
                <span className="text-gray-400">
                  {c.emailSent ? "email enviado" : "email pendiente"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
