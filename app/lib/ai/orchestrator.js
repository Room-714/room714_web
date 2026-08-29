import { prisma } from "@/app/lib/prisma";
import {
  categoryForDate,
  getPublishedTitles,
  getRecentPosts,
} from "./topicRotation";
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
import { computeOutboundLinksForPost } from "./internalLinker";
import { sendDraftReadyEmail } from "@/app/lib/notifications/draftReady";
import { madridDayRange, nextMadridSlot } from "@/app/lib/time/madrid";
import {
  channelForVariant,
  crossActionsFor,
  takeCountFor,
  variantScheduleFor,
} from "@/app/lib/time/linkedinSchedule";

// El artículo se hace visible a las 07:30 de Madrid: el blog filtra date <= now,
// así que esta fecha ES la hora de publicación. La revisión manual va de 08:00
// a 08:30 y las tomas de LinkedIn se generan a las 08:30, en un cron aparte.
const PUBLISH_HOUR_MADRID = 7;
const PUBLISH_MINUTE_MADRID = 30;

function slugifyFallback(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

async function ensureUniqueSlug(slug, lang) {
  let candidate = slug;
  let i = 2;
  while (await prisma.postTranslation.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${i}`;
    i += 1;
    if (i > 50) throw new Error(`No se pudo generar slug único para ${slug}`);
  }
  return candidate;
}

export async function generateDraftForToday({ categoryOverride, sendEmail = true } = {}) {
  const today = new Date();
  const publishDate = nextMadridSlot(PUBLISH_HOUR_MADRID, PUBLISH_MINUTE_MADRID);
  const category = categoryOverride ?? categoryForDate(today);

  if (!category) {
    return {
      skipped: true,
      reason: "No es día laborable (sin rotación de categoría)",
    };
  }

  const [trending, recentPosts, publishedCorpus] = await Promise.all([
    getCrossSourceTrending(category),
    getRecentPosts(10),
    getPublishedTitles(),
  ]);

  const draft = await generatePostDraft({
    category,
    trending,
    recentPosts,
    publishedCorpus,
  });

  const datePrefix = today.toISOString().split("T")[0];
  const cover = await fetchAndStoreCoverImage(draft.image_query, datePrefix, {
    fallbackQuery: fallbackQueryForCategory(category),
  });

  const slugEs = await ensureUniqueSlug(
    draft.slug_es || slugifyFallback(draft.title_es),
    "es",
  );
  const slugEn = await ensureUniqueSlug(
    draft.slug_en || slugifyFallback(draft.title_en),
    "en",
  );

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
          },
          {
            lang: "en",
            slug: slugEn,
            title: draft.title_en,
            tags: draft.tags_en,
            content: draft.content_en,
            metaDescription: draft.meta_description_en,
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
  let backlinks = { skipped: true };
  try {
    backlinks = await backlinkOldPosts({
      newPostId: post.id,
      newPostCategory: category,
      newPostTitle: translationEs.title,
      newSlugEs: translationEs.slug,
      newSlugEn: translationEn?.slug || translationEs.slug,
      newContentEs: translationEs.content,
    });
  } catch (err) {
    console.error("Backlink falló:", err.message);
    backlinks = { error: err.message };
  }

  // Enlaces salientes: el post nuevo enlaza a 2-3 posts relacionados de su
  // categoría para no salir huérfano. Best-effort — un fallo no rompe nada.
  let outboundLinks = { skipped: true };
  try {
    const out = await computeOutboundLinksForPost({
      postId: post.id,
      category,
      contentEs: translationEs.content,
      contentEn: translationEn?.content || "",
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
    outboundLinks = { added: out.added.length, skippedCount: out.skipped.length };
  } catch (err) {
    console.error("Outbound links falló:", err.message);
    outboundLinks = { error: err.message };
  }

  const postUrl = `https://www.room714.com/es/blog/${translationEs.slug}`;

  let emailResult = { skipped: true };
  if (sendEmail) {
    emailResult = await sendDraftReadyEmail({
      post,
      translationEs,
      category,
      postUrl,
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
    title_es: translationEs.title,
    slug_es: translationEs.slug,
    image: cover.url,
    imageAttribution: cover.attribution,
    scheduledFor: publishDate.toISOString(),
    trendingItemsUsed: trending.length,
    trendingBySources: summarizeSources(trending),
    recentPostsConsidered: recentPosts.length,
    usage: draft.usage,
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
