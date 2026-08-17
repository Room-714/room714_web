import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { searchPeople, enrichPeople } from "@/app/lib/prospecting/apollo";
import {
  BUYER_PROFILE,
  buildApolloQuery,
  roleGroupFor,
  weekIndexFor,
} from "@/app/data/ProspectingProfile";
import {
  interestFor,
  keywordsFor,
  normalizeLinkedInProfileUrl,
} from "@/app/lib/prospecting/prospectFields";

export const maxDuration = 60;

// Cupo de la lista: el briefing solo consume dos prospectos al día, así que
// una lista mayor no se llega a trabajar y solo acumula datos personales.
const MAX_ACTIVE_PROSPECTS = 40;

// Tope por ejecución. Cada persona enriquecida = 1 crédito.
const MAX_ENRICH_PER_RUN = Number(process.env.APOLLO_MAX_ENRICH_PER_RUN) || 10;

// Guarda de presupuesto mensual. La cuenta es de plan gratuito (75 créditos) y
// el ciclo de facturación renueva el día 16, no el 1: por eso se cuenta una
// ventana móvil de 30 días y no el mes natural. El margen hasta 75 deja aire
// para pruebas manuales.
const MONTHLY_ENRICH_CAP =
  Number(process.env.APOLLO_MONTHLY_ENRICH_CAP) || 60;

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Cuántas páginas de resultados recorrer como máximo buscando caras nuevas.
// Con 25 por página son hasta 125 personas revisadas por ejecución, y buscar
// no cuesta créditos.
const MAX_SEARCH_PAGES = 5;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  // Preview: enseña a quién encontraría y qué haría, sin enriquecer (o sea,
  // sin gastar un solo crédito) y sin escribir en base de datos. Es la única
  // forma de probar esto sin coste.
  const params = new URL(request.url).searchParams;
  const preview = params.get("preview") === "1";

  // `?limit=N` baja el tope de esta ejecución (nunca lo sube). Sirve para
  // validar un cambio gastando 2 créditos en vez de 10.
  const requestedLimit = Number(params.get("limit"));
  const runLimit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_ENRICH_PER_RUN)
      : MAX_ENRICH_PER_RUN;

  try {
    // Solo compradores: Apollo no descubre referencias (no sabe filtrar por
    // actividad de publicación), asi que las referencias no consumen este cupo.
    const activeCount = await prisma.prospect.count({
      where: { status: "ACTIVE", kind: "buyer" },
    });

    if (activeCount >= MAX_ACTIVE_PROSPECTS) {
      return NextResponse.json({
        skipped: true,
        reason: `Ya hay ${activeCount} prospectos ACTIVE (tope ${MAX_ACTIVE_PROSPECTS})`,
        activeCount,
      });
    }

    // Guarda de presupuesto: créditos gastados en los últimos 30 días.
    const spentLast30Days = await prisma.prospectDiscovery.count({
      where: { createdAt: { gte: new Date(Date.now() - THIRTY_DAYS_MS) } },
    });
    const budgetLeft = Math.max(0, MONTHLY_ENRICH_CAP - spentLast30Days);
    const wanted = Math.min(runLimit, budgetLeft);

    // 1 y 2. Buscar y descartar conocidos, avanzando páginas hasta reunir
    // suficientes caras nuevas.
    //
    // Paginar es imprescindible: la búsqueda es determinista, así que pedir
    // siempre la página 1 devuelve las mismas 25 personas. En cuanto quedan
    // registradas, no vuelve a aparecer nadie nuevo y el cron semanal deja de
    // encontrar prospectos para siempre. Buscar es gratis, así que recorrer
    // varias páginas no cuesta nada.
    // La rotacion de cargos evita que la lista se llene de un solo perfil.
    const weekIndex = weekIndexFor(new Date());
    const roleGroup = roleGroupFor(BUYER_PROFILE, weekIndex);

    const fresh = [];
    let searched = 0;
    let pagesUsed = 0;
    let totalEntries = null;
    let lastQuery = null;

    for (let page = 1; page <= MAX_SEARCH_PAGES && fresh.length < wanted; page++) {
      lastQuery = buildApolloQuery(BUYER_PROFILE, { page, weekIndex });
      const result = await searchPeople(lastQuery);
      pagesUsed = page;
      searched += result.people.length;
      totalEntries = result.totalEntries ?? totalEntries;
      if (result.people.length === 0) break;

      const ids = result.people.map((p) => p.id).filter(Boolean);
      const [seenDiscoveries, seenProspects] = await Promise.all([
        prisma.prospectDiscovery.findMany({
          where: { apolloId: { in: ids } },
          select: { apolloId: true },
        }),
        prisma.prospect.findMany({
          where: { apolloId: { in: ids } },
          select: { apolloId: true },
        }),
      ]);
      const known = new Set([
        ...seenDiscoveries.map((d) => d.apolloId),
        ...seenProspects.map((p) => p.apolloId),
      ]);
      fresh.push(...result.people.filter((p) => p.id && !known.has(p.id)));
    }

    const candidates = fresh.slice(0, wanted);

    const summary = {
      activeCount,
      roleGroup: roleGroup?.name ?? "todos los cargos",
      searched,
      pagesUsed,
      totalEntries,
      alreadyKnown: searched - fresh.length,
      spentLast30Days,
      budgetLeft,
      wouldEnrich: candidates.length,
    };

    if (budgetLeft === 0) {
      return NextResponse.json({
        ...summary,
        skipped: true,
        reason: `presupuesto mensual: ${spentLast30Days} créditos en los últimos 30 días (tope ${MONTHLY_ENRICH_CAP})`,
      });
    }

    if (preview) {
      return NextResponse.json({
        ...summary,
        mode: "preview",
        message: "Preview: nada enriquecido, ningún crédito gastado",
        query: lastQuery,
        sample: candidates.slice(0, 10).map((p) => ({
          apolloId: p.id,
          name: [p.first_name, p.last_name_obfuscated].filter(Boolean).join(" "),
          title: p.title,
          company: p.organization?.name ?? null,
        })),
      });
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        ...summary,
        skipped: true,
        reason: "La búsqueda no devolvió nadie nuevo",
      });
    }

    // 4. Enriquecer: aquí es donde se gastan los créditos.
    const { matches } = await enrichPeople(candidates.map((p) => p.id));

    // 5. Dejar rastro de todos y dar de alta a los utilizables.
    const imported = [];
    const discarded = [];

    for (const match of matches) {
      const apolloId = match.id;
      if (!apolloId) continue;

      const rawUrl = match.linkedin_url || null;
      const linkedinUrl = normalizeLinkedInProfileUrl(rawUrl);
      const usable = Boolean(linkedinUrl);
      const company = match.organization?.name ?? null;

      // ¿Existe ya con esa URL? El @unique de linkedinUrl lo impediría.
      const duplicate = usable
        ? await prisma.prospect.findUnique({ where: { linkedinUrl } })
        : null;

      if (usable && !duplicate) {
        await prisma.prospect.create({
          data: {
            name: match.name || "(sin nombre)",
            company,
            role: match.title || null,
            linkedinUrl,
            sector: match.organization?.industry ?? null,
            interest: interestFor(match.title),
            keywords: keywordsFor(match.title, company),
            status: "ACTIVE",
            source: "apollo",
            kind: "buyer",
            apolloId,
          },
        });
        imported.push({ apolloId, name: match.name, company });
      } else {
        discarded.push({
          apolloId,
          name: match.name || null,
          // Se incluye la URL cruda: si un día vuelve a fallar, el motivo se
          // ve en la respuesta y no hay que gastar créditos para averiguarlo.
          rawUrl,
          reason: !rawUrl
            ? "Apollo no devolvió URL de LinkedIn"
            : !usable
              ? `URL no reconocida: ${rawUrl}`
              : "ya existe un prospecto con esa URL",
        });
      }

      await prisma.prospectDiscovery.upsert({
        where: { apolloId },
        update: {
          imported: usable && !duplicate,
          // Guardamos la cruda si la normalizada no sirve, para diagnóstico.
          linkedinUrl: linkedinUrl || rawUrl || null,
        },
        create: {
          apolloId,
          name: match.name || null,
          title: match.title || null,
          company,
          linkedinUrl: linkedinUrl || rawUrl || null,
          imported: usable && !duplicate,
        },
      });
    }

    return NextResponse.json({
      ...summary,
      enriched: matches.length,
      creditsSpent: matches.length,
      imported: imported.length,
      discarded: discarded.length,
      importedDetail: imported,
      discardedDetail: discarded,
    });
  } catch (err) {
    console.error("❌ Error en cron discover-prospects:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
