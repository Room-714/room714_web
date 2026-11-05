import { beforeEach, describe, expect, it, vi } from "vitest";
import { APIConnectionTimeoutError } from "@anthropic-ai/sdk";

vi.mock("./anthropic", () => ({ getAnthropicClient: vi.fn(), MODEL: "claude-test-model" }));
vi.mock("@/app/lib/prisma", () => ({ prisma: {} }));

import { getAnthropicClient } from "./anthropic";
import { generatePostDraft } from "./generator";
import { planificarTema } from "./planificador";
import { crearReloj, MAX_GENERACION_MS, RESERVA_TRAS_GENERAR_MS } from "./tiempos";

// Reloj falso: cada llamada al modelo "tarda" lo que diga el test.
let ahora;
const reloj = (limite) => crearReloj(limite, () => ahora);

function clienteQue(intentos) {
  const stream = vi.fn((params, opciones) => ({
    finalMessage: async () => {
      const paso = intentos[stream.mock.calls.length - 1];
      ahora += paso.tarda;
      throw paso.error;
    },
  }));
  return { messages: { stream, create: vi.fn() } };
}

const args = (r) => ({ category: "UX", trending: [], recentPosts: [], publishedCorpus: [], cluster: "C2", reloj: r });

beforeEach(() => {
  ahora = 0;
});

describe("generatePostDraft — presupuesto de tiempo", () => {
  it("pasa al SDK su límite y sin reintentos ocultos", async () => {
    const cliente = clienteQue([
      { tarda: 1000, error: new Error("otro fallo") },
      { tarda: 1000, error: new Error("otro fallo") },
    ]);
    getAnthropicClient.mockReturnValue(cliente);
    await expect(generatePostDraft(args(reloj(280_000)))).rejects.toThrow();
    expect(cliente.messages.stream.mock.calls[0][1]).toEqual({ timeout: MAX_GENERACION_MS, maxRetries: 0 });
  });

  it("si el modelo agota el tiempo y no queda para otro intento, no reintenta y lo dice claro", async () => {
    const cliente = clienteQue([{ tarda: 200_000, error: new APIConnectionTimeoutError() }]);
    getAnthropicClient.mockReturnValue(cliente);
    const error = await generatePostDraft(args(reloj(280_000))).catch((e) => e);
    expect(cliente.messages.stream).toHaveBeenCalledTimes(1);
    expect(error.message).toContain("el modelo no respondió en 200 s");
    expect(error.message).toContain("No se ha guardado ningún post");
  });

  it("si queda tiempo, hace el segundo intento con el tope que quede", async () => {
    const cliente = clienteQue([
      { tarda: 30_000, error: new Error("Campo vacío o faltante en respuesta: cluster") },
      { tarda: 30_000, error: new Error("Campo vacío o faltante en respuesta: cluster") },
    ]);
    getAnthropicClient.mockReturnValue(cliente);
    await expect(generatePostDraft(args(reloj(280_000)))).rejects.toThrow("tras 2 intentos");
    expect(cliente.messages.stream).toHaveBeenCalledTimes(2);
    expect(cliente.messages.stream.mock.calls[1][1].timeout).toBe(280_000 - 30_000 - RESERVA_TRAS_GENERAR_MS);
  });

  it("sin tiempo para un intento útil, no llama al modelo", async () => {
    const cliente = clienteQue([]);
    getAnthropicClient.mockReturnValue(cliente);
    await expect(generatePostDraft(args(reloj(RESERVA_TRAS_GENERAR_MS + 10_000)))).rejects.toThrow(
      "No queda tiempo para generar",
    );
    expect(cliente.messages.stream).not.toHaveBeenCalled();
  });
});

describe("planificarTema — presupuesto de tiempo", () => {
  it("pasa su límite al SDK", async () => {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "tool_use", input: { tema_es: "t", tema_en: "t", angulo_es: "a", cluster: "C1", duplicado_de: 0, motivo: "" } }],
      usage: {},
    });
    getAnthropicClient.mockReturnValue({ messages: { create } });
    await planificarTema({ category: "UX", existentes: [], timeoutMs: 12_000 });
    expect(create.mock.calls[0][1]).toEqual({ timeout: 12_000, maxRetries: 0 });
  });

  it("un tiempo agotado se explica en castellano", async () => {
    getAnthropicClient.mockReturnValue({ messages: { create: vi.fn().mockRejectedValue(new APIConnectionTimeoutError()) } });
    await expect(planificarTema({ category: "UX", existentes: [], timeoutMs: 45_000 })).rejects.toThrow(
      "El planificador no respondió en 45 s",
    );
  });
});
