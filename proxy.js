import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

let locales = ["en", "es"];

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host");

  // 1. REDIRECCIÓN DE DOMINIO (.es -> .com)
  // Esto "fuerza" a Google a unificar ambos dominios en el .com
  if (hostname && hostname.includes("room714.es")) {
    return NextResponse.redirect(
      `https://www.room714.com${pathname}${request.nextUrl.search}`,
      { status: 301 },
    );
  }

  // 2. PROTECCIÓN DE ADMIN
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

  // 3. EXCLUIR RUTAS DE AUTENTICACIÓN DEL IDIOMA
  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // 4. LÓGICA DE IDIOMAS
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) return NextResponse.next();

  // Si no tiene idioma, redirigimos al default (en)
  const locale = "en";
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;

  return NextResponse.redirect(url, { status: 301 });
}

export default proxy;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.mp4$|.*\\.webm$|.*\\.ogg$).*)",
  ],
};
