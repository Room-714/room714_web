import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { searchPeople } from "@/app/lib/prospecting/apollo";
import {
  BUYER_PROFILE,
  buildApolloQuery,
  comboForDay,
  dayIndexFor,
  effectiveSizes,
  emptiedDimensions,
} from "@/app/data/ProspectingProfile";
import {
  collectFreshCandidates,
  startPageFor,
  QUEUE_SIZE,
} from "@/app/lib/prospecting/buildQueue";
import { deriveRules } from "@/app/lib/prospecting/rules";
import { isMadridHour } from "@/app/lib/time/madrid";

export const maxDuration = 60;

// 06:00, a la vez que la generación del artículo: la cola tiene que estar lista
// antes de que nadie se siente, y buscar en Apollo es rápido porque no enriquece.
const TARGET_HOUR = 6;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  // Preview: enseña a quién pondría en la cola sin escribir nada. Como buscar es
  // gratis, este modo no cuesta absolutamente nada y es la forma de validar un
  // cambio de criterio antes de vivir con él una mañana entera.
  const preview = new URL(request.url).searchParams.get("preview") === "1";

  if (!preview && !isMadridHour(TARGET_HOUR)) {
    return NextResponse.json({
      message: "Saltado: no es la hora correcta en Madrid",
      targetHour: `${TARGET_HOUR}:00 Madrid`,
    });
  }

  try {
    // Si la cola de ayer sigue sin revisar, no se acumula encima. Una cola que
    // crece es una cola que se abandona.
    //
    // Este corte NO se aplica en preview (`!preview &&`): antes se comprobaba
    // antes que nada, así que en cuanto la cola estaba llena — que es
    // justamente cuando más se quiere inspeccionar qué traería mañana —
    // `?preview=1` devolvía `skipped` sin ni siquiera buscar. El preview no
    // escribe nada, así que dejarlo pasar no acumula ni un riesgo.
    const pendientes = await prisma.prospectDiscovery.count({
      where: { decision: "pending" },
    });
    if (!preview && pendientes >= QUEUE_SIZE) {
      return NextResponse.json({
        skipped: true,
        reason: `Ya hay ${pendientes} candidatos pendientes de revisar`,
        pendientes,
      });
    }

    // Las reglas salen de contar las decisiones. Se traen solo los campos que
    // deriveRules mira, que además evita arrastrar notas largas.
    const decisiones = await prisma.prospectDiscovery.findMany({
      where: { decision: { in: ["yes", "no"] } },
      select: {
        decision: true,
        reasonCode: true,
        title: true,
        sectorQuery: true,
        sizeQuery: true,
      },
    });
    const rules = deriveRules(decisiones);

    const combo = comboForDay(BUYER_PROFILE, dayIndexFor(new Date()));
    const query = buildApolloQuery(BUYER_PROFILE, { combo, rules });

    // Qué tramo se busca DE VERDAD con las reglas de hoy — no necesariamente
    // el de `combo`, que es solo una PROPUESTA y puede haberse ensanchado si
    // las reglas lo excluyeron (ver effectiveSizes en ProspectingProfile.js).
    // Etiquetar a los candidatos con `combo.size` a pelo, como se hacía
    // antes, podía guardar un tramo que no se había buscado: con dos tramos
    // eso pasa 7 de cada 14 días, y esa etiqueta falsa realimenta las
    // reglas (un "sí" levantaría la exclusión de un tramo que nadie buscó).
    // Si `effectiveSizes` ensancha a varios tramos, no sabemos en cuál cae
    // cada candidato — Apollo no devuelve la plantilla real —, así que se
    // guarda null en vez de mentir con el que proponía la combinación.
    const tramosBuscados = effectiveSizes(combo, rules);
    let sizeQuery = tramosBuscados.length === 1 ? tramosBuscados[0] : null;

    // Todo el historial: son unas decenas de filas y evita volver a enseñar a
    // alguien que ya se descartó hace meses.
    const conocidos = await prisma.prospectDiscovery.findMany({
      select: { apolloId: true },
    });
    const knownIds = new Set(conocidos.map((c) => c.apolloId));

    // Por qué página empezar: se deduce de cuánta gente hemos visto ya de ESTA
    // combinación. Sin esto, cuando una combinación acumula 125 caras vistas las
    // cinco páginas del recorrido son todas conocidas y deja de dar a nadie.
    // Se consulta por `sizeQuery`, el mismo valor con el que se va a etiquetar
    // más abajo: si los dos no coincidieran, este conteo (y por tanto
    // `startPage`) estaría mirando un grupo distinto del que de verdad se
    // está rellenando hoy.
    const vistosEnCombo = await prisma.prospectDiscovery.count({
      where: { sectorQuery: combo?.sector ?? null, sizeQuery },
    });

    // En preview, `wanted` NO se ata a los pendientes de hoy: el caso que
    // motiva el arreglo de arriba es justo la cola ya llena, y con
    // `QUEUE_SIZE - pendientes` eso habría dado un número negativo o cero —
    // `collectFreshCandidates` ni siquiera habría intentado buscar, así que
    // se vería la consulta construida pero ningún candidato de muestra. Lo
    // que se quiere ver en preview es qué traería una ejecución fresca, no
    // cuántos huecos quedan en la cola de hoy.
    const wanted = preview ? QUEUE_SIZE : QUEUE_SIZE - pendientes;
    const startPage = startPageFor(vistosEnCombo);

    const primerIntento = await collectFreshCandidates({
      search: searchPeople,
      query,
      wanted,
      rules,
      knownIds,
      startPage,
    });

    // Segundo intento sin reglas cuando la cola sale vacía. Es el suelo del
    // sistema, y hace falta: las reglas solo restan cargos y tramos, nunca los
    // devuelven, así que una cola vacía puede significar tanto "este sector se
    // agotó" como "el filtro se ha cerrado demasiado". Sin este intento las dos
    // cosas se ven igual, y la segunda no se corrige sola: sin candidatos no hay
    // decisiones nuevas, y sin decisiones nuevas ninguna regla afloja jamás.
    let resultado = primerIntento;
    let sinReglas = false;
    if (primerIntento.candidates.length === 0) {
      resultado = await collectFreshCandidates({
        search: searchPeople,
        query: buildApolloQuery(BUYER_PROFILE, { combo }),
        wanted,
        rules: {},
        knownIds,
        startPage,
      });
      sinReglas = resultado.candidates.length > 0;
      // El segundo intento busca SIN reglas, así que el tramo real buscado
      // también puede cambiar (una exclusión que antes ensanchaba la
      // consulta ya no aplica): se recalcula con las mismas reglas — ninguna
      // — que se acaban de usar, para no etiquetar con un tramo que en este
      // intento no se ha buscado.
      if (sinReglas) {
        const tramosSinReglas = effectiveSizes(combo, {});
        sizeQuery = tramosSinReglas.length === 1 ? tramosSinReglas[0] : null;
      }
    }

    const resumen = {
      combo,
      pendientesPrevios: pendientes,
      wanted,
      searched: resultado.searched,
      lastPageFetched: resultado.lastPageFetched,
      pagesFetched: resultado.pagesFetched,
      totalEntries: resultado.totalEntries,
      encontrados: resultado.candidates.length,
      descartados: resultado.dropped.length,
      exhausted: resultado.exhausted,
      // Si esto sale a true, el filtro estaba cerrado de más y la cola de hoy
      // se llenó saltándoselo. Es la señal de que hay que mirar el panel de
      // aprendizaje: alguna regla está de más.
      sinReglas,
      reglasActivas: {
        cargosExcluidos: rules.excludedTitles,
        tramosExcluidos: rules.excludedSizes,
      },
      // Si esto no sale vacío, alguna de esas exclusiones vaciaba una
      // dimensión ENTERA (todos los cargos o los dos tramos) y se ha tenido
      // que ignorar por completo: un array vacío en Apollo no es "sin
      // candidatos", es "sin filtro", así que una regla demasiado agresiva se
      // convertiría en un filtro fantasma sin este aviso.
      dimensionesVaciadas: emptiedDimensions(BUYER_PROFILE, rules),
    };

    if (preview) {
      return NextResponse.json({
        ...resumen,
        mode: "preview",
        message: "Preview: nada escrito, ningún crédito gastado (buscar es gratis)",
        query,
        muestra: resultado.candidates.slice(0, 10).map((p) => ({
          apolloId: p.id,
          title: p.title,
          company: p.organization?.name ?? null,
        })),
        motivosDeDescarte: resultado.dropped.slice(0, 20),
      });
    }

    if (resultado.candidates.length === 0) {
      return NextResponse.json({
        ...resumen,
        skipped: true,
        reason:
          "La búsqueda no devolvió a nadie nuevo para esta combinación, ni siquiera ignorando las reglas",
      });
    }

    const shownOn = new Date();
    await prisma.prospectDiscovery.createMany({
      data: resultado.candidates.map((p) => ({
        apolloId: p.id,
        name: [p.first_name, p.last_name_obfuscated].filter(Boolean).join(" ") || null,
        title: p.title || null,
        company: p.organization?.name ?? null,
        sectorQuery: combo?.sector ?? null,
        sizeQuery,
        shownOn,
        decision: "pending",
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      ...resumen,
      message: `${resultado.candidates.length} candidatos en la cola de hoy`,
    });
  } catch (err) {
    console.error("❌ Error en cron prospect-queue:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
