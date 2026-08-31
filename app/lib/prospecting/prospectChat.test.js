import { describe, expect, it, vi } from "vitest";
import { askAboutCompany, MODELO, SUGERENCIAS } from "./prospectChat";

// El cliente se inyecta: este módulo no debe tocar la red en ningún test, y la
// forma de la petición es justo lo que aquí se comprueba.
function clienteFalso(texto = "Lo que he podido comprobar es poco.") {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          { type: "thinking", thinking: "esto no debería salir en el texto" },
          { type: "text", text: texto },
        ],
        usage: { input_tokens: 4000, output_tokens: 300 },
      }),
    },
  };
}

const FICHA = {
  company: "Conservas Maribel",
  title: "Director de Operaciones",
  dossier: {
    report: "Factura 62 M€ según einforma (ejercicio 2024).",
    veredictos: { revenue: { verdict: "pass", value: "62 M€" } },
  },
};

describe("askAboutCompany", () => {
  it("devuelve el texto de la respuesta y lo que ha costado", async () => {
    // Sin el coste, el chat sería el único gasto del sistema que no se ve, y la
    // métrica de coste por validado se quedaría corta sin ningún síntoma.
    const client = clienteFalso("Deciden en el comité de dirección.");
    const r = await askAboutCompany({ client, ficha: FICHA, pregunta: "¿Quién decide?" });

    expect(r.ok).toBe(true);
    expect(r.text).toBe("Deciden en el comité de dirección.");
    expect(r.cost).toBeGreaterThan(0);
  });

  it("un fallo de la API devuelve ok:false y NO lanza", async () => {
    // El chat se abre desde la ficha mientras se decide: si lanzara, un 429 de
    // Anthropic tiraría la pantalla entera en medio de una revisión.
    const client = {
      messages: { create: vi.fn().mockRejectedValue(new Error("529 overloaded")) },
    };
    const r = await askAboutCompany({ client, ficha: FICHA, pregunta: "¿Y esto?" });

    expect(r.ok).toBe(false);
    expect(r.error).toContain("529");
    expect(r.cost).toBe(0);
  });

  it("el historial del cliente llega en messages ANTES de la pregunta nueva", async () => {
    // El hilo no se persiste: viaja desde el cliente en cada llamada. Si el
    // orden se invirtiera, el modelo leería la pregunta nueva como si fuera lo
    // primero dicho y respondería sin el contexto ya conversado.
    const client = clienteFalso();
    const historial = [
      { role: "user", content: "¿Tienen tienda online?" },
      { role: "assistant", content: "Sí, desde 2023." },
    ];
    await askAboutCompany({ client, ficha: FICHA, historial, pregunta: "¿Y quién la lleva?" });

    const { messages } = client.messages.create.mock.calls[0][0];
    expect(messages).toHaveLength(3);
    expect(messages.slice(0, 2)).toEqual(historial);
    expect(messages[2]).toEqual({ role: "user", content: "¿Y quién la lleva?" });
  });

  it("el prompt de sistema lleva la empresa y el informe previo", async () => {
    // Es lo que hace que el chat continúe el análisis en vez de empezar de cero
    // y volver a pagar por descubrir lo que ya está en el dossier.
    const client = clienteFalso();
    await askAboutCompany({ client, ficha: FICHA, pregunta: "¿Cuánto facturan?" });

    const { system } = client.messages.create.mock.calls[0][0];
    expect(system).toContain("Conservas Maribel");
    expect(system).toContain("Director de Operaciones");
    expect(system).toContain("Factura 62 M€ según einforma");
    expect(system).toContain('"verdict": "pass"');
  });

  it("una ficha sin dossier no rompe el prompt: lo dice y sigue", async () => {
    // Pasa de verdad: una fila antigua o una en la que el vistazo falló llega
    // sin dossier, y un `undefined` interpolado en el sistema sería una llamada
    // pagada preguntando por un informe que no existe.
    const client = clienteFalso();
    await askAboutCompany({ client, ficha: { company: "Herrajes Nordeste" }, pregunta: "¿Qué hacen?" });

    const { system } = client.messages.create.mock.calls[0][0];
    expect(system).toContain("(todavía no hay análisis)");
    expect(system).toContain("(sin cargo)");
    expect(system).not.toContain("undefined");
  });

  it("declara la herramienta de búsqueda web y el modelo del análisis a fondo", async () => {
    // Sin búsqueda el chat solo puede repetir el dossier, que es exactamente lo
    // que el usuario ya está leyendo cuando decide preguntar.
    const client = clienteFalso();
    await askAboutCompany({ client, ficha: FICHA, pregunta: "¿Han hecho algo digital?" });

    const enviado = client.messages.create.mock.calls[0][0];
    expect(enviado.model).toBe(MODELO);
    expect(enviado.tools).toHaveLength(1);
    expect(enviado.tools[0].name).toBe("web_search");
    expect(enviado.tools[0].type).toMatch(/^web_search_/);
    expect(enviado.tools[0].max_uses).toBe(3);
    expect(enviado.thinking).toEqual({ type: "adaptive" });
  });

  it("descarta los bloques que no son texto", async () => {
    // Con thinking adaptativo la respuesta trae bloques de razonamiento y de
    // uso de herramienta; concatenarlos a pelo pintaría basura en la ficha.
    const client = clienteFalso("Solo esto es la respuesta.");
    const r = await askAboutCompany({ client, ficha: FICHA, pregunta: "¿Y bien?" });
    expect(r.text).toBe("Solo esto es la respuesta.");
  });

  it("ofrece sugerencias de arranque, que es lo que hace usable un chat vacío", () => {
    expect(SUGERENCIAS.length).toBeGreaterThan(0);
    expect(SUGERENCIAS.every((s) => typeof s === "string" && s.trim().length > 0)).toBe(true);
  });
});
