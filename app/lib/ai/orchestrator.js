import { prisma } from "@/app/lib/prisma";
import { categoryForDate } from "./topicRotation";
import {
  buscarParecidos,
  cargarCorpus,
  metasRepetidas,
  postsRecientes,
  resumenPost,
  slugUnico,
  slugsOcupados,
  titulosExistentes,
} from "./duplicados";
import { planificarTema } from "./planificador";
import { MAX_ENLAZADO_MS, MAX_PLANIFICADOR_MS, RESERVA_TRAS_GENERAR_MS, crearReloj } from "./tiempos";
import {
  getCrossSourceTrending,
  summarizeSources,
} from "@/app/lib/sources/aggregator";
import {
  fetchAndStoreCoverImage,
  fallbackQueryForCategory,
} from "@/app/lib/sources/unsplash";
import { generateLinkedInTakes, generatePostDraft } from "./generator";
import { backlinkOldPosts } from "./backlinker";
import { slugify } from "@/app/lib/slug";
import { computeOutboundLinksForPost } from "./internalLinker";
import { sendDraftReadyEmail } from "@/app/lib/notifications/draftReady";
import {
  BUSQUEDAS_OBJETIVO,
  CATEGORIA_DEL_CLUSTER,
  clusterDelDia,
  elegirBusqueda,
} from "@/app/lib/seo/busquedasObjetivo";
import { CATEGORY_CLUSTER, CLUSTERS, clusterForCategory, clusterHref } from "@/app/lib/seo/clusters";
import {
  getMadridWeekday,
  madridDayRange,
  nextMadridSlot,
} from "@/app/lib/time/madrid";
import {
  channelForVariant,
  crossActionsFor,
  PLANNED_WEEKDAYS,
  takeCountFor,
  variantScheduleFor,
} from "@/app/lib/time/linkedinSchedule";

// El artículo se hace visible a las 07:30 de Madrid: el blog filtra date <= now,
// así que esta fecha ES la hora de publicación. La revisión manual va de 08:00
// a 08:30 y las tomas de LinkedIn se generan a las 08:30, en un cron aparte.
const PUBLISH_HOUR_MADRID = 7;
const PUBLISH_MINUTE_MADRID = 30;

/**
 * El duplicado que impide generar, o null. Manda la comprobación léxica
 * (determinista); si no encuentra nada, la semántica del planificador.
 * Pura y exportada para probarla.
 */
export function decidirDuplicado(plan, corpus, ahora = new Date()) {
  const lexico = buscarParecidos({ es: plan.tema_es, en: plan.tema_en }, corpus)[0];
  if (lexico) {
    return {
      tema: plan.tema_es,
      fuente: "léxica",
      motivo: `Comparte los términos clave (${lexico.comunes.join(", ")}) con su ${lexico.campo === "slug" ? "slug" : lexico.campo === "metaTitle" ? "metaTitle" : "título"} (parecido ${Math.round(lexico.puntuacion * 100)} %).`,
      existente: resumenPost(lexico.post, ahora),
    };
  }
  if (plan.duplicadoDe) {
    const post = corpus.find((p) => p.id === plan.duplicadoDe.id);
    if (post) {
      return {
        tema: plan.tema_es,
        fuente: "semántica",
        motivo: plan.motivo || "El modelo considera que ya cubre este tema.",
        existente: resumenPost(post, ahora),
      };
    }
  }
  return null;
}

/**
 * Categoría con la que se guarda un post de `cluster`. El cluster no tiene
 * columna propia (seo/posicionamiento.md): queda en el enlace a la página del
 * cluster y en la categoría, así que las dos tienen que coincidir. Si la
 * categoría del día ya es del cluster (DESIGN también es C2) se respeta.
 */
export function categoriaParaCluster(category, cluster) {
  if (category && CATEGORY_CLUSTER[category] === cluster) return category;
  return CATEGORIA_DEL_CLUSTER[cluster];
}

/**
 * Genera el post de la próxima franja de las 07:30.
 *
 * - `tema`: un tema pedido a mano (API). Sin él, lo fija la búsqueda objetivo
 *   del día o lo propone el planificador.
 * - `evitar`: temas descartados ("Elegir otro ángulo" en el panel).
 * - `alDuplicar`: "avisar" (panel: no genera y devuelve el duplicado) u
 *   "otroAngulo" (cron: descarta el tema y lo intenta una vez más).
 * - `preview`: hace la consulta, la planificación y las comprobaciones, y
 *   devuelve la decisión sin generar ni escribir nada.
 */
