// IndexNow ownership proof. The body must contain exactly the key value,
// matching the env var INDEXNOW_KEY. Served as plain text so Bing/Yandex
// can verify domain ownership when we POST URL notifications.
export const dynamic = "force-static";

const KEY = "38dfc9af13f339525c11b480779e3599";

export function GET() {
  return new Response(KEY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
