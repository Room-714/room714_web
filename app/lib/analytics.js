"use client";

import { track } from "@vercel/analytics";

/**
 * Un evento a los dos destinos:
 *
 * - Vercel Analytics, que no usa cookies ni datos personales y por eso carga
 *   sin esperar al banner.
 * - El dataLayer de GTM, que solo existe si hay consentimiento. Si el
 *   contenedor no está cargado, el push se queda en la cola del array y no
 *   pasa nada: no se pierde nada que importe y no hay que preguntar por el
 *   consentimiento aquí.
 *
 * Nunca lanza: un fallo de analítica no puede romper un envío de formulario
 * ni la navegación.
 */
export function trackEvent(name, props = {}) {
  try {
    if (typeof window !== "undefined") {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, ...props });
    }
    track(name, props);
  } catch {
    // Silencio deliberado.
  }
}
