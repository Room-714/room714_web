import { matchesKeywords, dedupeByTitle } from "./_rss";

export const SOURCE_NAME = "Hacker News";

const CATEGORY_KEYWORDS = {
  TECH: [
    "ai",
    "llm",
    "gpt",
    "claude",
    "ml",
    "machine learning",
    "code",
    "programming",
    "framework",
    "kubernetes",
    "docker",
    "rust",
    "python",
    "javascript",
    "compiler",
    "open source",
    "library",
    "database",
    "linux",
    "github",
    "cli",
  ],
  PRODUCT: [
    "product",
    "startup",
    "founder",
    "b2b",
    "saas",
    "growth",
    "pmf",
    "jobs-to-be-done",
    "jtbd",
    "pricing",
    "roadmap",
    "metrics",
    "retention",
    "monetization",
  ],
  UX: [
    "ux",
    "usability",
    "accessibility",
    "user experience",
    "user research",
    "user interface",
    "interaction design",
  ],
  DESIGN: [
    "design",
    "ui",
    "css",
    "typography",
    "branding",
    "design system",
    "figma",
    "sketch",
    "visual",
  ],
};

async function fetchAlgoliaHN(timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url =
      "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=80";
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Room714-BlogBot/1.0" },
    });
    if (!res.ok) {
      console.warn(`HN Algolia: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data.hits ?? [];
  } catch (err) {
    console.warn(`HN Algolia: ${err.message}`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function getTrendingForCategory(category, maxItems = 8) {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords) return [];

  const hits = await fetchAlgoliaHN();
  if (hits.length === 0) return [];

  const items = hits
    .filter((h) => h.title)
    .map((h) => ({
      title: h.title,
      description: h.story_text
        ? h.story_text.replace(/<[^>]*>/g, "").slice(0, 280)
        : "",
      pubDate: h.created_at,
      link: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      source: SOURCE_NAME,
    }));

  const matching = items.filter((it) =>
    matchesKeywords(`${it.title} ${it.description}`, keywords),
  );

  return dedupeByTitle(matching).slice(0, maxItems);
}
