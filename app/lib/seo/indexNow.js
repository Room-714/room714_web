const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const HOST = "www.room714.com";

export async function notifyIndexNow(urls) {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    throw new Error("INDEXNOW_KEY no configurada");
  }

  const urlList = Array.isArray(urls) ? urls : [urls];
  if (urlList.length === 0) return { status: 200, skipped: true };

  const res = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host: HOST,
      key,
      keyLocation: `https://${HOST}/indexnow.txt`,
      urlList,
    }),
  });

  if (res.status !== 200 && res.status !== 202) {
    const errText = await res.text();
    throw new Error(`IndexNow ${res.status}: ${errText}`);
  }

  return { status: res.status, count: urlList.length };
}
