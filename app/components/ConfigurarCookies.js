"use client";

import { EVENTO_ABRIR } from "@/app/components/CookieBanner";

/** Enlace del pie que vuelve a abrir el banner de cookies. */
export default function ConfigurarCookies({ texto, className = "" }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR))}
      className={className}
    >
      {texto}
    </button>
  );
}
