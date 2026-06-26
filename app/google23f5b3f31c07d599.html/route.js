// Google site verification. El static file en /public/ es interceptado por
// el i18n auto-redirect de Vercel (301 a /en/...). Servido como route
// handler para sortear el redirect, igual que llms.txt.
export const revalidate = 86400;

const BODY = "google-site-verification: google23f5b3f31c07d599.html\n";

export async function GET() {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
