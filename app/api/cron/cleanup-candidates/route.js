import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/app/lib/prisma";

export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const now = new Date();

  try {
    const expired = await prisma.candidate.findMany({
      where: { expiresAt: { lte: now } },
      select: { id: true, cvBlobUrl: true },
    });

    if (expired.length === 0) {
      return NextResponse.json({
        message: "No hay candidatos expirados",
        deleted: 0,
      });
    }

    const results = { blobDeleted: 0, blobFailed: 0, rowsDeleted: 0 };

    for (const c of expired) {
      try {
        await del(c.cvBlobUrl);
        results.blobDeleted++;
      } catch (err) {
        console.error(`Borrar blob ${c.cvBlobUrl} falló:`, err.message);
        results.blobFailed++;
      }
    }

    const deleteResult = await prisma.candidate.deleteMany({
      where: { id: { in: expired.map((c) => c.id) } },
    });
    results.rowsDeleted = deleteResult.count;

    return NextResponse.json({
      message: `Limpieza completada: ${expired.length} candidatos expirados procesados`,
      ...results,
    });
  } catch (err) {
    console.error("cleanup-candidates falló:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
