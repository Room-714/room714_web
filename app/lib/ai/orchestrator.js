import { prisma } from "@/app/lib/prisma";
import { categoryForDate, getRecentPosts } from "./topicRotation";
import {
  getCrossSourceTrending,
  summarizeSources,
} from "@/app/lib/sources/aggregator";
import { fetchAndStoreCoverImage } from "@/app/lib/sources/unsplash";
import { generatePostDraft } from "./generator";
import { sendDraftReadyEmail } from "@/app/lib/notifications/draftReady";
import { nextMadridSlot } from "@/app/lib/time/madrid";

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
  const cover = await fetchAndStoreCoverImage(draft.image_query, datePrefix);

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
            linkedinPost: draft.linkedin_post_es,
            linkedinHashtags: draft.linkedin_hashtags_es,
          },
          {
            lang: "en",
            slug: slugEn,
            title: draft.title_en,
            tags: draft.tags_en,
            content: draft.content_en,
            metaDescription: draft.meta_description_en,
            linkedinPost: draft.linkedin_post_en,
            linkedinHashtags: draft.linkedin_hashtags_en,
          },
        ],
      },
    },
    include: { translations: true },
  });

  const translationEs = post.translations.find((t) => t.lang === "es");

  let emailResult = { skipped: true };
  if (sendEmail) {
    emailResult = await sendDraftReadyEmail({
      post,
      translationEs,
      category,
    });
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
  };
}
