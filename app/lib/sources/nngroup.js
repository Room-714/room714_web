import {
  parseRssItems,
  fetchRss,
  filterRecent,
  dedupeByTitle,
  sortByDateDesc,
} from "./_rss";

export const SOURCE_NAME = "Nielsen Norman Group";

// Toda la publicación de NNG es UX/usabilidad. Solo entrega items para UX.
// Para las otras categorías devuelve [] (no fuerza relevancia).
export async function getTrendingForCategory(category, maxItems = 6) {
  if (category !== "UX") return [];

  const xml = await fetchRss("https://www.nngroup.com/feed/rss/");
  if (!xml) return [];

  const items = parseRssItems(xml).map((it) => ({
    ...it,
    source: SOURCE_NAME,
  }));

  const recent = filterRecent(items, 14);
  const unique = dedupeByTitle(recent);
  return sortByDateDesc(unique).slice(0, maxItems);
}
