"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { path } from "@/app/lib/routes.mjs";

// Banner de consentimiento de cookies.
//
// - Aceptar y Rechazar tienen el mismo peso visual y las dos decisiones se
//   recuerdan un año (cookie `cookie_consent` = "true" | "false", que también
//   lee el servidor en layout.js para decidir si carga GTM y Clarity).
// - Se vuelve a abrir desde «Configurar cookies» en el pie (evento
//   EVENTO_ABRIR), para poder cambiar de decisión.
// - Rechazar después de haber aceptado borra las cookies de Google Analytics,
//   Google Ads y Clarity y recarga, para que dejen de cargarse.

export const EVENTO_ABRIR = "room714:configurar-cookies";

const UN_ANIO = 60 * 60 * 24 * 365;
// Prefijos de las cookies de terceros que se instalan solo con consentimiento.
const PREFIJOS_SEGUIMIENTO = ["_ga", "_gid", "_gcl", "_clck", "_clsk", "CLID", "MUID"];

function leerDecision() {
  const m = document.cookie.match(/(?:^|;\s*)cookie_consent=(true|false)/);
  if (m) return m[1];
  try {
    return localStorage.getItem("cookie_consent");
  } catch {
    return null;
  }
}

function guardarDecision(valor) {
  document.cookie = `cookie_consent=${valor}; path=/; max-age=${UN_ANIO}; SameSite=Lax`;
  try {
    localStorage.setItem("cookie_consent", valor);
  } catch {
    // Navegación privada o almacenamiento bloqueado: basta con la cookie.
  }
}

/** Borra las cookies de seguimiento en el dominio actual y en el principal. */
function borrarCookiesSeguimiento() {
  const host = location.hostname;
  const principal = host.split(".").slice(-2).join(".");
  const dominios = ["", `; domain=${host}`, `; domain=.${principal}`];
  for (const par of document.cookie.split(";")) {
    const nombre = par.split("=")[0].trim();
    if (!PREFIJOS_SEGUIMIENTO.some((p) => nombre.startsWith(p))) continue;
    for (const d of dominios) {
      document.cookie = `${nombre}=; path=/; max-age=0${d}`;
    }
  }
}

export default function CookieBanner({ dict, lang }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const abrir = () => setVisible(true);
    window.addEventListener(EVENTO_ABRIR, abrir);
    // Sin decisión guardada, el banner aparece tras un instante.
    const timer = leerDecision() ? null : setTimeout(abrir, 500);
    return () => {
      window.removeEventListener(EVENTO_ABRIR, abrir);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const aceptar = () => {
    const antes = leerDecision();
    guardarDecision("true");
    setVisible(false);
    // El servidor carga GTM y Clarity en la siguiente petición.
    if (antes !== "true") window.location.reload();
  };

  const rechazar = () => {
    const antes = leerDecision();
    guardarDecision("false");
    setVisible(false);
    if (antes === "true") {
      borrarCookiesSeguimiento();
      window.location.reload();
    }
  };

  if (!visible) return null;

  const t = dict.cookies;
  const boton =
    "w-full font-title py-3 rounded-full transition-all duration-300 text-[10px] font-bold uppercase tracking-[2px] border border-black";

  return (
    <div
      role="dialog"
      aria-labelledby="cookies-titulo"
      className="fixed bottom-6 left-6 right-6 md:left-auto md:max-w-sm z-100 animate-in fade-in slide-in-from-bottom-10 duration-700"
    >
      <div className="bg-white border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-3xl p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-left">
          <h3
            id="cookies-titulo"
            className="font-title font-bold text-lg text-black flex items-center gap-2"
          >
            <span aria-hidden="true">🍪</span> {t.title}
          </h3>
          <p className="font-body text-sm text-gray-600 leading-relaxed">
            {t.description}{" "}
            <Link
              href={path("cookies", lang)}
              className="underline font-bold hover:text-red-500 transition-colors"
            >
              {t.link}
            </Link>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={rechazar}
            className={`${boton} bg-white text-black hover:bg-gray-100`}
          >
            {t.decline}
          </button>
          <button
            type="button"
            onClick={aceptar}
            className={`${boton} bg-black text-white hover:bg-red-500 hover:border-red-500`}
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
