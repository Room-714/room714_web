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
import { rankPool } from "@/app/lib/prospecting/rankPool";
import { quickLook } from "@/app/lib/prospecting/qualify";
import { passesGate } from "@/app/lib/prospecting/score";
import { embedTexts } from "@/app/lib/prospecting/embeddings";
import { memorySize, nearest } from "@/app/lib/prospecting/memory";
import { getAnthropicClient } from "@/app/lib/ai/anthropic";
import { isMadridHour } from "@/app/lib/time/madrid";

// 300 s, no 60: cada vistazo tarda entre cinco y quince segundos y hacen falta
// varios. Los lotes van en paralelo, pero aun así el peor día se acerca al techo.
export const maxDuration = 300;

// Los tres topes que pueden cortar la mañana. Los tres escriben lo que hayan
// conseguido hasta ese momento, y el resumen dice cuál cortó: una cola corta
// tiene que ser legible, no un misterio.
//
// 1,20 $ da para los 30 vistazos que permite TOPE_MIRADAS, así que el límite
// real del día es el número de empresas y no el dinero, y este tope queda como
// freno de emergencia. Basado en 0,041 $ por vistazo, medido sobre nueve
// llamadas reales; un día normal se gastan entre 0,40 y 0,60 $.
const TOPE_GASTO_USD = Number(process.env.PROSPECT_QUALIFY_DAILY_BUDGET_USD) || 1.2;
const TOPE_MIRADAS = 30;
const TOPE_MS = 240_000;
const LOTE_VISTAZOS = 5;

