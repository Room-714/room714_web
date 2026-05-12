import {
  parseRssItems,
  fetchRss,
  filterRecent,
  dedupeByTitle,
  sortByDateDesc,
  matchesKeywords,
} from "./_rss";

export const SOURCE_NAME = "Smashing Magazine";

// Smashing publica sobre todo DESIGN/UX/frontend.
// Filtramos por keywords para que solo entregue items relevantes a la categoría del día.
const CATEGORY_KEYWORDS = {
  TECH: [
    "javascript",
    "typescript",
    "react",
    "next",
    "vue",
    "svelte",
    "node",
    "performance",
    "css",
    "html",
    "web",
    "browser",
    "api",
    "framework",
  ],
  PRODUCT: [],
  UX: [
    "ux",
    "user experience",
    "usability",
    "accessibility",
    "a11y",
    "user research",
    "interaction",
  ],
  DESIGN: [
    "design",
    "ui",
    "interface",
    "typography",
    "color",
    "layout",
    "responsive",
    "figma",
    "design system",
    "visual",
    "icon",
    "animation",
  ],
};

export async function getTrendingForCategory(category, maxItems = 6) {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords || keywords.length === 0) return [];

  const xml = await fetchRss("https://www.smashingmagazine.com/feed/");
  if (!xml) return [];

  const items = parseRssItems(xml).map((it) => ({
    ...it,
    source: SOURCE_NAME,
  }));

  const matching = items.filter((it) =>
    matchesKeywords(`${it.title} ${it.description}`, keywords),
  );

  const recent = filterRecent(matching, 21);
  const unique = dedupeByTitle(recent);
  return sortByDateDesc(unique).slice(0, maxItems);
}
