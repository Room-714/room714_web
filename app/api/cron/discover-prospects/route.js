import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { searchPeople, enrichPeople } from "@/app/lib/prospecting/apollo";
import {
  IDEAL_CUSTOMER_PROFILE,
  buildApolloQuery,
} from "@/app/data/ProspectingProfile";

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

function isUsableLinkedInUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(String(url));
    return (
      parsed.protocol === "https:" &&
      /(^|\.)linkedin\.com$/.test(parsed.hostname)
    );
  } catch {
    return false;
  }
}

// El cargo y el sector que hicieron match alimentan al redactor de comentarios.
function interestFor(title) {
  const t = String(title || "").toLowerCase();
  if (/(ux|design|diseñ)/.test(t)) return "UX/UI y research";
  if (/(product|producto)/.test(t)) return "Product management";
  if (/(cto|engineer|tech|desarrollo)/.test(t)) return "Software development";
  if (/(digital|transformaci|innovaci)/.test(t)) return "Transformación digital";
  return "Producto digital y CX";
}

function keywordsFor(title, company) {
  const base = IDEAL_CUSTOMER_PROFILE.keywords.slice(0, 3);
  const extra = [];
  if (/(ux|design|diseñ)/i.test(title || "")) extra.push("UX");
  if (/(product|producto)/i.test(title || "")) extra.push("product management");
  if (company) extra.push(String(company));
  return [...new Set([...extra, ...base])].slice(0, 5);
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  // Preview: enseña a quién encontraría y qué haría, sin enriquecer (o sea,
  // sin gastar un solo crédito) y sin escribir en base de datos. Es la única
  // forma de probar esto sin coste.
  const preview = new URL(request.url).searchParams.get("preview") === "1";

  try {
    const activeCount = await prisma.prospect.count({
      where: { status: "ACTIVE" },
    });

    if (activeCount >= MAX_ACTIVE_PROSPECTS) {
      return NextResponse.json({
        skipped: true,
        reason: `Ya hay ${activeCount} prospectos ACTIVE (tope ${MAX_ACTIVE_PROSPECTS})`,
        activeCount,
      });
    }

    // 1. Búsqueda. Gratis: no consume créditos.
    const query = buildApolloQuery();
    const { people, totalEntries } = await searchPeople(query);

    // 2. Descartar a quien ya conocemos, por cualquiera de las dos vías.
    const ids = people.map((p) => p.id).filter(Boolean);
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
    const fresh = people.filter((p) => p.id && !known.has(p.id));

    // 3. Guarda de presupuesto: créditos gastados en los últimos 30 días.
    const spentLast30Days = await prisma.prospectDiscovery.count({
      where: { createdAt: { gte: new Date(Date.now() - THIRTY_DAYS_MS) } },
    });
    const budgetLeft = Math.max(0, MONTHLY_ENRICH_CAP - spentLast30Days);

    const candidates = fresh.slice(0, Math.min(MAX_ENRICH_PER_RUN, budgetLeft));

    const summary = {
      activeCount,
      searched: people.length,
      totalEntries,
      alreadyKnown: people.length - fresh.length,
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
        query,
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

      const linkedinUrl = match.linkedin_url || null;
      const usable = isUsableLinkedInUrl(linkedinUrl);
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
            apolloId,
          },
        });
        imported.push({ apolloId, name: match.name, company });
      } else {
        discarded.push({
          apolloId,
          name: match.name || null,
          reason: !linkedinUrl
            ? "sin URL de LinkedIn"
            : !usable
              ? "URL de LinkedIn no válida"
              : "ya existe un prospecto con esa URL",
        });
      }

      await prisma.prospectDiscovery.upsert({
        where: { apolloId },
        update: { imported: usable && !duplicate },
        create: {
          apolloId,
          name: match.name || null,
          title: match.title || null,
          company,
          linkedinUrl: usable ? linkedinUrl : null,
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
