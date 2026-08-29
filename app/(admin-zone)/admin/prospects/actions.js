"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/authOptions";
import { enrichPeople, shouldRevertReservation } from "@/app/lib/prospecting/apollo";
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
// EL AGUJERO DE CONTABILIDAD QUE ESTO EVITA:
//
// El crédito se banca (se reserva la fila) ANTES de llamar a Apollo, no
// después de que responda. Es lo único que impide tres formas de infracontar
// —y solo infracontar es inaceptable; sobrecontar es el lado seguro—:
//
//   - Dos pestañas aceptando el mismo candidato a la vez: sin reserva atómica,
//     las dos pasarían la guarda, las dos llamarían a Apollo (2 créditos
//     reales) y las dos escribirían sobre la misma fila (el contador cuenta
//     filas con `enrichedAt`, así que registraría 1 de 2). Con la reserva
//     (`updateMany` con `decision: "pending", enrichedAt: null` en el WHERE),
//     solo una de las dos consigue reservar; la otra recibe `count === 0` y
//     se rechaza sin tocar Apollo.
//   - El proceso muere entre que Apollo cobra y que se escribe: si se
//     reservara después de la respuesta, ese gasto real desaparecería de la
//     contabilidad. Reservando antes, la fila ya cuenta como gastada desde
//     el instante en que se decide llamar, así que una caída a mitad no
//     pierde el gasto.
//   - Un timeout de red sin respuesta: no se sabe si Apollo procesó la
//     petición. Se asume que sí (se mantiene la reserva) en vez de asumir que
//     no: es el único sentido del error que no puede llevar a infracontar.
//
// Apollo factura, según su propia documentación, "solo cuando devuelve datos
// que califican". Eso separa tres desenlaces de `enrichPeople` una vez
// reservada la fila:
//
//   1. Lanza una excepción con `err.gotResponse` (hubo respuesta HTTP, 4xx o
//      5xx): Apollo rechazó la petición sin devolver datos que calificaran,
//      así que casi seguro no cobró. Se revierte la reserva.
//   2. Lanza una excepción SIN esa marca (falló el propio fetch: red caída,
//      timeout): no se sabe si Apollo procesó. Se asume que sí y NO se
//      revierte la reserva — el único caso ambiguo se resuelve del lado
//      seguro, y esta fila no se reintenta sola (ver más abajo).
//   3. Completa con `matches: []`: la llamada SÍ terminó, y Apollo no
//      encontró ningún registro que calificara. Sin datos que devolver, no
//      hay cobro: es el ÚNICO desenlace en el que se sabe con certeza que no
//      se ha gastado nada, así que es el único en el que se revierte la
//      reserva y la fila vuelve a "pending" para poder reintentarla.
//   4. Completa con un match, pero sin `linkedin_url` utilizable: Apollo SÍ
//      entregó un registro —hay datos que calificaron— así que según su
//      política SÍ cobra, sea o no útil para nosotros. La prueba de que esto
//      cuesta dinero de verdad está en prospectFields.js: una validación
//      demasiado estricta ahí rechazó URLs perfectamente válidas y costó 26
//      créditos reales sin guardar ni una. La reserva se queda.
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
    // Por defecto, lo que ya sabíamos por la búsqueda (caso de reanudación,
    // donde Apollo ya no está disponible). El intento en fresco los mejora
    // con lo que devuelva el enriquecimiento, que es más fiable.
    let prospectName = candidato.name;
    let prospectCompany = candidato.company;
    let prospectRole = candidato.title;

    if (candidato.enrichedAt) {
      // La fila ya está reservada con la decisión todavía "pending". Solo
      // puede pasar por dos motivos, y en ninguno de los dos se vuelve a
      // llamar a Apollo (un segundo cobro sí sería real y esta vez nuestro):
      //
      //   - Ya hay `linkedinUrl`: un intento anterior recibió el match y lo
      //     guardó, pero se cayó antes de crear el `Prospect`. Se reanuda con
      //     esos datos.
      //   - No hay `linkedinUrl`: la reserva se hizo pero el desenlace de
      //     Apollo quedó sin resolver (el caso 2 de arriba: fetch ambiguo). No
      //     se sabe si cobró; tampoco se reintenta solo. Queda a la espera de
      //     revisión manual.
      if (!linkedinUrl) {
        return {
          success: false,
          error:
            "Este candidato quedó reservado en un intento anterior sin respuesta clara de Apollo (puede haber cobrado). No se reintenta automáticamente para no arriesgar un cobro duplicado.",
        };
      }
    } else {
      // Se comprueba el presupuesto ANTES de llamar a Apollo, no después:
      // llamar y luego descubrir que no había crédito lo gasta igual.
      const credits = await creditStatus();
      if (credits.exhausted) {
        return {
          success: false,
          error: `Sin créditos: ${credits.spent} de ${credits.cap} gastados en este ciclo. Renuevan en ${credits.daysToReset} días.`,
        };
      }

      // Se reclama la fila ANTES de llamar a Apollo, no después. Es lo único
      // que impide que dos pestañas acepten al mismo candidato, cobren dos
      // créditos y registren uno: el contador cuenta filas con `enrichedAt`,
      // así que dos escrituras sobre la misma fila valen por una sola.
      //
      // Reservar antes también significa que una caída entre el cobro y la
      // escritura ya no pierde el gasto. El sesgo del sistema pasa a ser
      // sobrecontar, que es el lado seguro: gastar de menos se corrige solo,
      // y creerse con crédito que no se tiene, no.
      const reservado = await prisma.prospectDiscovery.updateMany({
        where: { id: Number(id), decision: "pending", enrichedAt: null },
        data: { enrichedAt: new Date() },
      });

      if (reservado.count === 0) {
        return {
          success: false,
          error: "Ese candidato ya estaba decidido o lo está procesando otra pestaña",
        };
      }

      let matches;
      try {
        ({ matches } = await enrichPeople([candidato.apolloId]));
      } catch (err) {
        if (shouldRevertReservation(err)) {
          // Hubo respuesta HTTP: Apollo rechazó la petición, no cobró.
          await prisma.prospectDiscovery.updateMany({
            where: { id: candidato.id, decision: "pending" },
            data: { enrichedAt: null },
          });
          console.error("[prospects] Apollo rechazó el enriquecimiento:", err);
          return {
            success: false,
            error: `Apollo rechazó la petición (${err.message}). No se ha gastado crédito: puedes reintentarlo.`,
          };
        }
        // Fallo del propio fetch: no se sabe si Apollo procesó. Se asume que
        // sí y se mantiene la reserva; esta fila no se reintenta sola (ver la
        // rama de reanudación de arriba).
        console.error(
          "[prospects] Apollo no respondió al enriquecer (no se sabe si cobró):",
          err,
        );
        return {
          success: false,
          error: `Apollo no respondió (${err.message}). No se sabe si ha gastado crédito, así que se mantiene reservado: no se reintentará automáticamente.`,
        };
      }

      const match = matches[0];
      if (!match) {
        // Único desenlace en el que se sabe con certeza que no hubo cobro:
        // la llamada completó y Apollo no encontró datos que calificaran. Se
        // revierte la reserva y la fila vuelve a "pending", reintentable.
        await prisma.prospectDiscovery.updateMany({
          where: { id: candidato.id, decision: "pending" },
          data: { enrichedAt: null },
        });
        return {
          success: false,
          error:
            "Apollo no encontró datos para este candidato. Según su política de cobro no se ha gastado crédito; puedes reintentarlo más tarde o descartarlo.",
        };
      }

      // Hay match: Apollo entregó un registro que calificó, así que el
      // crédito ya está gastado exista o no una URL de LinkedIn usable
      // dentro. La reserva se queda tal cual (ya tiene `enrichedAt`).
      linkedinUrl = normalizeLinkedInProfileUrl(match.linkedin_url);
      prospectName = match.name || candidato.name || "(sin nombre)";
      prospectCompany = match.organization?.name ?? candidato.company;
      prospectRole = match.title || candidato.title;

      if (!linkedinUrl) {
        await prisma.prospectDiscovery.update({
          where: { id: candidato.id },
          data: {
            decision: "no",
            reasonCode: "other",
            note: "Apollo no devolvió una URL de LinkedIn utilizable",
            decidedAt: new Date(),
          },
        });
        revalidatePath("/admin/prospects");
        return {
          success: false,
          error: "Apollo no devolvió URL de LinkedIn. El crédito se ha gastado igual.",
        };
      }

      await prisma.prospectDiscovery.update({
        where: { id: candidato.id },
        data: { linkedinUrl },
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
        // `new Date()`, no `enrichedAt`: con la reserva previa, `enrichedAt`
        // es ahora el momento en que se reservó el crédito, no el momento en
        // que se decide. Son instantes distintos desde este arreglo.
        decidedAt: new Date(),
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
