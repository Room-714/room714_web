import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

let locales = ["en", "es"];

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // 1. REDIRECCIÓN DE DOMINIO (.es -> .com) CON STATUS 301
  // Forzamos el 301 para que Google valide el cambio de dirección
  if (hostname.includes("room714.es")) {
    // Si podemos, lo mandamos directo a /en para evitar múltiples saltos
    const destination = `https://www.room714.com/en${pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(destination, { status: 301 });
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

  // 3. EXCLUIR RUTAS DE AUTENTICACIÓN
  if (pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // 4. LÓGICA DE IDIOMAS (Para el tráfico que ya está en el .com)
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) return NextResponse.next();

  // Redirección por defecto a /en si no hay idioma
  const url = request.nextUrl.clone();
  url.pathname = `/en${pathname}`;

  // Usamos 301 aquí también para consolidar la estructura en Google
  return NextResponse.redirect(url, { status: 301 });
}

export default proxy;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.mp4$|.*\\.webm$|.*\\.ogg$).*)",
  ],
};
