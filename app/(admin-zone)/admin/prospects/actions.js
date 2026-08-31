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
import { QUEUE_SIZE } from "@/app/lib/prospecting/buildQueue";
import { deepDive } from "@/app/lib/prospecting/qualify";
import { passesGate } from "@/app/lib/prospecting/score";
import { generateIntro, recortar } from "@/app/lib/prospecting/introText";
import { askAboutCompany } from "@/app/lib/prospecting/prospectChat";
import { nearest, rememberDecision } from "@/app/lib/prospecting/memory";
import { embedTexts, textoDeCandidato } from "@/app/lib/prospecting/embeddings";
import { efficiencyMetrics } from "@/app/lib/prospecting/metrics";
import { getAnthropicClient } from "@/app/lib/ai/anthropic";

// Defensa en profundidad: HOY el proxy ya exige sesión bajo /admin, y como
// una Server Action se invoca con un POST a la ruta de la página que la
// importó (no a una ruta propia), ese matcher sí la intercepta mientras el
// único sitio que importe estas acciones sea una página bajo /admin. Pero esa
// protección depende de DÓNDE se importe la acción, no de la acción misma:
// nada impide que mañana alguien reutilice `listProspects` o `loadQueue`
// desde una página fuera de /admin (o desde un componente compartido) y se
// lleve la protección por delante sin querer. Se llama desde las cinco
// acciones de este fichero: las que escriben en base de datos (una de ellas
// gasta dinero de verdad) y también las dos de solo lectura (`loadQueue`,
// `listProspects`), porque devuelven datos reales de personas y comprobarlo
// no cuesta nada.
async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("No autorizado");
}

// Los motivos de descarte que se aceptan. Los cuatro primeros y "other" son los
// que ofrece la pantalla; `revenue` y `no_digital_need` son los que devuelve
// `passesGate` cuando una de las dos puertas duras cierra. Estos dos ya se
// escribían en la base —el cron los guarda tal cual desde que existe la
// cualificación con IA— pero no estaban aquí, así que una persona no podía
// tomar a mano la misma decisión que la máquina toma sola: `rejectCandidate`
// la rechazaba con "Motivo no válido".
const VALID_REASONS = [
  "role",
  "sector",
  "size",
  "in_house_team",
  "revenue",
  "no_digital_need",
  "other",
];

// ─── Ventana de las métricas ────────────────────────────────────────────────

const DIA_MS = 24 * 60 * 60 * 1000;
const VENTANA_METRICAS_MS = 7 * DIA_MS;

// Un minuto. El cron escribe `shownOn` y `decidedAt` con la MISMA fecha en todo
// lo que descarta el vistazo (una sola variable en route.js), así que la
// diferencia real es cero; el margen es tolerancia, no una medida.
const MARGEN_CRON_MS = 60 * 1000;

