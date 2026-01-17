// /proxy.js (RAÍZ DEL PROYECTO)
import { NextResponse } from "next/server";

let locales = ["en", "es"];

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // 1. Verificar si la URL ya tiene el idioma
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (pathnameHasLocale) return;

  // 2. Si no tiene idioma, forzar redirección a /en
  const locale = "en";
  request.nextUrl.pathname = `/${locale}${pathname}`;

  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Este matcher ignora archivos estáticos, imágenes y favicon
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
