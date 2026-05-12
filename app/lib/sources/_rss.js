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

export function stripTags(html) {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTag(xml, tag) {
  const cdata = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`,
  ).exec(xml);
  if (cdata) return cdata[1];
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  return plain ? plain[1] : "";
}

export function parseRssItems(xml, descriptionMaxLength = 280) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const itemXml = m[1];
    const title = stripTags(extractTag(itemXml, "title"));
    const description = stripTags(extractTag(itemXml, "description")).substring(
      0,
      descriptionMaxLength,
    );
    const pubDate = extractTag(itemXml, "pubDate");
    const link = extractTag(itemXml, "link").trim();
    if (title) items.push({ title, description, pubDate, link });
  }
  return items;
}

export async function fetchRss(url, { timeoutMs = 12000, userAgent = "Room714-BlogBot/1.0" } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": userAgent },
    });
    if (!res.ok) {
      console.warn(`RSS ${url}: ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`RSS ${url}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function filterRecent(items, days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return items.filter((it) => {
    if (!it.pubDate) return true;
    const ts = Date.parse(it.pubDate);
    return Number.isNaN(ts) ? true : ts >= cutoff;
  });
}

export function dedupeByTitle(items, keyLength = 80) {
  const seen = new Set();
  return items.filter((it) => {
    const key = it.title.toLowerCase().slice(0, keyLength);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortByDateDesc(items) {
  return [...items].sort((a, b) => {
    const ta = Date.parse(a.pubDate) || 0;
    const tb = Date.parse(b.pubDate) || 0;
    return tb - ta;
  });
}

export function matchesKeywords(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}
