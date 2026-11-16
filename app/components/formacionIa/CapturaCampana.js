"use client";

import { useEffect } from "react";
import { capturarCampana } from "@/app/lib/campana";

/** Guarda utm_* y gclid de la URL de entrada (ver app/lib/campana.js). */
export default function CapturaCampana() {
  useEffect(() => {
    capturarCampana();
  }, []);
  return null;
}
