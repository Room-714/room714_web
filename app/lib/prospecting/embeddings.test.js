import { describe, expect, it, vi } from "vitest";
import { embedTexts, textoDeCandidato, VOYAGE_MODEL, VOYAGE_DIMS } from "./embeddings";

function fetchFalso(respuesta, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 429,
    text: async () => JSON.stringify(respuesta),
  });
}

describe("embedTexts", () => {
  it("devuelve los vectores en el mismo orden que los textos", async () => {
    const fetch = fetchFalso({
      data: [
        { index: 1, embedding: [0.2] },
        { index: 0, embedding: [0.1] },
      ],
    });
    const v = await embedTexts(["a", "b"], { fetch, apiKey: "k" });
    // Voyage puede devolverlos desordenados: se reordenan por `index`.
    expect(v).toEqual([[0.1], [0.2]]);
  });

  it("una lista vacía no llama a la API", async () => {
    const fetch = fetchFalso({});
    expect(await embedTexts([], { fetch, apiKey: "k" })).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("manda input_type document al guardar y query al buscar", async () => {
    const fetch = fetchFalso({ data: [{ index: 0, embedding: [0.1] }] });
    await embedTexts(["a"], { fetch, apiKey: "k", inputType: "query" });
    const cuerpo = JSON.parse(fetch.mock.calls[0][1].body);
    expect(cuerpo.input_type).toBe("query");
    expect(cuerpo.model).toBe(VOYAGE_MODEL);
    expect(cuerpo.output_dimension).toBe(VOYAGE_DIMS);
  });

  it("sin clave lanza un error explícito", async () => {
    await expect(embedTexts(["a"], { fetch: fetchFalso({}), apiKey: "" })).rejects.toThrow(
      /VOYAGE_API_KEY/,
    );
  });

  it("un error HTTP lanza con el estado dentro", async () => {
    const fetch = fetchFalso({ detail: "rate limited" }, false);
    await expect(embedTexts(["a"], { fetch, apiKey: "k" })).rejects.toThrow(/429/);
  });

  it("trocea en lotes de 128 y concatena", async () => {
    const fetch = vi.fn().mockImplementation((url, opciones) => {
      const { input } = JSON.parse(opciones.body);
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: input.map((_, i) => ({ index: i, embedding: [i] })),
          }),
      });
    });
    const textos = Array.from({ length: 200 }, (_, i) => `t${i}`);
    const v = await embedTexts(textos, { fetch, apiKey: "k" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(v).toHaveLength(200);
  });
});

describe("textoDeCandidato", () => {
  it("junta cargo y empresa, que es toda la señal que hay antes de mirar", () => {
    expect(textoDeCandidato({ title: "COO", company: "Herrajes Nordeste" })).toBe(
      "COO · Herrajes Nordeste",
    );
  });

  it("aguanta que falte cualquiera de los dos", () => {
    expect(textoDeCandidato({ company: "Herrajes Nordeste" })).toBe("Herrajes Nordeste");
    expect(textoDeCandidato({})).toBe("");
  });
});
