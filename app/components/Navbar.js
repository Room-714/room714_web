"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";

export default function Navbar({
  dict,
  isDark = false,
  alternatePaths = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const params = useParams();
  const pathname = usePathname();
  const lang = params?.lang || "en";

  const getLanguagePath = (targetLang) => {
    // Si estamos en un post y tenemos las rutas alternativas, las usamos
    if (alternatePaths && alternatePaths[targetLang]) {
      return alternatePaths[targetLang];
    }

    // Si no, usamos la lógica por defecto de reemplazar el código de idioma
    if (!pathname) return `/${targetLang}`;
    return pathname.replace(`/${lang}`, `/${targetLang}`);
  };

  const navLinks = [
    { name: dict.nav.home, href: `/${lang}/` },
    { name: dict.nav.projects, href: `/${lang}/projects` },
    { name: dict.nav.about, href: `/${lang}/about` },
    { name: dict.nav.diagnostic, href: `/${lang}/diagnostic` },
  ];

  return (
    <header
      className={`relative z-50 flex justify-between items-center px-6 py-6 sm:px-8 sm:py-8 md:px-10 md:py-10 lg:px-16 lg:py-16 transition-all duration-300 ${
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
      <div className="hidden md:flex items-center gap-7 lg:gap-10">
        <nav className="flex items-center gap-6 lg:gap-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`font-title md:text-lg lg:text-xl lg:font-medium transition-all duration-300 ${
                  isActive ? "text-red-600 font-bold" : "hover:text-red-500"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Selector de Idioma Desktop */}
        <div className="relative border-l pl-8 border-gray-500/30 font-hand text-lg uppercase">
          {/* Botón que controla el dropdown */}
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-2 hover:text-red-600 transition-colors py-1"
          >
            <span className="font-bold">{lang}</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-300 ${langOpen ? "rotate-180" : ""}`}
            />
          </button>

          {/* Menú Desplegable */}
          {langOpen && (
            <>
              {/* Cierre al hacer clic fuera */}
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setLangOpen(false)}
              />

              <div className="absolute right-0 mt-4 w-32 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col py-1">
                  {["en", "es"].map((l) => (
                    <Link
                      key={l}
                      href={getLanguagePath(l)}
                      onClick={() => setLangOpen(false)}
                      className={`px-4 py-3 text-left transition-colors hover:bg-gray-50 text-[12px] ${
                        lang === l
                          ? "text-red-600 font-bold bg-red-50/50"
                          : "text-gray-600 hover:text-black"
                      }`}
                    >
                      {l === "en" ? "ENGLISH" : "ESPAÑOL"}
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
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
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`font-title text-2xl tracking-wider ${
                  isActive ? "text-red-600 font-bold" : ""
                }`}
              >
                {link.name}
              </Link>
            );
          })}

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