export async function generateDraftForToday({
  categoryOverride,
  sendEmail = true,
  tema: temaManual,
  evitar = [],
  alDuplicar = "avisar",
  preview = false,
} = {}) {
  // Presupuesto de toda la generación (tiempos.js): cada llamada al modelo se
  // lleva su parte y nada puede dejar la petición colgada hasta el corte de
  // Vercel a los 300 s.
  const reloj = crearReloj();
  const today = new Date();
  const publishDate = nextMadridSlot(PUBLISH_HOUR_MADRID, PUBLISH_MINUTE_MADRID);
  // Lunes y miércoles el día fija cluster y categoría
  // (app/lib/seo/busquedasObjetivo.js). Una categoría forzada a mano, un tema
  // pedido a mano o un día sin cluster siguen la rotación de categorías.
  const dia = categoryOverride || temaManual ? null : clusterDelDia(publishDate);
  let category = categoryOverride ?? dia?.category ?? categoryForDate(today);

  if (!category && !temaManual) {
    return {
      skipped: true,
      reason: "No es día laborable (sin rotación de categoría)",
    };
  }

  // Dos formas de acabar sin tomas y en silencio: que el cron llegue tarde y
  // nextMadridSlot salte al siguiente día laborable, o que se genere a mano
  // (p. ej. desde /api/admin/generate-draft) en un día que sí es laborable
  // pero no tiene plan de tomas (martes, jueves, viernes). En los dos casos
  // generate-linkedin no recogerá el artículo esa semana. No lo impedimos
  // —publicar sin tomas es preferible a no publicar— pero que quede en el log.
  if (!PLANNED_WEEKDAYS.includes(getMadridWeekday(publishDate))) {
    console.warn(
      `generateDraftForToday: el artículo se fecha el ${publishDate.toISOString()}, un día sin plan de tomas; no lo recogerá el cron de las 08:30`,
    );
  }

  // La ÚNICA lectura de la BD antes de guardar: títulos, metaTitle,
  // metaDescription y slugs de todos los posts (publicados, programados y
  // borradores). De aquí salen la comprobación de duplicados, la búsqueda
  // objetivo, los posts recientes del enlazado interno, los metadatos ya
  // usados y los slugs ocupados. Antes eran dos consultas en paralelo más un
  // findUnique por cada slug probado.
  const corpus = await cargarCorpus();
  const existentes = titulosExistentes(corpus);

  // Las tendencias son HTTP externo, no BD. Con un tema pedido a mano no hacen falta.
  const trending = temaManual ? [] : await getCrossSourceTrending(category);

  // Planificar → comprobar → (en el cron) un intento más con otro tema.
  const rechazados = [...evitar];
  const intentos = alDuplicar === "otroAngulo" ? 2 : 1;
  let objetivo = null;
  let plan;
  for (let intento = 1; ; intento += 1) {
    // La primera búsqueda del cluster que ningún post existente cubre. Si no
    // queda ninguna, el planificador propone tema y el correo lo avisa.
    objetivo = dia ? elegirBusqueda(dia.cluster, existentes, BUSQUEDAS_OBJETIVO, rechazados) : null;
    const temaFijo = temaManual ?? objetivo?.busqueda ?? null;

    plan = await planificarTema({
      category,
      clusterSugerido: dia?.cluster ?? (category ? clusterForCategory(category) : null),
      temaFijo,
      trending,
      existentes,
      evitar: rechazados,
      // Lo que no se lleve el planificador tiene que bastar para generar.
      timeoutMs: reloj.tope(MAX_PLANIFICADOR_MS, RESERVA_TRAS_GENERAR_MS + 60_000),
    });

    const duplicado = decidirDuplicado(plan, corpus);
    if (!duplicado) break;

    if (intento >= intentos) {
      return {
        skipped: true,
        reason: `Ya existe un post muy parecido a "${duplicado.tema}": "${duplicado.existente.title}" (${duplicado.existente.estado}). ${duplicado.motivo}`,
        duplicado,
        evitar: rechazados,
      };
    }
    console.warn(`generateDraftForToday: "${duplicado.tema}" duplica el post ${duplicado.existente.id}; se prueba otro tema`);
    rechazados.push(duplicado.tema);
  }
  const sinBusquedas = Boolean(dia && !objetivo);

  // Cluster: el del día si hay búsqueda objetivo (la lista es por cluster);
  // si no, el que asigna el planificador. Sin cluster no se genera.
  const cluster = objetivo ? dia.cluster : plan.cluster;
  if (!cluster) {
    return {
      skipped: true,
      sinCluster: true,
      tema: plan.tema_es,
      reason: `El tema "${plan.tema_es}" no encaja en ningún cluster (ideación/discovery, diseño de producto y experiencia de cliente, desarrollo de software de producto). ${plan.motivo}`.trim(),
      evitar: rechazados,
    };
  }
  if (!categoryOverride) category = categoriaParaCluster(category, cluster);

  const planResumen = {
    tema: plan.tema_es,
    angulo: plan.angulo_es,
    cluster,
    clusterName: CLUSTERS[cluster].name.es,
    category,
    busquedaObjetivo: objetivo?.busqueda ?? null,
    usage: plan.usage,
  };
  if (preview) return { preview: true, skipped: false, plan: planResumen };

  const draft = await generatePostDraft({
    category,
    trending,
    recentPosts: postsRecientes(corpus, 10),
    publishedCorpus: existentes,
    cluster,
    targetQuery: objetivo?.busqueda,
    tema: plan.tema_es,
    angulo: plan.angulo_es,
    corpus,
    reloj,
  });

  // El generador ya lo comprueba (y reintenta); esto es la última barrera
  // antes del INSERT.
  const repetidas = metasRepetidas(draft, corpus);
  if (repetidas.length) {
    throw new Error(
      `No se guarda: metadatos que ya usa otro post (${repetidas.map((r) => `${r.campo} → post ${r.postId}`).join(", ")})`,
    );
  }

  const datePrefix = today.toISOString().split("T")[0];
  const cover = await fetchAndStoreCoverImage(draft.image_query, datePrefix, {
    fallbackQuery: fallbackQueryForCategory(category),
  });

  // Slugs únicos sin consultar: los ocupados vienen en el corpus. Si otra
  // escritura se cuela entre medias, el @unique del slug hace fallar el INSERT.
  const ocupados = slugsOcupados(corpus);
  const slugEs = slugUnico(slugify(draft.slug_es || draft.title_es), ocupados);
  ocupados.add(slugEs);
  const slugEn = slugUnico(slugify(draft.slug_en || draft.title_en), ocupados);

  const post = await prisma.post.create({
    data: {
      image: cover.url,
      category,
      date: publishDate,
      published: true,
      published_sent: false,
      source: "AUTO",
      translations: {
        create: [
          {
            lang: "es",
            slug: slugEs,
            title: draft.title_es,
            tags: draft.tags_es,
            content: draft.content_es,
            metaDescription: draft.meta_description_es,

            metaTitle: draft.meta_title_es,
          },
          {
            lang: "en",
            slug: slugEn,
            title: draft.title_en,
            tags: draft.tags_en,
            content: draft.content_en,
            metaDescription: draft.meta_description_en,

            metaTitle: draft.meta_title_en,
          },
        ],
      },
    },
    include: { translations: true },
  });

  const translationEs = post.translations.find((t) => t.lang === "es");
  const translationEn = post.translations.find((t) => t.lang === "en");

  // Backlink bidireccional: edita 2-3 posts antiguos para que enlacen al
  // nuevo. Best-effort — un fallo aquí no rompe la publicación.
  // El post ya está guardado: si no queda tiempo para el enlazado, se salta
  // en vez de arriesgar el corte de Vercel (la respuesta tiene que llegar).
  let backlinks = { skipped: true };
  const tiempoBacklinks = reloj.tope(MAX_ENLAZADO_MS, 5_000);
  try {
    if (tiempoBacklinks < 8_000) {
      backlinks = { skipped: true, reason: "sin tiempo en el presupuesto" };
    } else {
      backlinks = await backlinkOldPosts({
        newPostId: post.id,
        newPostCategory: category,
        newPostTitle: translationEs.title,
        newSlugEs: translationEs.slug,
        newSlugEn: translationEn?.slug || translationEs.slug,
        newContentEs: translationEs.content,
        timeoutMs: tiempoBacklinks,
      });
    }
  } catch (err) {
    console.error("Backlink falló:", err.message);
    backlinks = { error: err.message };
  }

  // El cuerpo tal y como queda guardado, para comprobar en el correo el enlace
  // a la página del cluster.
  let contenidoFinal = { es: translationEs.content, en: translationEn?.content ?? "" };

  // Enlaces salientes: el post nuevo enlaza a 2-3 posts relacionados de su
  // categoría para no salir huérfano. Best-effort — un fallo no rompe nada.
  let outboundLinks = { skipped: true };
  const tiempoSalientes = reloj.tope(MAX_ENLAZADO_MS, 5_000);
  try {
    if (tiempoSalientes < 8_000) throw new Error("sin tiempo en el presupuesto");
    const out = await computeOutboundLinksForPost({
      postId: post.id,
      category,
      contentEs: translationEs.content,
      contentEn: translationEn?.content || "",
      timeoutMs: tiempoSalientes,
    });
    if (out.added.length > 0) {
      await prisma.post.update({
        where: { id: post.id },
        data: {
          translations: {
            update: [
              { where: { id: translationEs.id }, data: { content: out.contentEs } },
              ...(translationEn
                ? [{ where: { id: translationEn.id }, data: { content: out.contentEn } }]
                : []),
            ],
          },
        },
      });
    }
    if (out.added.length > 0) contenidoFinal = { es: out.contentEs, en: translationEn ? out.contentEn : "" };
    outboundLinks = { added: out.added.length, skippedCount: out.skipped.length };
  } catch (err) {
    console.error("Outbound links falló:", err.message);
    outboundLinks = { error: err.message };
  }

  const postUrl = `https://www.room714.com/es/blog/${translationEs.slug}`;

  // El generador recibe el cluster como obligatorio (applySeoRules lo fuerza),
  // así que draft.seo.cluster coincide con el del plan.
  const seoCorreo = {
    cluster,
    clusterName: CLUSTERS[cluster]?.name.es ?? null,
    busqueda: draft.seo?.targetQuery?.es ?? null,
    busquedaDeLaLista: objetivo,
    sinBusquedas,
    clusterDelDia: dia?.cluster ?? null,
    sinEnlaceCluster: ["es", "en"].filter(
      (lang) => cluster && !contenidoFinal[lang].includes(`href="${clusterHref(cluster, lang)}"`),
    ),
  };

  let emailResult = { skipped: true };
  if (sendEmail) {
    emailResult = await sendDraftReadyEmail({
      post,
      translationEs,
      category,
      postUrl,
      seo: seoCorreo,
    });

    // linkedinVariants no se pasa: a las 06:00 (cuando corre esta función)
    // todavía no existen — se generan a las 08:30, en generateTakesForToday,
    // después de la ventana de revisión manual. El parámetro por defecto ([])
    // hace que sendDraftReadyEmail omita sola la sección de LinkedIn del correo.
  }

  return {
    skipped: false,
    postId: post.id,
    category,
    cluster,
    clusterName: CLUSTERS[cluster].name.es,
    plan: planResumen,
    title_es: translationEs.title,
    slug_es: translationEs.slug,
    image: cover.url,
    imageAttribution: cover.attribution,
    scheduledFor: publishDate.toISOString(),
    trendingItemsUsed: trending.length,
    trendingBySources: summarizeSources(trending),
    recentPostsConsidered: Math.min(corpus.length, 10),
    usage: draft.usage,
    // Cluster, búsqueda objetivo y avisos de las reglas de posicionamiento
    // (seo/posicionamiento.md), para la revisión manual.
    seo: draft.seo,
    seoCorreo,
    email: emailResult,
    backlinks,
    outboundLinks,
  };
}

