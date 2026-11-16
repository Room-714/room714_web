import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { limiteConservacion } from "@/app/lib/leads/conservacion";

// Borra los contactos (tabla Lead) de las direcciones de email cuyo último
// mensaje tiene más de dos años, como dice la política de privacidad. Se
// borran todas las filas de esa dirección a la vez: si alguien volvió a
// escribir hace poco, se conservan también sus mensajes anteriores hasta que
// el último caduque.

export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const limite = limiteConservacion();

  try {
    const caducados = await prisma.lead.groupBy({
      by: ["email"],
      _max: { createdAt: true },
      having: { createdAt: { _max: { lt: limite } } },
    });
    const emails = caducados.map((c) => c.email);

    if (emails.length === 0) {
      return NextResponse.json({ message: "No hay contactos caducados", deleted: 0 });
    }

    const { count } = await prisma.lead.deleteMany({ where: { email: { in: emails } } });
    return NextResponse.json({
      message: `Limpieza completada: ${emails.length} direcciones caducadas`,
      deleted: count,
    });
  } catch (err) {
    console.error("cleanup-leads falló:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
