// Petición de "Generar post IA" desde el panel.
//
// Antes era un fetch sin límite y los errores salían con alert(). Un alert
// nativo bloquea la ejecución de JavaScript de la página hasta que alguien lo
// cierra, y el `finally` que apaga "Generando…" no llega a correr: la pestaña
// parecía colgada. Si además la conexión se cortaba, el servidor podía haber
// terminado y creado el post igualmente (así pasó el 2026-11-05).
//
// Aquí: límite de espera, lectura defensiva de la respuesta (un 504 de Vercel
// llega en HTML) y un resultado que el panel enseña sin bloquear nada.

/** La ruta tiene maxDuration = 300 s; el panel espera un poco más. */
export const LIMITE_PANEL_MS = 320_000;

const minutos = (ms) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ""}`.trim() : `${s} s`;
};

const PUEDE_HABERSE_CREADO =
  "Puede que el post se haya creado igualmente: revisa «Próximamente» antes de volver a intentarlo.";

/**
 * Pide la generación. Nunca lanza: devuelve
 * - { tipo: "exito", data }
 * - { tipo: "aviso", data }   duplicado o sin cluster (el panel ofrece opciones)
 * - { tipo: "error", mensaje, puedeHaberseCreado }
 */
export async function pedirGeneracion(
  { tema, evitar = [] } = {},
  { fetchImpl = fetch, limiteMs = LIMITE_PANEL_MS } = {},
) {
  const cuerpo = { sendEmail: false, evitar };
  const temaLimpio = typeof tema === "string" ? tema.trim() : "";
  if (temaLimpio) cuerpo.tema = temaLimpio;

  const controlador = new AbortController();
  const temporizador = setTimeout(
    () => controlador.abort(new DOMException("limite", "TimeoutError")),
    limiteMs,
  );

  let res;
  let texto;
  try {
    res = await fetchImpl("/api/admin/generate-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: controlador.signal,
    });
    texto = await res.text();
  } catch (err) {
    const porLimite = controlador.signal.aborted;
    return {
      tipo: "error",
      mensaje: porLimite
        ? `La generación no ha respondido en ${minutos(limiteMs)} y se ha dejado de esperar. ${PUEDE_HABERSE_CREADO}`
        : `Se perdió la conexión con el servidor mientras se generaba (${err?.message || "error de red"}). ${PUEDE_HABERSE_CREADO}`,
      puedeHaberseCreado: true,
    };
  } finally {
    clearTimeout(temporizador);
  }

  let data = null;
  try {
    data = JSON.parse(texto);
  } catch {
    // Un corte de Vercel (504) o un error de la plataforma llega en HTML.
    return {
      tipo: "error",
      mensaje: `El servidor cortó la generación (HTTP ${res.status}) antes de responder. ${PUEDE_HABERSE_CREADO}`,
      puedeHaberseCreado: true,
    };
  }

  if (!res.ok) {
    return {
      tipo: "error",
      mensaje: `Error generando el post (HTTP ${res.status}): ${data?.error || "sin detalle"}`,
      // La ruta devuelve 500 con JSON cuando falla antes de guardar o al
      // guardar; el mensaje del servidor dice cuál de los dos.
      puedeHaberseCreado: false,
    };
  }
  if (data?.duplicado || data?.sinCluster) return { tipo: "aviso", data };
  if (data?.skipped) {
    return { tipo: "error", mensaje: `No se generó: ${data.reason}`, puedeHaberseCreado: false };
  }
  return { tipo: "exito", data };
}
