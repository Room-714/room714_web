import { NextResponse } from "next/server";

// Sirve /indexnow.txt en la raíz del dominio para que IndexNow defina
// el scope verificado como TODO el sitio (no sólo /api/...). Corre antes
// que el i18n auto-redirect de Vercel, así sortea la 301 a /en/.
export function middleware(request) {
  if (request.nextUrl.pathname === "/indexnow.txt") {
    const key = process.env.INDEXNOW_KEY;
    if (!key) {
      return new NextResponse("INDEXNOW_KEY no configurada", { status: 500 });
    }
    return new NextResponse(key, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  }
}

export const config = {
  matcher: "/indexnow.txt",
};
