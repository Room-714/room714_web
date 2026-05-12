const CATEGORY_TAGS = {
  TECH: ["technology", "artificial-intelligence", "software-engineering", "programming"],
  PRODUCT: ["product-management", "startup", "jobs-to-be-done", "product-strategy"],
  UX: ["ux", "ux-design", "user-experience", "usability"],
  DESIGN: ["design", "design-thinking", "ui-design", "product-design"],
};

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html) {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

function extractTag(xml, tag) {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`).exec(xml);
  if (cdata) return cdata[1];
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  return plain ? plain[1] : "";
}

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const itemXml = m[1];
    const title = stripTags(extractTag(itemXml, "title"));
    const description = stripTags(extractTag(itemXml, "description")).substring(0, 280);
    const pubDate = extractTag(itemXml, "pubDate");
    const link = extractTag(itemXml, "link").trim();
    if (title) items.push({ title, description, pubDate, link });
  }
  return items;
}

async function fetchMediumTag(tag, signal) {
  const url = `https://medium.com/feed/tag/${tag}`;
  try {
    const res = await fetch(url, {
      signal,
      headers: { "User-Agent": "Room714-BlogBot/1.0" },
    });
    if (!res.ok) {
      console.warn(`Medium RSS ${tag}: ${res.status}`);
      return [];
    }
    const xml = await res.text();
    return parseRssItems(xml).map((it) => ({ ...it, sourceTag: tag }));
  } catch (err) {
    console.warn(`Medium RSS ${tag} fallo:`, err.message);
    return [];
  }
}

export async function getTrendingForCategory(category, maxItems = 12) {
  const tags = CATEGORY_TAGS[category];
  if (!tags) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const lists = await Promise.all(tags.map((t) => fetchMediumTag(t, controller.signal)));
    const all = lists.flat();

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = all.filter((it) => {
      if (!it.pubDate) return true;
      const ts = Date.parse(it.pubDate);
      return Number.isNaN(ts) ? true : ts >= sevenDaysAgo;
    });

    const seen = new Set();
    const unique = recent.filter((it) => {
      const key = it.title.toLowerCase().slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => {
      const ta = Date.parse(a.pubDate) || 0;
      const tb = Date.parse(b.pubDate) || 0;
      return tb - ta;
    });

    return unique.slice(0, maxItems);
  } finally {
    clearTimeout(timeout);
  }
}
