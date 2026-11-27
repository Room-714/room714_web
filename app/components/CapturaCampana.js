"use client";

import { useEffect } from "react";
import { capturarCampana } from "@/app/lib/campana";

/**
 * Guarda utm_* y gclid de la URL de entrada (ver app/lib/campana.js). Va en
 * el layout de [lang]: cualquier página puede ser la de entrada.
 */
export default function CapturaCampana() {
  useEffect(() => {
    capturarCampana();
  }, []);
  return null;
}
