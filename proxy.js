import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

let locales = ["en", "es"];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // 1. PROTECCIÓN DE ADMIN
  if (pathname.startsWith("/admin")) {
    const session = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!session) {
      const loginUrl = new URL("/auth/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // --- NUEVO: EXCLUIR RUTAS DE AUTENTICACIÓN DEL IDIOMA ---
  // Si la ruta es /auth/login, no le pongas /en/ delante
  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // 2. LÓGICA DE IDIOMAS
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) return NextResponse.next();

  const locale = "en";
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;

  return NextResponse.redirect(url);
}

export default proxy;

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$).*)",
  ],
};