// 06:00, a la vez que la generación del artículo: la cola tiene que estar lista
// antes de que nadie se siente, y buscar en Apollo es rápido porque no enriquece.
const TARGET_HOUR = 6;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const params = new URL(request.url).searchParams;

  // Preview: enseña a quién pondría en la cola sin escribir nada. Como buscar es
  // gratis, este modo no cuesta absolutamente nada y es la forma de validar un
  // cambio de criterio antes de vivir con él una mañana entera.
  const preview = params.get("preview") === "1";

  // Force: llena la cola de verdad fuera de la hora del cron. Salta el guard de
  // hora, nunca la autenticación. Hace falta para dos cosas reales: verificar el
  // sistema sin esperar a las 06:00, y recuperarse de una mañana en que el cron
  // fallara — los crones de Vercel no reintentan, así que sin esto un fallo deja
  // el día sin cola y no hay forma de arreglarlo hasta el día siguiente.
  //
  // No salta el corte por cola llena: eso sigue protegiendo de acumular.
  const force = params.get("force") === "1";

  if (!preview && !force && !isMadridHour(TARGET_HOUR)) {
    return NextResponse.json({
      message: "Saltado: no es la hora correcta en Madrid",
      targetHour: `${TARGET_HOUR}:00 Madrid`,
      pista: "Para llenarla ahora a mano: ?force=1",
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

    // El historial que pondera la rotación: por combinación, cuánto hace que
    // salió, cuántos aciertos ha dado y cuántas filas lleva detrás. Sin esto
    // `comboForDay` se comporta como la rotación fija de siempre, así que lo
    // único que aporta este bloque es que las combinaciones que aciertan
    // salgan más — sin dejar de muestrear las demás (ver SUELO_EJECUCIONES).
    const [porCombo, aciertos] = await Promise.all([
      prisma.prospectDiscovery.groupBy({
        by: ["sectorQuery", "sizeQuery"],
        _count: { _all: true },
        _max: { shownOn: true },
      }),
      prisma.prospectDiscovery.groupBy({
        by: ["sectorQuery", "sizeQuery"],
        where: {
          decision: "yes",
          // OJO: aquí NO vale `reasonCode: { not: "legacy" }`, y no es una
          // preferencia de estilo. Prisma lo traduce a `"reasonCode" <>
          // 'legacy'`, y en SQL `NULL <> 'legacy'` es NULL, no true: ese
          // filtro se lleva por delante TODOS los sí con motivo nulo, que son
          // precisamente los que toma una persona (el motivo solo se rellena
          // al descartar). Comprobado contra la base real: de 24 filas con
          // decisión "yes", 22 son legacy y las 2 reales tienen reasonCode
          // NULL, así que la versión con `not` devolvía exactamente 0
          // aciertos. La ponderación se habría quedado ciega para siempre, sin
          // fallar ni avisar. Con el OR salen las 2.
          OR: [{ reasonCode: null }, { reasonCode: { not: "legacy" } }],
        },
        _count: { _all: true },
      }),
    ]);

    const hoy = dayIndexFor(new Date());
    const claveDe = (sector, size) => `${sector}|${size}`;
    const hitsPorClave = new Map(
      aciertos.map((a) => [claveDe(a.sectorQuery, a.sizeQuery), a._count._all]),
    );

    const historial = porCombo.map((g) => ({
      // `sector` y `size`, no `sectorQuery`/`sizeQuery`: son los nombres con
      // los que `comboForDay` construye su clave.
      sector: g.sectorQuery,
      size: g.sizeQuery,
      // Sin fecha no sabemos cuándo salió esta combinación. Infinity la da por
      // vencida, que es el lado seguro: se muestrea antes, no se condena.
      ejecucionesDesde: g._max.shownOn ? hoy - dayIndexFor(g._max.shownOn) : Infinity,
      hits: hitsPorClave.get(claveDe(g.sectorQuery, g.sizeQuery)) ?? 0,
      total: g._count._all,
    }));

    const combo = comboForDay(BUYER_PROFILE, hoy, { historial });
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

    // ─── Ordenar el pozo antes de gastar ────────────────────────────────────
    // Embeber los candidatos cuesta cero; mirarlos cuesta ~0,04 $ cada uno.
    // Este orden es lo que hace que haga falta mirar ocho en vez de veinte.
    const anthropic = getAnthropicClient();
    const memoria = await memorySize(prisma);

    const ordenados = await rankPool(resultado.candidates, {
      embed: (textos) => embedTexts(textos, { inputType: "query" }),
      buscarVecinos: (vector) => nearest(prisma, vector, { k: 3 }),
    });

    // ─── Vistazo, de arriba abajo, parando al llenar la cola ────────────────
    const arranque = Date.now();
    const aprobados = [];
    const rechazados = [];
    let gastado = 0;
    let miradas = 0;
    let corte = null;

    for (let i = 0; i < ordenados.length; i += LOTE_VISTAZOS) {
      if (aprobados.length >= QUEUE_SIZE) break;
      if (gastado >= TOPE_GASTO_USD) { corte = "gasto"; break; }
      if (miradas >= TOPE_MIRADAS) { corte = "miradas"; break; }
      if (Date.now() - arranque > TOPE_MS) { corte = "tiempo"; break; }

      const lote = ordenados.slice(i, i + LOTE_VISTAZOS);
      const vistos = await Promise.all(
        lote.map((c) =>
          quickLook(
            { title: c.title, company: c.organization?.name },
            { client: anthropic, ejemplos: c._vecinos ?? [] },
          ).then((r) => ({ candidato: c, resultado: r })),
        ),
      );

      for (const { candidato, resultado: r } of vistos) {
        miradas += 1;
        gastado += r.cost ?? 0;

        if (!r.ok) {
          // Un fallo de la IA no es un descarte: no sabemos nada de esa
          // empresa. Se deja fuera del día SIN escribir decisión, para que
          // pueda volver a salir mañana.
          rechazados.push({ candidato, motivo: r.error, dossier: null });
          continue;
        }

        const puerta = passesGate(r.veredictos);
        const dossier = {
          veredictos: r.veredictos,
          summary: r.veredictos.summary,
          report: r.report,
          cost: r.cost,
        };

        if (puerta.ok && aprobados.length < QUEUE_SIZE) {
          aprobados.push({ candidato, dossier, score: puerta.score });
        } else {
          rechazados.push({ candidato, motivo: puerta.reasonCode, score: puerta.score, dossier });
        }
      }
    }

    // ─── Escribir lo conseguido ─────────────────────────────────────────────
    const shownOn = new Date();

    // De cada vecino solo lo que la ficha enseña. El vector NO entra aquí: son
    // 1024 números por vecino, y guardarlos engordaría la fila en una columna
    // que nadie consulta.
    const vecinosParaFicha = (c) =>
      (c._vecinos ?? []).map((v) => ({
        text: v.text ?? null,
        decision: v.metadata?.decision ?? null,
        company: v.metadata?.company ?? null,
        distance: v.distance ?? null,
      }));

    const filaBase = (c) => ({
      apolloId: c.id,
      name: [c.first_name, c.last_name_obfuscated].filter(Boolean).join(" ") || null,
      title: c.title || null,
      company: c.organization?.name ?? null,
      sectorQuery: combo?.sector ?? null,
      sizeQuery,
      shownOn,
      // El dossier viene de un vistazo, y `depth` es justo de dónde viene.
      depth: "vistazo",
      qualifiedAt: shownOn,
      neighbors: vecinosParaFicha(c),
    });

    const filas = [
      ...aprobados.map(({ candidato, dossier, score }) => ({
        ...filaBase(candidato),
        decision: "pending",
        score,
        dossier,
      })),
      // Los descartados por la IA se escriben TAMBIÉN, y no es contabilidad de
      // más: sin ellos no hay embudo que enseñar en la pantalla —"de 12
      // mirados, 5 encolados"— y, peor, mañana volverían a salir en la
      // búsqueda y se pagaría otro vistazo por la misma empresa. Los que
      // fallaron por un error de la IA (sin dossier) NO se escriben: de esos no
      // sabemos nada y merecen otra oportunidad.
      ...rechazados
        .filter((r) => r.dossier)
        .map(({ candidato, motivo, score, dossier }) => ({
          ...filaBase(candidato),
          decision: "no",
          reasonCode: motivo ?? null,
          decidedAt: shownOn,
          score: score ?? null,
          dossier,
        })),
    ];

    // Una fila por `create` en vez de un `createMany`: un apolloId duplicado
    // —dos páginas de Apollo que devuelven a la misma persona, una fila que ya
    // existía— aborta la sentencia entera, y con ella la mañana, incluidos los
    // vistazos YA PAGADOS. Aquí un fallo se lleva su fila y nada más, y se
    // cuenta para que el resumen no mienta sobre lo que quedó escrito.
    let encolados = 0;
    let descartadosEscritos = 0;
    let fallosDeEscritura = 0;

    for (const fila of filas) {
      try {
        await prisma.prospectDiscovery.create({ data: fila });
        if (fila.decision === "pending") encolados += 1;
        else descartadosEscritos += 1;
      } catch (err) {
        fallosDeEscritura += 1;
        console.error(
          `[prospeccion] no se pudo escribir ${fila.apolloId}:`,
          err.message,
        );
      }
    }

    const gastadoUSD = Math.round(gastado * 10_000) / 10_000;

    return NextResponse.json({
      ...resumen,
      encolados,
      descartadosPorIA: descartadosEscritos,
      // Los que ni se escriben: la IA falló y de esos no sabemos nada.
      vistazosFallidos: rechazados.filter((r) => !r.dossier).length,
      fallosDeEscritura,
      miradas,
      gastadoUSD,
      corte,
      memoriaDocs: memoria,
      // `rankPool` se degrada en silencio: si Voyage falla devuelve el orden de
      // Apollo con `_vecinos` vacíos, la misma forma que el camino bueno. Con
      // memoria en la base y NINGÚN vecino en NINGÚN candidato, el pozo no se
      // ordenó, y eso explica por qué hicieron falta más vistazos de la cuenta.
      ordenSinVecindario:
        memoria > 0 && ordenados.every((c) => (c._vecinos?.length ?? 0) === 0),
      message:
        `${encolados} en la cola tras ${miradas} vistazos (${gastadoUSD} $), ` +
        `${descartadosEscritos} descartados` +
        (corte ? `; cortado por ${corte}` : "") +
        (fallosDeEscritura ? `; ${fallosDeEscritura} filas no se pudieron escribir` : ""),
    });
  } catch (err) {
    console.error("❌ Error en cron prospect-queue:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
