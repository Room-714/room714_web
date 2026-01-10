"use client"; // Necesario para el estado del menú móvil
import { useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";

export default function Navbar({ dict }) {
  const [isOpen, setIsOpen] = useState(false);

  // Definimos los enlaces (puedes sacarlos del dict más tarde)
  const navLinks = [
    { name: dict.nav.services, href: "#services" },
    { name: dict.nav.work, href: "#work" },
    { name: dict.nav.contact, href: "#contact" },
  ];

  return (
    <header className="px-6 py-4 md:px-10 lg:px-16 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100 transition-all duration-300">
      {/* LOGO: Tres tamaños definidos
          Móvil: w-28 h-8 (112px x 32px)
          Tableta (md): w-36 h-10 (144px x 40px)
          PC (lg): w-60 h-15 (240px x 60px)
      */}
      <div className="relative transition-all duration-300 w-28 h-8 md:w-36 md:h-10 lg:w-60 lg:h-15">
        <Image
          src="/logo.svg"
          alt="room714 logo"
          fill
          className="object-contain object-left"
          priority
        />
      </div>
      {/* MENÚ DESKTOP: Escalado de letras
          md (tableta): text-xl
          lg (PC): text-2xl
      */}
      <nav className="hidden md:flex items-center gap-8 lg:gap-12">
        {navLinks.map((link) => (
          <a
            key={link.name}
            href={link.href}
            className="font-title tracking-widest hover:text-brand-red transition-all duration-300
                       md:text-xl lg:text-2xl"
          >
            {link.name}
          </a>
        ))}
      </nav>
      {/* BOTÓN MÓVIL (Oculto en 'md') */}
      <button
        className="md:hidden p-1 active:bg-gray-100 rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={32} /> : <Menu size={32} strokeWidth={1.5} />}
      </button>
      {/* MENÚ MÓVIL DESPLEGABLE */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-white border-b border-gray-200 flex flex-col p-6 gap-4 md:hidden animate-in slide-in-from-top duration-300">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="font-title font-bold text-xl uppercase"
            >
              {link.name}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
