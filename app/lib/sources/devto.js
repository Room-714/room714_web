import {
  parseRssItems,
  fetchRss,
  filterRecent,
  dedupeByTitle,
  sortByDateDesc,
} from "./_rss";

export const SOURCE_NAME = "dev.to";

const CATEGORY_TAGS = {
  TECH: ["ai", "programming", "webdev", "machinelearning"],
  PRODUCT: ["startup", "productmanagement", "business", "entrepreneurship"],
  UX: ["ux", "userexperience", "accessibility", "usability"],
  DESIGN: ["design", "ui", "css", "productdesign"],
};

async function fetchTag(tag) {
  const xml = await fetchRss(`https://dev.to/feed/tag/${tag}`);
  if (!xml) return [];
  return parseRssItems(xml).map((it) => ({
    ...it,
    source: SOURCE_NAME,
    sourceTag: tag,
  }));
}

export async function getTrendingForCategory(category, maxItems = 12) {
  const tags = CATEGORY_TAGS[category];
  if (!tags) return [];

  const lists = await Promise.all(tags.map((t) => fetchTag(t)));
  const all = lists.flat();

  const recent = filterRecent(all, 7);
  const unique = dedupeByTitle(recent);
  return sortByDateDesc(unique).slice(0, maxItems);
}
