"use client";

import { trackEvent } from "@/app/lib/analytics";

/**
 * Las conversiones de la landing de IA en tu empresa pasan todas por aquí:
 * `inventario_terminado` y `diagnostico_solicitado`.
 *
 * ESTE es el único punto donde se añadirá la etiqueta de conversión de Google
 * Ads cuando se instale (por ejemplo, un `gtag('event', 'conversion', …)` o un
 * evento del dataLayer que GTM traduzca). Hoy solo se mide con las mismas
 * herramientas que el resto de la web: no instala nada ni añade cookies.
 */
export function registrarConversion(nombre, props = {}) {
  trackEvent(nombre, props);
  // TODO(Google Ads): etiqueta de conversión aquí, detrás del consentimiento.
}
