"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Menu, X, ChevronDown, House } from "lucide-react";
import PrimaryButton from "@/app/components/PrimaryButton";
import { path } from "@/app/lib/routes.mjs";

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

  // Empleo baja al footer: conserva su URL y sigue accesible, pero deja de
  // competir por la atención. Y "Qué hacemos" desaparece: su página repetía
  // el tercer bloque de la portada, así que se eliminó.
  const navLinks = [
    // La portada va con casita. El texto se conserva porque lo necesitan el
    // lector de pantalla y las migas de pan del blog.
    { name: dict.nav.home, href: path("home", lang), Icono: House },
    { name: dict.nav.casos, href: path("casos", lang) },
    { name: dict.nav.nosotros, href: path("comoTrabajamos", lang) },
    { name: dict.nav.ideas, href: path("blog", lang) },
  ];

  // "Hablemos" va aparte: es el CTA, con el estilo de PrimaryButton.
  const cta = { name: dict.nav.hablemos, href: path("hablemos", lang) };

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
      <div className="hidden lg:flex items-center gap-4 lg:gap-6 xl:gap-10">
        <nav className="flex items-center gap-3 lg:gap-5 xl:gap-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                aria-label={link.Icono ? link.name : undefined}
                title={link.Icono ? link.name : undefined}
                className={`font-title text-sm lg:text-base xl:text-xl tracking-tight lg:font-medium transition-all duration-300 ${
                  isActive ? "text-red-600 font-bold" : "hover:text-red-500"
                }`}
              >
                {link.Icono ? (
                  <link.Icono size={22} strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  link.name
                )}
              </Link>
            );
          })}
        </nav>

        {/* CTA: el mismo PrimaryButton que ya usa el resto del sitio */}
        <PrimaryButton
          text={cta.name}
          href={cta.href}
          isRed={true}
          track="cta_click"
          trackPlacement="header"
        />

        {/* Selector de Idioma Desktop */}
        <div className="relative border-l pl-4 lg:pl-6 xl:pl-8 border-gray-500/30 font-hand text-base lg:text-lg uppercase">
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
      <button className="lg:hidden p-1" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X size={32} /> : <Menu size={32} strokeWidth={2.5} />}
      </button>

      {/* MENÚ MÓVIL: Desplegable */}
      {isOpen && (
        <div
          className={`absolute top-full left-0 w-full border-b flex flex-col p-6 gap-6 lg:hidden animate-in slide-in-from-top duration-300 z-50 ${
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
                className={`font-title text-2xl tracking-wider flex items-center gap-3 ${
                  isActive ? "text-red-600 font-bold" : ""
                }`}
              >
                {/* En el desplegable móvil la casita va con su texto al
                    lado: ahí hay sitio y un icono suelto en una lista de
                    palabras se lee peor. */}
                {link.Icono && (
                  <link.Icono size={24} strokeWidth={2.5} aria-hidden="true" />
                )}
                {link.name}
              </Link>
            );
          })}

          {/* CTA también en móvil, donde el header no tiene sitio */}
          <div onClick={() => setIsOpen(false)}>
            <PrimaryButton
              text={cta.name}
              href={cta.href}
              isRed={true}
              track="cta_click"
              trackPlacement="header_movil"
            />
          </div>

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
