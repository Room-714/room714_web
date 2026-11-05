import { describe, expect, it } from "vitest";
import { APIConnectionTimeoutError } from "@anthropic-ai/sdk";
import {
  PRESUPUESTO_GENERACION_MS,
  crearReloj,
  esTimeout,
  opcionesDeTiempo,
} from "./tiempos";

describe("presupuesto", () => {
  it("cabe en el maxDuration de 300 s de las rutas, con margen", () => {
    expect(PRESUPUESTO_GENERACION_MS).toBeLessThanOrEqual(285_000);
  });
});

describe("opcionesDeTiempo", () => {
  it("fija el timeout y quita los reintentos ocultos del SDK", () => {
    expect(opcionesDeTiempo(45_000)).toEqual({ timeout: 45_000, maxRetries: 0 });
  });

  it("nunca pasa un timeout menor de 1 s", () => {
    expect(opcionesDeTiempo(-5).timeout).toBe(1000);
  });
});

describe("crearReloj", () => {
  it("cuenta lo que queda hasta el límite", () => {
    let ahora = 1_000;
    const reloj = crearReloj(10_000, () => ahora);
    expect(reloj.restante()).toBe(10_000);
    ahora = 4_000;
    expect(reloj.restante()).toBe(7_000);
    expect(reloj.transcurrido()).toBe(3_000);
  });

  it("el tope de una llamada es el menor entre su máximo y lo que queda menos la reserva", () => {
    let ahora = 0;
    const reloj = crearReloj(100_000, () => ahora);
    expect(reloj.tope(45_000)).toBe(45_000);
    expect(reloj.tope(45_000, 70_000)).toBe(30_000);
    ahora = 99_000;
    expect(reloj.tope(45_000)).toBe(1_000);
  });
});

describe("esTimeout", () => {
  it("reconoce el error de tiempo agotado del SDK", () => {
    expect(esTimeout(new APIConnectionTimeoutError())).toBe(true);
  });

  it("y un AbortError (fetch con AbortSignal.timeout)", () => {
    expect(esTimeout(Object.assign(new Error("x"), { name: "TimeoutError" }))).toBe(true);
    expect(esTimeout(Object.assign(new Error("x"), { name: "AbortError" }))).toBe(true);
  });

  it("no confunde otros errores", () => {
    expect(esTimeout(new Error("Campo vacío"))).toBe(false);
    expect(esTimeout(undefined)).toBe(false);
  });
});
