// Presupuesto de tiempo de una generación de post.
//
// Las rutas que generan (/api/admin/generate-draft y el cron) tienen
// maxDuration = 300 s. Antes ninguna llamada al modelo tenía límite: el SDK
// espera por defecto 10 minutos y reintenta 2 veces, así que una llamada
// atascada solo la cortaba Vercel a los 300 s, con un 504 en HTML que el
// panel no sabía leer. Ahora toda la generación vive dentro de un presupuesto
// y cada llamada se lleva el trozo que le toca, sin reintentos ocultos.

import { APIConnectionTimeoutError } from "@anthropic-ai/sdk";

/** Toda la generación, de la consulta al último enlace: 20 s por debajo de los 300 s. */
export const PRESUPUESTO_GENERACION_MS = 280_000;

/** Máximos por llamada (el tope real puede ser menor si queda poco presupuesto). */
export const MAX_PLANIFICADOR_MS = 45_000;
export const MAX_GENERACION_MS = 200_000;
export const MAX_REESCRITURA_MS = 20_000;
export const MAX_ENLAZADO_MS = 30_000;
export const MAX_IMAGEN_MS = 15_000;

/**
 * Lo que hay que dejar libre al empezar un intento de generación: reescribir
 * la description, la imagen, el INSERT y algo de margen.
 */
export const RESERVA_TRAS_GENERAR_MS = 50_000;

/** Un segundo intento de generación solo si le quedan al menos estos ms. */
export const MIN_INTENTO_GENERACION_MS = 90_000;

/** Opciones por petición del SDK de Anthropic: límite propio y sin reintentos. */
export function opcionesDeTiempo(ms) {
  return { timeout: Math.max(1000, Math.floor(ms)), maxRetries: 0 };
}

/**
 * Reloj de una generación. `limite` es cuánto dura el presupuesto desde ahora.
 * `ahora` se inyecta para los tests.
 */
export function crearReloj(limite = PRESUPUESTO_GENERACION_MS, ahora = () => Date.now()) {
  const inicio = ahora();
  const fin = inicio + limite;
  const restante = () => fin - ahora();
  return {
    restante,
    transcurrido: () => ahora() - inicio,
    /** Tope de una llamada: su máximo o lo que queda menos `reserva`, lo menor. */
    tope: (maximo, reserva = 0) => Math.max(0, Math.min(maximo, restante() - reserva)),
  };
}

/** true si el error es un tiempo agotado (SDK de Anthropic o fetch con AbortSignal). */
export function esTimeout(err) {
  if (!err) return false;
  if (err instanceof APIConnectionTimeoutError) return true;
  return err.name === "TimeoutError" || err.name === "AbortError";
}

/** "200 s" para los mensajes de error. */
export const segundos = (ms) => `${Math.round(ms / 1000)} s`;
