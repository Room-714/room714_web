"use client";

import { useEffect } from "react";
import { trackEvent } from "@/app/lib/analytics";

/**
 * Un único oyente de clics en todo el documento, en lugar de un onClick por
 * botón. Así los CTA siguen siendo componentes de servidor (PrimaryButton
 * recibe su icono como prop, y eso no cruza la frontera cliente/servidor) y
 * marcar un botón cuesta añadirle un atributo, no convertirlo en cliente.
 *
 * Dos cosas se miden aquí:
 *
 *   - Cualquier elemento con data-track="nombre_del_evento".
 *   - Cualquier enlace a linkedin.com, sin marcarlo uno a uno.
 */
export default function AnalyticsEvents() {
  useEffect(() => {
    const alHacerClic = (evento) => {
      const marcado = evento.target.closest?.("[data-track]");
      if (marcado) {
        trackEvent(marcado.dataset.track, {
          placement: marcado.dataset.trackPlacement || undefined,
          path: window.location.pathname,
        });
        return;
      }

      const enlace = evento.target.closest?.('a[href*="linkedin.com"]');
      if (enlace) {
        trackEvent("linkedin_click", {
          placement: enlace.dataset.trackPlacement || undefined,
          path: window.location.pathname,
        });
      }
    };

    document.addEventListener("click", alHacerClic, { capture: true });
    return () =>
      document.removeEventListener("click", alHacerClic, { capture: true });
  }, []);

  return null;
}
