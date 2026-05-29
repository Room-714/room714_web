// IndexNow ownership proof. Returns the IndexNow key so Bing/Yandex
// can verify domain ownership when we POST URL notifications.
// Single source of truth: INDEXNOW_KEY env var.
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return new Response("INDEXNOW_KEY no configurada", { status: 500 });
  }
  return new Response(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
