"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/authOptions";
import { enrichPeople } from "@/app/lib/prospecting/apollo";
import { normalizeLinkedInProfileUrl } from "@/app/lib/prospecting/prospectFields";
import {
  DEFAULT_CAP,
  DEFAULT_RESET_DAY,
  buildCreditStatus,
  cycleStartFor,
} from "@/app/lib/prospecting/creditCycle";
import { ruleStats } from "@/app/lib/prospecting/rules";

// Defensa en profundidad: el proxy ya exige sesión bajo /admin, pero estas
// acciones escriben en base de datos y una de ellas gasta dinero.
async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("No autorizado");
}

const VALID_REASONS = ["role", "sector", "size", "in_house_team", "other"];

function cap() {
  return Number(process.env.APOLLO_MONTHLY_ENRICH_CAP) || DEFAULT_CAP;
}

function resetDay() {
  return Number(process.env.APOLLO_CYCLE_RESET_DAY) || DEFAULT_RESET_DAY;
}

// Créditos gastados en el ciclo vigente: filas con `enrichedAt` desde el último
// día de renovación. Se cuenta `enrichedAt` y no las filas, porque desde este
// rediseño la mayoría de filas no gastan crédito ninguno.
async function creditStatus(now = new Date()) {
  const spent = await prisma.prospectDiscovery.count({
    where: { enrichedAt: { gte: cycleStartFor(now, resetDay()) } },
  });
  return buildCreditStatus({ spent, cap: cap(), now, resetDay: resetDay() });
}

// Lo que pinta la pantalla de un tirón: la cola, el contador y el panel de
// aprendizaje. Una sola acción para no encadenar tres viajes desde el cliente.
//
// Sin `requireSession`, a propósito y a diferencia de las de abajo: es una
// lectura, no escribe nada ni gasta un céntimo. El mismo criterio que ya
// tenía `listProspects` en la versión anterior de este fichero. La defensa en
// profundidad de las demás acciones existe porque un fallo del proxy delante
// de /admin costaría dinero o corrompería datos; aquí, en el peor de los
// casos, se filtra la cola de candidatos, que ya vive detrás del proxy.
export async function loadQueue() {
  try {
    const [queue, decisiones, credits, validados] = await Promise.all([
      prisma.prospectDiscovery.findMany({
        where: { decision: "pending" },
        orderBy: [{ shownOn: "asc" }, { id: "asc" }],
        take: 20,
      }),
      prisma.prospectDiscovery.findMany({
        where: { decision: { in: ["yes", "no"] } },
        select: {
          decision: true,
          reasonCode: true,
          note: true,
          title: true,
          company: true,
          sectorQuery: true,
          sizeQuery: true,
          decidedAt: true,
        },
        orderBy: { decidedAt: "desc" },
      }),
      creditStatus(),
      prisma.prospect.count({ where: { status: "ACTIVE" } }),
    ]);

    return {
      success: true,
      queue,
      credits,
      stats: ruleStats(decisiones),
      notes: decisiones
        .filter((d) => d.note)
        .slice(0, 30)
        .map((d) => ({ note: d.note, company: d.company, decidedAt: d.decidedAt })),
      validados,
    };
  } catch (err) {
    console.error("[prospects] cargar la cola falló:", err);
    return { success: false, error: err.message };
  }
}

// Un "no" no gasta nada. El motivo es obligatorio: es lo único que alimenta las
// reglas, y un descarte sin motivo es una decisión que el sistema no puede
// aprender.
export async function rejectCandidate({ id, reasonCode, note }) {
  await requireSession();

  if (!VALID_REASONS.includes(reasonCode)) {
    return { success: false, error: "Motivo no válido" };
  }

  try {
    await prisma.prospectDiscovery.update({
      where: { id: Number(id) },
      data: {
        decision: "no",
        reasonCode,
        note: (note || "").trim() || null,
        decidedAt: new Date(),
      },
    });
    revalidatePath("/admin/prospects");
    return { success: true };
  } catch (err) {
    console.error("[prospects] rechazar falló:", err);
    return { success: false, error: err.message };
  }
}

