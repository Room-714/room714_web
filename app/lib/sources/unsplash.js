import { put } from "@vercel/blob";

async function searchUnsplash(query) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error("UNSPLASH_ACCESS_KEY no configurada");

  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "10");
  url.searchParams.set("orientation", "squarish");
  url.searchParams.set("content_filter", "high");

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (!res.ok) throw new Error(`Unsplash search ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

async function downloadImage(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Descarga imagen ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function triggerDownloadTracking(downloadLocation) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !downloadLocation) return;
  try {
    await fetch(downloadLocation, {
      headers: { Authorization: `Client-ID ${key}` },
    });
  } catch (err) {
    console.warn("Unsplash download tracking falló:", err.message);
  }
}

const CATEGORY_FALLBACK_QUERY = {
  TECH: "technology",
  DESIGN: "design",
  PRODUCT: "product",
  UX: "user experience",
};

export function fallbackQueryForCategory(category) {
  return CATEGORY_FALLBACK_QUERY[category] ?? "abstract";
}

function buildFallbackQueries(originalQuery, extraFallback) {
  const words = (originalQuery ?? "").trim().split(/\s+/).filter(Boolean);
  const variants = [];
  for (let i = 1; i < words.length; i++) {
    variants.push(words.slice(i).join(" "));
  }
  if (extraFallback) variants.push(extraFallback);
  return variants;
}

export async function fetchAndStoreCoverImage(query, datePrefix, options = {}) {
  const { fallbackQuery } = options;
  const queries = [query, ...buildFallbackQueries(query, fallbackQuery)];

  let results = [];
  for (const q of queries) {
    const r = await searchUnsplash(q);
    if (r.length > 0) {
      results = r;
      if (q !== query) {
        console.warn(`Unsplash: query original "${query}" sin resultados, usando fallback "${q}"`);
      }
      break;
    }
    console.warn(`Unsplash: sin resultados para "${q}"`);
  }
  if (results.length === 0) {
    throw new Error(`Unsplash: sin resultados para ninguna variante (${queries.join(" | ")})`);
  }

  const pick = results[Math.floor(Math.random() * Math.min(results.length, 5))];
  const imageUrl = `${pick.urls.raw}&w=800&h=800&fit=crop&fm=jpg&q=80`;

  const [buffer] = await Promise.all([
    downloadImage(imageUrl),
    triggerDownloadTracking(pick.links?.download_location),
  ]);

  const seconds = new Date().getSeconds().toString().padStart(2, "0");
  const millis = new Date().getMilliseconds().toString().slice(0, 2);
  const fileName = `blog/${datePrefix}-${seconds}${millis}.jpg`;

  const blob = await put(fileName, buffer, {
    access: "public",
    contentType: "image/jpeg",
  });

  return {
    url: blob.url,
    attribution: {
      name: pick.user?.name ?? "Unsplash",
      username: pick.user?.username ?? "",
      link: pick.links?.html ?? "",
    },
  };
}
