"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation"; // Añadimos usePathname
import { Menu, X, Globe } from "lucide-react";

export default function Navbar({ dict, isDark = false }) {
  const [isOpen, setIsOpen] = useState(false);

  const params = useParams();
  const pathname = usePathname(); // Obtenemos la ruta actual (ej: /es/about)
  const lang = params?.lang || "en";

  // Función para cambiar el idioma manteniendo la página actual
  const getLanguagePath = (targetLang) => {
    if (!pathname) return `/${targetLang}`;
    // Reemplazamos el idioma actual por el nuevo en la URL
    return pathname.replace(`/${lang}`, `/${targetLang}`);
  };

  const navLinks = [
    { name: dict.nav.projects, href: `/${lang}/projects` },
    { name: dict.nav.about, href: `/${lang}/about` },
    { name: dict.nav.contact, href: `/${lang}/contact` },
  ];

  return (
    <header
      className={`relative z-50 flex justify-between items-center px-6 py-8 md:px-10 md:py-10 lg:px-24 lg:py-12 transition-all duration-300 ${
        isDark ? "bg-black text-white" : "bg-white text-black"
      }`}
    >
      {/* LOGO */}
      <Link
        href={`/${lang}`}
        className="w-28 h-8 md:w-40 md:h-12 lg:w-60 lg:h-16 relative transition-all duration-300"
      >
        <Image
          src={isDark ? "/logo-dark.svg" : "/logo.svg"}
          alt="room714 logo"
          fill
          className="object-contain object-left"
          priority
        />
      </Link>

      {/* MENÚ DESKTOP + SELECTOR IDIOMA */}
      <div className="hidden md:flex items-center gap-8 lg:gap-12">
        <nav className="flex items-center gap-8 lg:gap-10">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="font-title md:text-xl lg:text-2xl lg:font-medium tracking-wider hover:text-red-500 transition-all duration-300"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Selector de Idioma Desktop */}
        <div className="flex items-center gap-3 border-l pl-8 border-gray-500/30 font-body text-sm tracking-widest uppercase">
          <Link
            href={getLanguagePath("en")}
            className={`transition-all ${
              lang === "en"
                ? "text-red-600 font-bold"
                : "opacity-50 hover:opacity-100"
            }`}
          >
            EN
          </Link>
          <span className="opacity-20">|</span>
          <Link
            href={getLanguagePath("es")}
            className={`transition-all ${
              lang === "es"
                ? "text-red-600 font-bold"
                : "opacity-50 hover:opacity-100"
            }`}
          >
            ES
          </Link>
        </div>
      </div>

      {/* MENÚ MÓVIL: Icono */}
      <button className="md:hidden p-1" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X size={32} /> : <Menu size={32} strokeWidth={2.5} />}
      </button>

      {/* MENÚ MÓVIL: Desplegable */}
      {isOpen && (
        <div
          className={`absolute top-full left-0 w-full border-b flex flex-col p-6 gap-6 md:hidden animate-in slide-in-from-top duration-300 z-50 ${
            isDark ? "bg-black border-gray-800" : "bg-white border-gray-200"
          }`}
        >
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="font-title text-2xl tracking-wider"
            >
              {link.name}
            </Link>
          ))}

          {/* Selector de Idioma Móvil */}
          <div className="flex items-center gap-6 pt-4 border-t border-gray-500/20 uppercase font-bold tracking-widest text-sm">
            <Link
              href={getLanguagePath("en")}
              onClick={() => setIsOpen(false)}
              className={lang === "en" ? "text-red-600" : ""}
            >
              EN
            </Link>
            <Link
              href={getLanguagePath("es")}
              onClick={() => setIsOpen(false)}
              className={lang === "es" ? "text-red-600" : ""}
            >
              ES
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
