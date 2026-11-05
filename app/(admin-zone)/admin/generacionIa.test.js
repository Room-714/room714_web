import { describe, expect, it, vi } from "vitest";
import { LIMITE_PANEL_MS, pedirGeneracion } from "./generacionIa";

const respuesta = (status, cuerpo, tipo = "application/json") => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)),
  headers: { get: () => tipo },
});

describe("pedirGeneracion", () => {
  it("espera más que el maxDuration de 300 s de la ruta", () => {
    expect(LIMITE_PANEL_MS).toBeGreaterThan(300_000);
  });

  it("manda el tema y los temas descartados", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respuesta(200, { skipped: false, postId: 7 }));
    await pedirGeneracion({ tema: "  priorizar  ", evitar: ["a"] }, { fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ sendEmail: false, evitar: ["a"], tema: "priorizar" });
  });

  it("sin tema no manda el campo (el generador elige)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respuesta(200, { skipped: false, postId: 7 }));
    await pedirGeneracion({ tema: "   ", evitar: [] }, { fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).not.toHaveProperty("tema");
  });

  it("éxito", async () => {
    const r = await pedirGeneracion({}, { fetchImpl: async () => respuesta(200, { skipped: false, postId: 7 }) });
    expect(r).toEqual({ tipo: "exito", data: { skipped: false, postId: 7 } });
  });

  it("duplicado y sin cluster van al aviso", async () => {
    const dup = await pedirGeneracion({}, { fetchImpl: async () => respuesta(200, { skipped: true, duplicado: { tema: "t" } }) });
    expect(dup.tipo).toBe("aviso");
    const sc = await pedirGeneracion({}, { fetchImpl: async () => respuesta(200, { skipped: true, sinCluster: true }) });
    expect(sc.tipo).toBe("aviso");
  });

  it("otro motivo de no generar es un error con su razón", async () => {
    const r = await pedirGeneracion({}, { fetchImpl: async () => respuesta(200, { skipped: true, reason: "No es día laborable" }) });
    expect(r).toMatchObject({ tipo: "error", mensaje: "No se generó: No es día laborable", puedeHaberseCreado: false });
  });

  it("un error del servidor con JSON enseña su mensaje", async () => {
    const r = await pedirGeneracion({}, {
      fetchImpl: async () => respuesta(500, { error: "el modelo no respondió en 200 s. No se ha guardado ningún post." }),
    });
    expect(r.tipo).toBe("error");
    expect(r.mensaje).toContain("el modelo no respondió en 200 s");
    expect(r.puedeHaberseCreado).toBe(false);
  });

  it("un 504 en HTML (corte de Vercel) no revienta y avisa de que puede haberse creado", async () => {
    const r = await pedirGeneracion({}, { fetchImpl: async () => respuesta(504, "<html>An error occurred</html>", "text/html") });
    expect(r.tipo).toBe("error");
    expect(r.mensaje).toContain("HTTP 504");
    expect(r.puedeHaberseCreado).toBe(true);
  });

  it("una conexión perdida avisa de que puede haberse creado", async () => {
    const r = await pedirGeneracion({}, { fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
    expect(r).toMatchObject({ tipo: "error", puedeHaberseCreado: true });
    expect(r.mensaje).toContain("Se perdió la conexión");
  });

  it("corta la espera al llegar al límite, con mensaje claro", async () => {
    // fetch que nunca responde salvo que lo aborten.
    const fetchImpl = (url, { signal }) =>
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
    const r = await pedirGeneracion({}, { fetchImpl, limiteMs: 30 });
    expect(r.tipo).toBe("error");
    expect(r.mensaje).toContain("no ha respondido en");
    expect(r.mensaje).toContain("Próximamente");
    expect(r.puedeHaberseCreado).toBe(true);
  });
});
