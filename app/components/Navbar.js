"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Navbar({ dict, isDark = false }) {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: dict.nav.projects, href: "/projects" },
    { name: dict.nav.about, href: "/about" },
    { name: dict.nav.contact, href: "/contact" },
  ];

  return (
    <header
      className={`relative z-50 flex justify-between items-center px-6 py-8 md:px-10 md:py-10 lg:px-24 lg:py-12 transition-all duration-300 ${
        isDark ? "bg-black text-white" : "bg-white text-black"
      }`}
    >
      {/* LOGO */}
      <Link
        href="/"
        className={`w-28 h-8 md:w-40 md:h-12 lg:w-60 lg:h-16 relative transition-all duration-300`}
      >
        <Image
          src={isDark ? "/logo-dark.svg" : "/logo.svg"}
          alt="room714 logo"
          fill
          className="object-contain object-left"
          priority
        />
      </Link>
      {/* MENÚ DESKTOP */}
      <nav className="hidden md:flex md:items-center md:gap-8 lg:gap-10">
        {navLinks.map((link) => (
          <Link
            key={link.name}
            href={link.href}
            className=" font-title md:text-xl lg:text-2xl lg:font-medium tracking-wider hover:text-red-500 transition-all duration-300"
          >
            {link.name}
          </Link>
        ))}
      </nav>
      {/* MENÚ MÓVIL: Icono */}
      <button
        className={`md:hidden p-1 rounded-lg ${
          isDark ? "active:bg-gray-800" : "active:bg-gray-100"
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={32} /> : <Menu size={32} strokeWidth={2.5} />}
      </button>
      {/* MENÚ MÓVIL: Desplegable */}
      {isOpen && (
        <div
          className={`absolute top-full left-0 w-full border-b flex flex-col p-6 gap-4 md:hidden animate-in slide-in-from-top duration-300 ${
            isDark ? "bg-black border-gray-800" : "bg-white border-gray-200"
          }`}
        >
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="font-title text-xl tracking-wider"
            >
              {link.name}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