/* ─── Tomas de LinkedIn del artículo de hoy ──────────────────────────────────
 * Corre a las 08:30 de lunes y miércoles, después de la ventana de revisión
 * manual (08:00-08:30). Lee el artículo tal y como haya quedado en base de
 * datos: si se editó, las tomas salen del texto editado; si no se tocó, del
 * generado. Nada bloquea.
 * ────────────────────────────────────────────────────────────────────────── */
// Pura y exportada para poder probarla: es lo único de esta función que el
// modo preview no enseña, y donde viven las dos normalizaciones que importan
// (hashtags ausentes → array vacío, nota en blanco → null).
export function buildTakeRows({ postId, takes, schedules, images }) {
  return takes.map((take, idx) => ({
    postId,
    variant: idx + 1,
    angle: take.angle,
    text: take.text,
    hashtags: take.hashtags || [],
    imageBlobUrl: images[idx],
    imageQuery: take.image_query,
    crossNote: take.cross_note?.trim() || null,
    scheduledFor: schedules[idx],
  }));
}

export async function generateTakesForToday({ preview = false } = {}) {
  const { start, end } = madridDayRange(new Date());

  // `take: 2` y no `findFirst` para poder avisar si hay más de un candidato.
  // El desempate por id es imprescindible: `nextMadridSlot` pone segundos y
  // milisegundos a cero, así que dos generaciones del mismo día empatan al
  // milisegundo en `date` y sin él ganaría una cualquiera — normalmente la
  // más antigua, es decir, el artículo que se descartó al regenerar.
  const candidatos = await prisma.post.findMany({
    where: {
      source: "AUTO",
      published: true,
      date: { gte: start, lte: end },
    },
    include: { translations: true, linkedinVariants: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 2,
  });

  const post = candidatos[0];

  if (candidatos.length > 1) {
    console.warn(
      `generateTakesForToday: hay ${candidatos.length} artículos AUTO publicados hoy; se usa el ${post.id}, el más reciente`,
    );
  }

  if (!post) {
    return {
      skipped: true,
      reason: `No hay artículo AUTO publicado entre ${start.toISOString()} y ${end.toISOString()}`,
    };
  }

  // El preview no escribe, así que no le aplica la idempotencia: tiene que
  // poder enseñar qué saldría también en un día ya procesado, aunque ese post
  // ya tenga tomas guardadas.
  if (!preview && post.linkedinVariants.length > 0) {
    return {
      skipped: true,
      postId: post.id,
      reason: `El post ${post.id} ya tiene ${post.linkedinVariants.length} tomas`,
    };
  }

  const translationEs = post.translations.find((t) => t.lang === "es");
  if (!translationEs) {
    return {
      skipped: true,
      postId: post.id,
      reason: `El post ${post.id} no tiene traducción española`,
    };
  }

  const count = takeCountFor(post.date);
  const crossActions = crossActionsFor(post.date);
  const schedules = variantScheduleFor(post.date);
  // Constante y no NEXTAUTH_URL: esta URL entra en el prompt de un texto que
  // se publica sin revisión, y desde local NEXTAUTH_URL es localhost.
  const articleUrl = `https://www.room714.com/es/blog/${translationEs.slug}`;

  const { takes, usage } = await generateLinkedInTakes({
    articleTitle: translationEs.title,
    articleContentEs: translationEs.content,
    articleUrl,
    count,
    crossActions,
  });

  const describe = (take, idx) => ({
    take: idx + 1,
    angle: take.angle,
    canal: channelForVariant({ postPublishDate: post.date, variant: idx + 1 }),
    cross: crossActions[idx],
    scheduledFor: schedules[idx].toISOString(),
  });

  // Preview: enseña qué se publicaría y cuándo, sin descargar imágenes ni
  // escribir en base de datos. Es la forma de validar un cambio sin ensuciar.
  if (preview) {
    return {
      preview: true,
      postId: post.id,
      articleTitle: translationEs.title,
      count,
      existingTakes: post.linkedinVariants.length,
      usage,
      takes: takes.map((take, idx) => ({
        ...describe(take, idx),
        text: take.text,
        hashtags: take.hashtags,
        crossNote: take.cross_note?.trim() || null,
      })),
    };
  }

  // Una imagen por toma, con su propia consulta. Best-effort: si Unsplash
  // falla, se usa la portada del artículo, como hacía el flujo anterior.
  const datePrefix = new Date().toISOString().split("T")[0];
  const images = await Promise.all(
    takes.map(async (take, idx) => {
      try {
        const img = await fetchAndStoreCoverImage(
          take.image_query,
          `${datePrefix}-li${idx + 1}`,
          { fallbackQuery: fallbackQueryForCategory(post.category) },
        );
        return img.url;
      } catch (err) {
        console.error(
          `Imagen de la toma ${idx + 1} falló (query "${take.image_query}"):`,
          err.message,
        );
        return post.image;
      }
    }),
  );

  try {
    await prisma.linkedInVariant.createMany({
      data: buildTakeRows({ postId: post.id, takes, schedules, images }),
    });
  } catch (err) {
    // Otra ejecución solapada llegó antes. El @@unique aborta la sentencia
    // entera, así que no queda media semana escrita: o están todas o ninguna.
    if (err.code === "P2002") {
      return {
        skipped: true,
        postId: post.id,
        reason: "otra ejecución escribió las tomas primero",
      };
    }
    throw err;
  }

  return {
    skipped: false,
    postId: post.id,
    articleTitle: translationEs.title,
    count,
    usage,
    takes: takes.map(describe),
  };
}
