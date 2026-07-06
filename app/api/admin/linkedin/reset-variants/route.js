import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { isAuthorizedAdmin } from "@/app/lib/auth";

export const maxDuration = 60;

// Reset de variantes de LinkedIn: vuelve a marcar sent=false (para que el
// próximo cron las reintente) las variantes que se dieron por enviadas pero
// realmente no se publicaron (p. ej. por la app deshabilitada).
//
// SEGURO POR DEFECTO: sin `confirm: true` solo hace dry-run y devuelve qué
// cambiaría, sin tocar nada. Filtra por ids explícitos o por rango de fechas
// de scheduledFor. Solo actúa sobre variantes con sent=true.
export async function POST(request) {
  if (!(await isAuthorizedAdmin(request))) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const confirm = body.confirm === true;

  const ids = Array.isArray(body.variantIds)
    ? body.variantIds.map(Number).filter((n) => Number.isInteger(n))
    : null;
  const since = body.since ? new Date(body.since) : null;
  const until = body.until ? new Date(body.until) : null;

  if (!ids?.length && !since && !until) {
    return NextResponse.json(
      { error: "Indica variantIds[] o un rango since/until" },
      { status: 400 },
    );
  }
  if ((since && isNaN(since.getTime())) || (until && isNaN(until.getTime()))) {
    return NextResponse.json(
      { error: "since/until no son fechas válidas (usa ISO)" },
      { status: 400 },
    );
  }

  // Solo tocamos las que figuran como enviadas: resetear una no-enviada no
  // aporta nada y evita sorpresas.
  const where = { sent: true };
  if (ids?.length) where.id = { in: ids };
  if (since || until) {
    where.scheduledFor = {};
    if (since) where.scheduledFor.gte = since;
    if (until) where.scheduledFor.lte = until;
  }

  const affected = await prisma.linkedInVariant.findMany({
    where,
    select: {
      id: true,
      postId: true,
      variant: true,
      angle: true,
      scheduledFor: true,
      sent: true,
      sentAt: true,
    },
    orderBy: { scheduledFor: "asc" },
  });

  if (!confirm) {
    return NextResponse.json({
      dryRun: true,
      message:
        "Dry-run: nada modificado. Revisa la lista y reenvía con { confirm: true } para aplicar.",
      count: affected.length,
      variants: affected,
    });
  }

  const result = await prisma.linkedInVariant.updateMany({
    where,
    data: { sent: false, sentAt: null },
  });

  return NextResponse.json({
    dryRun: false,
    message:
      "Variantes reseteadas a sent=false. Se reintentarán en la próxima ejecución del cron.",
    count: result.count,
    variants: affected,
  });
}