function diaDe(fecha) {
  if (!fecha) return null;
  const d = new Date(fecha);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

// La misma ventana que aplica `metrics.js` por dentro, incluida su guarda de
// fechas futuras. Se repite aquí a propósito: `costeTotal` viaja como un número
// suelto y aquel módulo no puede comprobar de qué filas sale (lo dice en su
// comentario). Si esta ventana y la suya dejaran de coincidir, el numerador y
// el denominador de `costePorValidado` hablarían de conjuntos distintos y no
// habría ningún síntoma.
function enVentanaDeMetricas(fecha, ahora) {
  if (!fecha) return false;
  const diferencia = ahora.getTime() - new Date(fecha).getTime();
  return diferencia >= 0 && diferencia <= VENTANA_METRICAS_MS;
}

// ¿Esta fila la descartó el propio cron, o la descartó una persona?
//
// No hay columna que lo diga, así que se deduce: el cron decide en el mismo
// instante en que muestra, una persona tarda. Solo se mira `decision === "no"`
// porque el cron nunca escribe un "sí" — así, un "sí" humano rapidísimo no
// puede confundirse jamás con ruido de la máquina.
//
// LO QUE LA ROMPE: una persona que decida dentro del minuto siguiente a que la
// fila se escriba. Con el cron de las 06:00 es imposible en la práctica, pero
// con `?force=1` —que existe para llenar la cola a mano y se usa con la
// pantalla delante— es perfectamente posible, y esa decisión humana se contaría
// como descarte de la máquina.
function descartadaPorElCron(fila) {
  if (fila.decision !== "no" || !fila.shownOn || !fila.decidedAt) return false;

  const diaMostrada = diaDe(fila.shownOn);
  const diaDecidida = diaDe(fila.decidedAt);
  if (!diaMostrada || diaMostrada !== diaDecidida) return false;

  return Math.abs(new Date(fila.decidedAt) - new Date(fila.shownOn)) < MARGEN_CRON_MS;
}

// Las filas de la ventana agrupadas por día, en la forma que espera
// `efficiencyMetrics`: una "ejecución" por día. Se agrupa en memoria porque las
// filas ya se han traído para sumar el coste, y un `groupBy` no podría hacer
// esta cuenta de todas formas: distinguir lo encolado de lo que descartó el
// cron es una comparación entre dos columnas de la misma fila.
function ejecucionesPorDia(filas) {
  const dias = new Map();

  for (const fila of filas) {
    const dia = diaDe(fila.shownOn);
    if (!dia) continue;

    const acc = dias.get(dia) ?? { shownOn: fila.shownOn, miradas: 0, encoladas: 0 };
    // Miradas: TODA fila escrita ese día. Las que llegaron a la cola y las que
    // el vistazo descartó, que también se pagaron.
    acc.miradas += 1;
    // Encoladas: las que llegaron a ponerse delante de alguien.
    if (!descartadaPorElCron(fila)) acc.encoladas += 1;
    dias.set(dia, acc);
  }

  return [...dias.values()];
}

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
// SÍ lleva `requireSession`, aunque sea una lectura que no gasta nada: ver el
// comentario de `requireSession` más arriba sobre por qué el matcher del
// proxy no es una garantía permanente para una Server Action. `listProspects`,
// aquí al lado, devuelve nombre, empresa, cargo, URL de LinkedIn y notas de
// personas reales; esta función devuelve lo mismo de la cola sin decidir. Es
// defensa en profundidad y no cuesta nada.
export async function loadQueue() {
  await requireSession();
  try {
    const ahora = new Date();
    const desdeVentana = new Date(ahora.getTime() - VENTANA_METRICAS_MS);

    const [queue, decisiones, credits, validados, ventana] = await Promise.all([
      prisma.prospectDiscovery.findMany({
        where: { decision: "pending" },
        // Por score y no por fecha de entrada: la cola se revisa de arriba
        // abajo y lo que mejor encaja tiene que salir primero, que es lo que
        // decide dónde merece la pena gastar los 0,35 $ del análisis a fondo.
        // El `id` desempata para que dos fichas con el mismo score no se
        // intercambien entre recargas.
        // `nulls: "last"` no sobra: en Postgres los NULL ordenan como MAYORES
        // que cualquier valor, así que `DESC` a secas los pone los PRIMEROS.
        // Las 16 fichas que ya estaban pendientes cuando llegó la cualificación
        // con IA tienen `score` nulo, y sin esto se llevarían los cinco huecos
        // de la cola: la pantalla enseñaría cinco fichas sin dossier, que es
        // justo lo que el esquema advierte que no puede pasar, y el botón de
        // profundizar gastaría 0,35 $ sobre filas sin análisis previo.
        orderBy: [{ score: { sort: "desc", nulls: "last" } }, { id: "asc" }],
        take: QUEUE_SIZE,
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
      // UNA sola consulta para las tres métricas. Trae las filas de la ventana
      // por los DOS extremos: las mostradas hace menos de siete días (el
      // embudo y el coste) y las decididas hace menos de siete días (la tasa de
      // aceptación). No son el mismo conjunto: una ficha que se mostró hace
      // diez días y se decide hoy es una decisión de esta semana, y filtrando
      // solo por `shownOn` desaparecería de la tasa sin dejar rastro.
      prisma.prospectDiscovery.findMany({
        where: {
          OR: [{ shownOn: { gte: desdeVentana } }, { decidedAt: { gte: desdeVentana } }],
        },
        select: { shownOn: true, decision: true, decidedAt: true, dossier: true },
      }),
    ]);

    // Lo mostrado dentro de la ventana: de aquí salen el embudo y el coste, y
    // tienen que salir de las MISMAS filas (ver `enVentanaDeMetricas`).
    const mostradasEnVentana = ventana.filter((f) => enVentanaDeMetricas(f.shownOn, ahora));

    const costeTotal = mostradasEnVentana.reduce(
      (total, f) => total + (Number(f.dossier?.cost) || 0),
      0,
    );

    return {
      success: true,
      queue,
      credits,
      stats: ruleStats(decisiones),
      metrics: efficiencyMetrics({
        ejecuciones: ejecucionesPorDia(mostradasEnVentana),
        // Para la tasa de aceptación solo cuentan las decisiones de UNA
        // PERSONA. Las que descartó el cron nunca llegaron a la cola, y
        // dejarlas dentro convertiría "de las fichas que se te ponen delante,
        // cuántas aceptas" en "qué porcentaje aprueba el vistazo": otra métrica
        // distinta, dominada por el volumen de la IA, y que además empeora
        // sola cada día que el cron mira a más gente.
        decisiones: ventana.filter((f) => !descartadaPorElCron(f)),
        costeTotal,
        ahora,
      }),
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

// El análisis a fondo: ~0,35 $ de Opus 5, y lo dispara una persona pulsando un
// botón. Por eso NO lo lanza el cron y por eso esta acción existe: el gasto lo
// autoriza quien mira la ficha, no un temporizador.
//
// Lleva `requireSession` como todas: es la única de las acciones nuevas que
// gasta dinero por sí sola.
export async function deepenCandidate(id) {
  await requireSession();

  try {
    const fila = await prisma.prospectDiscovery.findUnique({ where: { id: Number(id) } });
    if (!fila) return { success: false, error: "Candidato no encontrado" };

    // Un segundo análisis a fondo sobre la misma ficha cuesta otros 0,35 $ y
    // parte del mismo material que el primero.
    if (fila.depth === "fondo") {
      return {
        success: false,
        error: "Este candidato ya tiene un análisis a fondo. No se repite para no pagarlo dos veces.",
      };
    }

    // Los vecinos son los ejemplos con los que el modelo calibra dónde pone la
    // frontera esta persona. Si Voyage falla se sigue sin ellos: el análisis
    // sale peor calibrado, pero sale — y quien ha pulsado el botón está
    // esperando. Cinco y no tres: esta llamada es diez veces más cara que un
    // vistazo, así que unos cuantos ejemplos más salen a cuenta.
    let ejemplos = [];
    try {
      const [vector] = await embedTexts([textoDeCandidato(fila)], { inputType: "query" });
      if (vector) ejemplos = await nearest(prisma, vector, { k: 5 });
    } catch (err) {
      console.error("[prospects] sin vecinos para el análisis a fondo:", err.message);
    }

    const r = await deepDive(
      { title: fila.title, company: fila.company },
      { client: getAnthropicClient(), ejemplos, dossierPrevio: fila.dossier },
    );

    if (!r.ok) {
      // El coste viene aunque el análisis falle (`qualify.js` lo devuelve a
      // propósito), así que se enseña: se ha gastado de verdad.
      return { success: false, error: r.error, cost: r.cost ?? 0 };
    }

    const puerta = passesGate(r.veredictos);
    const scoreAnterior = fila.score;

    const dossier = {
      veredictos: r.veredictos,
      summary: r.veredictos.summary,
      report: r.report,
      // El coste se ACUMULA, no se sustituye. Este dossier reemplaza al del
      // vistazo, y con él se iría a la basura el gasto de aquella llamada: la
      // métrica de coste por validado lee `dossier.cost` de cada fila, así que
      // pisarlo haría que profundizar una ficha abaratara el sistema sobre el
      // papel justo al gastar más.
      cost: (Number(fila.dossier?.cost) || 0) + (r.cost ?? 0),
      costeVistazo: Number(fila.dossier?.cost) || 0,
      costeFondo: r.cost ?? 0,
    };

    await prisma.prospectDiscovery.update({
      where: { id: fila.id },
      data: {
        dossier,
        // El score se recalcula aquí, no se copia: es la misma función que usa
        // el cron, así que el número de una ficha profundizada y el de una
        // recién mirada significan exactamente lo mismo.
        score: puerta.score,
        depth: "fondo",
        qualifiedAt: new Date(),
      },
    });

    revalidatePath("/admin/prospects");
    return {
      success: true,
      // Los dos scores, para que la pantalla pueda enseñar el cambio: lo que
      // te llevas por los 0,35 $ no es el número nuevo, es la diferencia.
      scoreAnterior,
      score: puerta.score,
      dossier,
      // El análisis a fondo PUEDE tumbar una ficha que el vistazo aprobó. No se
      // descarta sola —la decisión sigue siendo de la persona—, pero la
      // pantalla tiene que poder decirlo.
      pasaLaPuerta: puerta.ok,
      reasonCode: puerta.reasonCode,
      cost: r.cost ?? 0,
    };
  } catch (err) {
    console.error("[prospects] el análisis a fondo falló:", err);
    return { success: false, error: err.message };
  }
}

// Preguntar sobre la empresa antes de decidir. Cuesta bastante menos que el
// análisis a fondo, y su razón de ser es esa: resolver la duda concreta que
// frena la decisión sin pagar el análisis entero.
//
// El hilo NO se persiste (ver prospectChat.js), así que viaja desde el cliente
// en cada llamada. Eso significa que lo que llega aquí es lo que ha mandado el
// navegador: se normaliza a `{ role, content }` antes de reenviarlo a la API,
// que rechaza con 400 cualquier bloque de texto vacío y cualquier rol que no
// conozca.
export async function askCandidate({ id, pregunta, historial = [] }) {
  await requireSession();

  const texto = String(pregunta ?? "").trim();
  if (!texto) return { success: false, error: "La pregunta está vacía" };

  try {
    const fila = await prisma.prospectDiscovery.findUnique({ where: { id: Number(id) } });
    if (!fila) return { success: false, error: "Candidato no encontrado" };

    const hilo = (Array.isArray(historial) ? historial : [])
      .map((m) => ({
        role: m?.role === "assistant" ? "assistant" : "user",
        content: String(m?.content ?? "").trim(),
      }))
      .filter((m) => m.content);

    const r = await askAboutCompany({
      client: getAnthropicClient(),
      ficha: fila,
      historial: hilo,
      pregunta: texto,
    });

    if (!r.ok) return { success: false, error: r.error, cost: r.cost ?? 0 };
    return { success: true, text: r.text, cost: r.cost ?? 0 };
  } catch (err) {
    console.error("[prospects] preguntar sobre el candidato falló:", err);
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
    const fila = await prisma.prospectDiscovery.update({
      where: { id: Number(id) },
      data: {
        decision: "no",
        reasonCode,
        note: (note || "").trim() || null,
        decidedAt: new Date(),
      },
    });

    // La decisión ya está escrita. Guardarla en la memoria es lo que cierra el
    // bucle —mañana ordena el pozo y calibra los ejemplos del cualificador—,
    // pero va en su propio try/catch porque depende de Voyage: un fallo suyo no
    // puede tirar una decisión que la persona ya ha tomado y que ya está en la
    // base. La memoria es una capa que se degrada, no una que rompe.
    try {
      await rememberDecision(prisma, fila);
    } catch (err) {
      console.error("[prospects] el descarte se guardó pero no entró en la memoria:", err);
    }

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

    // En el caso `duplicado` NO se genera nota, y es deliberado: ese prospecto
    // ya existe, probablemente ya tenga una nota escrita —quizá reescrita a
    // mano, que es el único material de tono que aprende el sistema— y
    // generarla otra vez costaría una llamada a Opus para pisarla. Se devuelve
    // la que ya tiene: si está vacía, la pantalla ofrece el botón de generarla
    // (`regenerateIntro`) y esa sí es una decisión de la persona. Por lo mismo
    // tampoco se le copia encima el dossier de este descubrimiento.
    let introText = duplicado?.introText ?? null;
    let creado = null;

    if (!duplicado) {
      creado = await prisma.prospect.create({
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
          // Copia del dossier del descubrimiento: es todo lo que sabemos de la
          // empresa y la lista de validados no tiene por qué ir a buscarlo a la
          // cola. Va con spread condicional y no con `?? null` porque Prisma
          // rechaza un null explícito en una columna `Json?` (pide `DbNull`):
          // una fila sin dossier —las anteriores a la cualificación con IA—
          // haría lanzar este `create` DESPUÉS de haber gastado el crédito de
          // Apollo, y el prospecto pagado no llegaría a existir.
          ...(candidato.dossier ? { dossier: candidato.dossier } : {}),
        },
      });
    }

    const filaDecidida = await prisma.prospectDiscovery.update({
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

    // La nota va AQUÍ, después de escribir la decisión, y no justo después de
    // crear el `Prospect`. Es una llamada a Opus con razonamiento: tarda
    // segundos, y ponerla entre las dos escrituras que sí tienen que ocurrir
    // dejaría una ventana en la que un corte por tiempo de ejecución deja el
    // crédito gastado, el prospecto creado y el descubrimiento todavía en
    // "pending". Se recupera solo por la rama de reanudación, pero es una
    // ventana que no hace falta abrir: aquí lo peor que pasa es quedarse sin
    // nota, y para eso está el botón de generarla.
    if (creado) introText = await generarNotaDeInvitacion(creado, candidato);

    // El "sí" a la memoria, con el mismo try/catch que el "no": aquí ya se ha
    // gastado un crédito de Apollo y el prospecto está creado, así que un fallo
    // de Voyage no puede tener ninguna consecuencia visible. Es la capa que se
    // degrada.
    try {
      await rememberDecision(prisma, filaDecidida);
    } catch (err) {
      console.error("[prospects] el sí se guardó pero no entró en la memoria:", err);
    }

    revalidatePath("/admin/prospects");
    return { success: true, linkedinUrl, duplicado: Boolean(duplicado), introText };
  } catch (err) {
    console.error("[prospects] aceptar falló:", err);
    return { success: false, error: err.message };
  }
}

// La lista de validados: el resultado del sistema. Devuelve nombre, empresa,
// cargo, URL de LinkedIn y notas de personas reales, así que lleva
// `requireSession` por el mismo motivo que `loadQueue` aquí arriba: la
// protección del proxy depende de que solo una página bajo /admin importe
// esta acción, no de la acción misma.
export async function listProspects() {
  await requireSession();
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

// ─── La nota de invitación de LinkedIn ──────────────────────────────────────

// Los ejemplos de tono: las últimas notas de OTROS prospectos, tal y como
// quedaron tras las ediciones del usuario (ver introText.js). Se ordenan por
// `updatedAt` y no por `createdAt` a propósito: una nota reescrita a mano ayer
// dice más de cómo quiere que suene esto que una generada hace tres meses y
// nunca tocada, aunque el prospecto sea más nuevo.
async function ultimasNotasDeOtros(id, limite = 5) {
  const otros = await prisma.prospect.findMany({
    where: { id: { not: Number(id) }, introText: { not: null } },
    orderBy: { updatedAt: "desc" },
    take: limite,
    select: { introText: true },
  });
  return otros.map((o) => o.introText);
}

// Genera la nota de un prospecto RECIÉN CREADO. No lanza nunca y no devuelve
// error: se llama después de haber gastado el crédito de Apollo, así que lo peor
// que puede pasar es que el prospecto se quede sin nota y la pantalla ofrezca el
// botón de pedirla. Ni un fallo de la IA, ni uno de Voyage, ni una clave sin
// configurar pueden convertirse en un prospecto pagado que no se guarda.
async function generarNotaDeInvitacion(prospecto, candidato) {
  try {
    const r = await generateIntro(prospecto, {
      client: getAnthropicClient(),
      dossier: candidato?.dossier ?? {},
      notasAnteriores: await ultimasNotasDeOtros(prospecto.id),
    });
    if (!r.ok) return null;

    await prisma.prospect.update({
      where: { id: prospecto.id },
      data: { introText: r.text },
    });
    return r.text;
  } catch (err) {
    console.error("[prospects] el prospecto se creó pero la nota de invitación no:", err);
    return null;
  }
}

// La nota editada a mano. Es la mitad importante del bucle de tono: lo que se
// guarda aquí es lo que el modelo imitará en las siguientes (ver introText.js),
// así que se guarda TAL CUAL, sin reescribir nada.
//
// Se recorta con la misma función que usa el generador: 300 caracteres es un
// límite duro de LinkedIn, y da igual que el texto lo haya escrito una persona
// —una nota de 340 caracteres se guardaría entera y se cortaría al pegarla,
// justo cuando ya no se está mirando.
export async function setIntroText(id, texto) {
  await requireSession();
  try {
    const recortado = recortar(texto);
    await prisma.prospect.update({
      where: { id: Number(id) },
      data: { introText: recortado || null },
    });
    revalidatePath("/admin/prospects");
    return { success: true, introText: recortado };
  } catch (err) {
    console.error("[prospects] guardar la nota falló:", err);
    return { success: false, error: err.message };
  }
}

// Volver a generar la nota de un prospecto ya validado. Es el botón que hace
// que un fallo de la generación al aceptar sea un inconveniente y no una
// pérdida, y también sirve para pedir otra cuando la primera no convence.
export async function regenerateIntro(id) {
  await requireSession();
  try {
    const prospecto = await prisma.prospect.findUnique({ where: { id: Number(id) } });
    if (!prospecto) return { success: false, error: "Prospecto no encontrado" };

    const r = await generateIntro(prospecto, {
      client: getAnthropicClient(),
      dossier: prospecto.dossier ?? {},
      // De OTROS prospectos: incluir la nota que se está reemplazando haría que
      // el modelo imitara justo el texto que no ha convencido.
      notasAnteriores: await ultimasNotasDeOtros(prospecto.id),
    });

    if (!r.ok) return { success: false, error: r.error };

    await prisma.prospect.update({
      where: { id: prospecto.id },
      data: { introText: r.text },
    });

    revalidatePath("/admin/prospects");
    return { success: true, introText: r.text, cost: r.cost ?? 0 };
  } catch (err) {
    console.error("[prospects] regenerar la nota falló:", err);
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