// Un "sí" SÍ gasta: un crédito de Apollo, ahora mismo. Todo lo de esta función
// está ordenado alrededor de eso.
//
// EL AGUJERO DE CONTABILIDAD (y por qué esta función tiene la forma que tiene):
//
// Apollo factura, según su propia documentación, "solo cuando devuelve datos
// que califican". Eso separa con nitidez tres desenlaces de `enrichPeople`:
//
//   1. Lanza una excepción (red caída, 500 de Apollo, clave inválida): la
//      llamada nunca completó con una respuesta útil, así que lo más probable
//      es que Apollo no haya cobrado nada. No se toca `enrichedAt`: la fila
//      sigue "pending" y se puede reintentar sin miedo a pagar dos veces.
//
//   2. Devuelve `matches: []`: la llamada SÍ completó, pero Apollo no
//      encontró ningún registro que calificara para ese apolloId. Sin datos
//      que devolver, según su propia política, no hay cobro. Tratar esto igual
//      que el caso 3 (como hacía un borrador anterior de esta función) cobraba
//      de más a candidatos que Apollo nunca llegó a facturar.
//
//   3. Devuelve un match, pero sin `linkedin_url` utilizable: aquí Apollo SÍ
//      entregó un registro —hay datos que calificaron— así que según su
//      política SÍ cobra, siga o no siendo útil para nosotros. La prueba de
//      que esto cuesta dinero de verdad está en prospectFields.js: una
//      validación demasiado estricta ahí rechazó URLs perfectamente válidas y
//      costó 26 créditos reales sin guardar ni una. El crédito se gasta al
//      recibir el dato, no al validarlo.
//
// El segundo problema, más sutil, es CUÁNDO se escribe `enrichedAt` en base de
// datos. El crédito se gasta en el instante en que Apollo responde con un
// match (caso 3), no en el instante en que terminamos de crear el `Prospect`.
// Si esa segunda parte falla (un `P2002` por carrera, un corte con la BD) y
// `enrichedAt` solo se escribiera al final junto con el resto, el gasto real
// en Apollo desaparecería de nuestra contabilidad: la fila quedaría "pending"
// sin `enrichedAt`, el contador de gastados la ignoraría, y "remaining"
// mentiría por encima de lo que queda de verdad. Por eso el match con URL
// utilizable se banca (se escribe `enrichedAt` + `linkedinUrl`) ANTES de tocar
// la tabla `Prospect`, en su propio update: pase lo que pase después, el
// contador ya sabe que esto costó un crédito. Y si el proceso muere justo ahí,
// la próxima llamada para el mismo id detecta `enrichedAt` ya puesto y
// reanuda sin volver a llamar a Apollo (que sí sería un cobro duplicado real).
//
// El principio detrás de las tres decisiones es siempre el mismo: el contador
// nunca debe decir que queda más crédito del que queda de verdad.
export async function acceptCandidate({ id, note }) {
  await requireSession();

  try {
    const candidato = await prisma.prospectDiscovery.findUnique({
      where: { id: Number(id) },
    });
    if (!candidato) return { success: false, error: "Candidato no encontrado" };
    if (candidato.decision !== "pending") {
      return { success: false, error: "Ese candidato ya estaba decidido" };
    }

    let linkedinUrl = candidato.linkedinUrl;
    let enrichedAt = candidato.enrichedAt;
    // Por defecto, lo que ya sabíamos por la búsqueda (caso de reanudación,
    // donde Apollo ya no está disponible). El intento en fresco los mejora
    // con lo que devuelva el enriquecimiento, que es más fiable.
    let prospectName = candidato.name;
    let prospectCompany = candidato.company;
    let prospectRole = candidato.title;

    // `enrichedAt` ya puesto con la decisión todavía "pending" solo puede
    // significar una cosa: un intento anterior ya pagó el crédito a Apollo y
    // se cayó antes de terminar de crear el `Prospect`. Se reanuda con la URL
    // ya guardada; NO se vuelve a llamar a Apollo, o el segundo cobro sería
    // real y esta vez sí nuestro.
    if (!enrichedAt) {
      // Se comprueba el presupuesto ANTES de llamar a Apollo, no después:
      // llamar y luego descubrir que no había crédito lo gasta igual.
      const credits = await creditStatus();
      if (credits.exhausted) {
        return {
          success: false,
          error: `Sin créditos: ${credits.spent} de ${credits.cap} gastados en este ciclo. Renuevan en ${credits.daysToReset} días.`,
        };
      }

      let matches;
      try {
        ({ matches } = await enrichPeople([candidato.apolloId]));
      } catch (err) {
        // Caso 1: sin respuesta útil, probablemente sin cobro. No se escribe
        // nada; la fila sigue "pending" y reintentable.
        console.error("[prospects] Apollo no respondió al enriquecer:", err);
        return {
          success: false,
          error: `Apollo no respondió (${err.message}). No se ha registrado gasto de crédito: puedes reintentarlo.`,
        };
      }

      const match = matches[0];
      if (!match) {
        // Caso 2: respuesta correcta, pero sin datos que calificaran. Según
        // la política de Apollo, sin datos no hay cobro: no se escribe nada.
        return {
          success: false,
          error:
            "Apollo no encontró datos para este candidato. Según su política de cobro no se ha gastado crédito; puedes reintentarlo más tarde o descartarlo.",
        };
      }

      // Caso 3: hay match. Apollo entregó un registro que calificó, así que
      // el crédito ya está gastado exista o no una URL de LinkedIn usable
      // dentro. Se marca `enrichedAt` pase lo que pase a partir de aquí.
      enrichedAt = new Date();
      linkedinUrl = normalizeLinkedInProfileUrl(match.linkedin_url);
      prospectName = match.name || candidato.name || "(sin nombre)";
      prospectCompany = match.organization?.name ?? candidato.company;
      prospectRole = match.title || candidato.title;

      if (!linkedinUrl) {
        // Todo en un único update: decisión y gasto quedan grabados juntos y
        // atómicos, sin ventana en la que el crédito conste gastado pero la
        // fila siga "pending" esperando un segundo intento que no hace falta.
        await prisma.prospectDiscovery.update({
          where: { id: candidato.id },
          data: {
            decision: "no",
            reasonCode: "other",
            note: "Apollo no devolvió una URL de LinkedIn utilizable",
            decidedAt: enrichedAt,
            enrichedAt,
          },
        });
        revalidatePath("/admin/prospects");
        return {
          success: false,
          error: "Apollo no devolvió URL de LinkedIn. El crédito se ha gastado igual.",
        };
      }

      // Se banca el crédito ya, antes de tocar `Prospect`: si lo de abajo
      // falla, el contador no debe olvidar que esto ya ha costado.
      await prisma.prospectDiscovery.update({
        where: { id: candidato.id },
        data: { enrichedAt, linkedinUrl },
      });
    }

    const duplicado = await prisma.prospect.findUnique({ where: { linkedinUrl } });

    if (!duplicado) {
      await prisma.prospect.create({
        data: {
          name: prospectName || "(sin nombre)",
          company: prospectCompany,
          role: prospectRole,
          linkedinUrl,
          sector: candidato.sectorQuery,
          notes: (note || "").trim() || null,
          status: "ACTIVE",
          source: "apollo",
          apolloId: candidato.apolloId,
        },
      });
    }

    await prisma.prospectDiscovery.update({
      where: { id: candidato.id },
      data: {
        decision: "yes",
        note: (note || "").trim() || null,
        decidedAt: enrichedAt,
        imported: !duplicado,
      },
    });

    revalidatePath("/admin/prospects");
    return { success: true, linkedinUrl, duplicado: Boolean(duplicado) };
  } catch (err) {
    console.error("[prospects] aceptar falló:", err);
    return { success: false, error: err.message };
  }
}

// La lista de validados: el resultado del sistema.
export async function listProspects() {
  try {
    const prospects = await prisma.prospect.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return { success: true, prospects };
  } catch (err) {
    console.error("[prospects] listar falló:", err);
    return { success: false, error: err.message };
  }
}

export async function setProspectStatus(id, status) {
  await requireSession();
  if (!["ACTIVE", "CLIENT", "DISCARDED"].includes(status)) {
    return { success: false, error: "Estado no válido" };
  }
  try {
    await prisma.prospect.update({ where: { id: Number(id) }, data: { status } });
    revalidatePath("/admin/prospects");
    return { success: true };
  } catch (err) {
    console.error("[prospects] cambiar estado falló:", err);
    return { success: false, error: err.message };
  }
}
