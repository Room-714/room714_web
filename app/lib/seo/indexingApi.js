import { getAccessToken } from "./googleAuth";

const INDEXING_ENDPOINT =
  "https://indexing.googleapis.com/v3/urlNotifications:publish";
const SCOPE = "https://www.googleapis.com/auth/indexing";

export async function notifyUrlUpdated(url) {
  const token = await getAccessToken(SCOPE);
  const res = await fetch(INDEXING_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Indexing API ${res.status} para ${url}: ${errText}`);
  }

  return res.json();
}

export function buildPostUrls(esSlug, enSlug) {
  const base = "https://www.room714.com";
  return [
    esSlug ? `${base}/es/blog/${esSlug}` : null,
    enSlug ? `${base}/en/blog/${enSlug}` : null,
  ].filter(Boolean);
}
