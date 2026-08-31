import { describe, expect, it } from "vitest";
import { costOf, sumCosts } from "./aiCost";

describe("costOf", () => {
  it("cobra entrada y salida al precio del modelo", () => {
    // Opus 5: 5 $/M de entrada, 25 $/M de salida.
    const c = costOf("claude-opus-5", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(c).toBeCloseTo(30, 6);
  });

  it("cobra la lectura de caché a una décima parte de la entrada", () => {
    const c = costOf("claude-opus-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
    });
    expect(c).toBeCloseTo(0.5, 6);
  });

  it("cobra las búsquedas web a 10 $ por mil", () => {
    const c = costOf("claude-haiku-4-5", {
      input_tokens: 0,
      output_tokens: 0,
      server_tool_use: { web_search_requests: 3 },
    });
    expect(c).toBeCloseTo(0.03, 6);
  });

  it("un modelo desconocido se cobra al precio más caro que conocemos", () => {
    // Fallar en abierto aquí significa creerse más barato de lo que se es y
    // pasarse del tope sin enterarse. Se falla en cerrado.
    const desconocido = costOf("claude-modelo-que-no-existe", {
      input_tokens: 1_000_000,
      output_tokens: 0,
    });
    const masCaro = costOf("claude-opus-5", { input_tokens: 1_000_000, output_tokens: 0 });
    expect(desconocido).toBeGreaterThanOrEqual(masCaro);
  });

  it("un usage roto no rompe: cuenta cero en lo que falte", () => {
    expect(costOf("claude-opus-5", undefined)).toBe(0);
    expect(costOf("claude-opus-5", { input_tokens: null })).toBe(0);
  });

  it("cobra la escritura de caché de 5 minutos a 1,25x la entrada", () => {
    const c = costOf("claude-opus-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation: { ephemeral_5m_input_tokens: 1_000_000, ephemeral_1h_input_tokens: 0 },
    });
    expect(c).toBeCloseTo(6.25, 6);
  });

  it("cobra la escritura de caché de 1 hora a 2x la entrada", () => {
    const c = costOf("claude-opus-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 1_000_000 },
    });
    expect(c).toBeCloseTo(10, 6);
  });

  it("sin desglose de TTL, la escritura de caché se cobra al 2x a propósito: es el peor caso, no una media", () => {
    const c = costOf("claude-opus-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
    });
    expect(c).toBeCloseTo(10, 6);
  });
});

describe("sumCosts", () => {
  it("suma una lista de llamadas", () => {
    const total = sumCosts([
      { model: "claude-haiku-4-5", usage: { input_tokens: 1_000_000, output_tokens: 0 } },
      { model: "claude-haiku-4-5", usage: { input_tokens: 0, output_tokens: 1_000_000 } },
    ]);
    expect(total).toBeCloseTo(6, 6); // 1 $ de entrada + 5 $ de salida
  });

  it("una lista vacía cuesta cero", () => {
    expect(sumCosts([])).toBe(0);
  });
});
