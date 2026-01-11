"use client"; // Necesario para el estado del menú móvil
import { useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";

export default function Navbar({ dict }) {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: dict.nav.services, href: "#services" },
    { name: dict.nav.work, href: "#work" },
    { name: dict.nav.contact, href: "#contact" },
  ];

  return (
    <header className=" relative z-50 flex justify-between items-center bg-white text-black px-6 py-8 md:px-10 md:py-10 lg:px-24 lg:py-12 transition-all duration-300">
      {/* LOGO: Tres tamaños
          Móvil: w-28 h-8 (112px x 32px)
          Tableta (md): w-40 h-12 (160px x 48px)
          PC (lg): w-60 h-16 (240px x 64px)
      */}
      <div className="w-28 h-8 md:w-40 md:h-12 lg:w-60 lg:h-16 relative transition-all duration-300 ">
        <Image
          src="/logo.svg"
          alt="room714 logo"
          fill
          className="object-contain object-left"
          priority
        />
      </div>
      {/* MENÚ DESKTOP: Escalado de letras
          Tableta (md): text-xl
          PC (lg): text-2xl
      */}
      <nav className="hidden md:flex md:items-center md:gap-8 lg:gap-10">
        {navLinks.map((link) => (
          <a
            key={link.name}
            href={link.href}
            className=" font-title md:text-xl lg:text-2xl lg:font-medium tracking-wider hover:text-red-500 transition-all duration-300"
          >
            {link.name}
          </a>
        ))}
      </nav>
      {/* MENÚ MÓVIL: Icono */}
      <button
        className="md:hidden p-1 active:bg-gray-100 rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={32} /> : <Menu size={32} strokeWidth={1.5} />}
      </button>
      {/* MENÚ MÓVIL: Desplegable */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-white border-b border-gray-200 flex flex-col p-6 gap-4 md:hidden animate-in slide-in-from-top duration-300">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="font-title text-xl tracking-wider"
            >
              {link.name}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
