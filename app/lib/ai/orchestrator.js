import { prisma } from "@/app/lib/prisma";
import { categoryForDate, getRecentPosts } from "./topicRotation";
import {
  getCrossSourceTrending,
  summarizeSources,
} from "@/app/lib/sources/aggregator";
import {
  fetchAndStoreCoverImage,
  fallbackQueryForCategory,
} from "@/app/lib/sources/unsplash";
import { generatePostDraft } from "./generator";
import { backlinkOldPosts } from "./backlinker";
import { sendDraftReadyEmail } from "@/app/lib/notifications/draftReady";
import { nextMadridSlot } from "@/app/lib/time/madrid";
import { variantScheduleFor } from "@/app/lib/time/linkedinSchedule";

const PUBLISH_HOUR_MADRID = 10;

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
  const publishDate = nextMadridSlot(PUBLISH_HOUR_MADRID);
  const category = categoryOverride ?? categoryForDate(today);

  if (!category) {
    return {
      skipped: true,
      reason: "No es día laborable (sin rotación de categoría)",
    };
  }

  const [trending, recentPosts] = await Promise.all([
    getCrossSourceTrending(category),
    getRecentPosts(10),
  ]);

  const draft = await generatePostDraft({ category, trending, recentPosts });

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

  // Fetch 3 imágenes adicionales para las variantes de LinkedIn (una por
  // variante, con su image_query propia). Best-effort: si alguna falla,
  // usamos la imagen del post como fallback.
  const variants = draft.linkedin_variants || [];
  const variantSchedules = variantScheduleFor(publishDate);
  const variantImages = await Promise.all(
    variants.map(async (v, idx) => {
      try {
        const img = await fetchAndStoreCoverImage(
          v.image_query,
          `${datePrefix}-li${idx + 1}`,
          { fallbackQuery: fallbackQueryForCategory(category) },
        );
        return img.url;
      } catch (err) {
        console.error(
          `Imagen variante ${idx + 1} falló (query "${v.image_query}"):`,
          err.message,
        );
        return cover.url;
      }
    }),
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
      linkedinVariants: {
        create: variants.map((v, idx) => ({
          variant: idx + 1,
          angle: v.angle,
          text: v.text,
          hashtags: v.hashtags || [],
          imageBlobUrl: variantImages[idx],
          imageQuery: v.image_query,
          scheduledFor: variantSchedules[idx],
        })),
      },
    },
    include: { translations: true, linkedinVariants: true },
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

  const postUrl = `https://www.room714.com/es/blog/${translationEs.slug}`;

  let emailResult = { skipped: true };
  if (sendEmail) {
    emailResult = await sendDraftReadyEmail({
      post,
      translationEs,
      category,
      linkedinVariants: post.linkedinVariants,
      postUrl,
    });

    // Make reactivado (jul 2026): las variantes se quedan en sent=false para
    // que /api/cron/publish-linkedin las publique automáticamente a su hora.
    // El email es solo informativo (muestra qué se publicará y cuándo).
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
    linkedinVariants: post.linkedinVariants.map((v) => ({
      variant: v.variant,
      angle: v.angle,
      scheduledFor: v.scheduledFor.toISOString(),
    })),
  };
}
