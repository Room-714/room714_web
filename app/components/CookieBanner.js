"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieBanner({ dict, lang }) {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Usamos un pequeño delay o simplemente nos aseguramos
    // de que la lectura de localStorage ocurra una vez montado el componente
    const hasAccepted = localStorage.getItem("cookie_consent");

    if (!hasAccepted) {
      // Usar requestAnimationFrame o un timeout de 0ms mueve la ejecución
      // al siguiente ciclo de eventos, evitando el renderizado en cascada síncrono.
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 500); // 500ms de delay para que sea más elegante

      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    // 1. Guardar como Cookie (para que el Servidor la lea en layout.js)
    document.cookie =
      "cookie_consent=true; path=/; max-age=" +
      60 * 60 * 24 * 365 +
      "; SameSite=Lax";
    // 2. Guardar en localStorage (opcional, por respaldo)
    localStorage.setItem("cookie_consent", "true");

    setShowBanner(false);
    window.location.reload();
  };

  // Importante: No renderizar nada en el servidor para evitar errores de hidratación
  if (!showBanner) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-auto md:max-w-sm z-100 animate-in fade-in slide-in-from-bottom-10 duration-700">
      <div className="bg-white border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-3xl p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-left">
          <h3 className="font-title font-bold text-lg text-black flex items-center gap-2">
            <span>🍪</span> {dict.cookies.title}
          </h3>
          <p className="font-body text-sm text-gray-500 leading-relaxed">
            {dict.cookies.description}{" "}
            <Link
              href={`/${lang}/privacy`}
              className="underline font-bold hover:text-red-500 transition-colors"
            >
              {dict.cookies.link}
            </Link>
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={acceptCookies}
            className="w-full bg-black text-white font-title py-3 rounded-full hover:bg-red-500 transition-all duration-300 text-[10px] font-bold uppercase tracking-[2px]"
          >
            {dict.cookies.accept}
          </button>
          <button
            onClick={() => setShowBanner(false)}
            className="w-full bg-transparent text-gray-400 font-title py-2 rounded-full hover:text-gray-600 transition-all duration-300 text-[9px] font-bold uppercase tracking-[1px]"
          >
            {dict.cookies.decline}
          </button>
        </div>
      </div>
    </div>
  );
}
