// Parámetros de campaña de la URL de entrada (utm_* y gclid), para guardarlos
// con el contacto. Sin cookies: van a sessionStorage, que muere con la
// pestaña. Se guarda la PRIMERA entrada de la sesión: si después navega por
// la web, las URLs internas no traen parámetros y no la pisan.

export const CLAVES_CAMPANA = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "gclid",
];

const CLAVE_ALMACEN = "r714_campana";

/** Extrae los parámetros de campaña de una query string. */
export function campanaDeQuery(search) {
  const params = new URLSearchParams(search || "");
  const campana = {};
  for (const clave of CLAVES_CAMPANA) {
    const valor = params.get(clave);
    if (valor) campana[clave] = valor.slice(0, 200);
  }
  return campana;
}

/** Guarda los parámetros de la URL actual si los hay y no había otros. */
export function capturarCampana() {
  try {
    if (sessionStorage.getItem(CLAVE_ALMACEN)) return;
    const campana = campanaDeQuery(window.location.search);
    if (Object.keys(campana).length > 0) {
      sessionStorage.setItem(CLAVE_ALMACEN, JSON.stringify(campana));
    }
  } catch {
    // Sin sessionStorage (modo privado, bloqueado): se pierde y no pasa nada.
  }
}

/** Los parámetros guardados, o los de la URL actual, o un objeto vacío. */
export function leerCampana() {
  try {
    const guardada = sessionStorage.getItem(CLAVE_ALMACEN);
    if (guardada) return JSON.parse(guardada);
  } catch {
    // Igual que arriba.
  }
  if (typeof window === "undefined") return {};
  return campanaDeQuery(window.location.search);
}
