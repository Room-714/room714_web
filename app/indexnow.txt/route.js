// IndexNow ownership proof. Returns the IndexNow key so Bing/Yandex
// can verify domain ownership when we POST URL notifications.
export const revalidate = 86400;

const KEY = "38dfc9af13f339525c11b480779e3599";

export async function GET() {
  return new Response(KEY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
