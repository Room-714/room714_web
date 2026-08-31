import { describe, expect, it, vi } from "vitest";
import { recortar, generateIntro, LIMITE_CARACTERES, MODELO } from "./introText";

describe("recortar", () => {
  it("deja igual lo que ya cabe", () => {
    expect(recortar("Hola Elena, ¿hablamos?")).toBe("Hola Elena, ¿hablamos?");
  });

  it("corta por la última frase completa que quepa", () => {
    // Cortar a mitad de palabra deja una nota que no se puede enviar tal cual.
    const largo = "Frase una. " + "x".repeat(LIMITE_CARACTERES) + ". Frase tres.";
    const r = recortar(largo);
    expect(r.length).toBeLessThanOrEqual(LIMITE_CARACTERES);
    expect(r).toBe("Frase una.");
  });

  it("si ni la primera frase cabe, corta por palabra y no parte ninguna", () => {
    const r = recortar("palabra ".repeat(200));
    expect(r.length).toBeLessThanOrEqual(LIMITE_CARACTERES);
    expect(r.endsWith("palabra")).toBe(true);
  });

  it("aguanta vacío y nulo", () => {
    expect(recortar("")).toBe("");
    expect(recortar(null)).toBe("");
    expect(recortar(undefined)).toBe("");
  });
});

describe("generateIntro", () => {
  function clienteFalso(texto) {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: texto }],
          usage: { input_tokens: 500, output_tokens: 80 },
        }),
      },
    };
  }

  const PROSPECTO = {
    name: "Elena Sanchís",
    company: "Conservas Maribel",
    role: "Directora General",
  };

  it("devuelve la nota recortada y su coste", async () => {
    const r = await generateIntro(PROSPECTO, {
      client: clienteFalso("Elena, he visto que abristeis venta directa. ¿Hablamos?"),
      dossier: {},
    });
    expect(r.ok).toBe(true);
    expect(r.text).toContain("Elena");
    expect(r.text.length).toBeLessThanOrEqual(LIMITE_CARACTERES);
    expect(r.cost).toBeGreaterThan(0);
  });

  it("recorta lo que se pase de 300 caracteres", async () => {
    const largo = "Hola Elena. " + "muy interesante lo vuestro ".repeat(30);
    const r = await generateIntro(PROSPECTO, { client: clienteFalso(largo), dossier: {} });
    expect(r.text.length).toBeLessThanOrEqual(LIMITE_CARACTERES);
  });

  it("un fallo de la API no lanza: devuelve ok false", async () => {
    // El crédito de Apollo ya está gastado en este punto. Que la nota falle no
    // puede impedir que se cree el prospecto.
    const client = { messages: { create: vi.fn().mockRejectedValue(new Error("timeout")) } };
    const r = await generateIntro(PROSPECTO, { client, dossier: {} });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timeout/);
  });

  it("mete las notas anteriores como ejemplos de tono", async () => {
    const client = clienteFalso("nota");
    await generateIntro(PROSPECTO, {
      client,
      dossier: {},
      notasAnteriores: ["Una nota que escribí yo"],
    });
    const prompt = JSON.stringify(client.messages.create.mock.calls[0][0]);
    expect(prompt).toContain("Una nota que escribí yo");
  });

  it("sin notas anteriores no añade bloque de ejemplos vacío", async () => {
    // La API rechaza con 400 los bloques de texto vacíos o de solo espacios.
    const client = clienteFalso("nota");
    await generateIntro(PROSPECTO, { client, dossier: {} });
    const { system } = client.messages.create.mock.calls[0][0];
    expect(typeof system).toBe("string");
    expect(system.trim().length).toBeGreaterThan(0);
  });

  it("usa la señal concreta del dossier, no una plantilla", async () => {
    const client = clienteFalso("nota");
    await generateIntro(PROSPECTO, {
      client,
      dossier: {
        summary: "Fabricante que abrió venta directa este año",
        veredictos: {
          digitalNeed: { value: "E-commerce propio" },
          itTeam: { value: "2 personas de sistemas" },
        },
      },
    });
    const prompt = client.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("Fabricante que abrió venta directa");
    expect(prompt).toContain("E-commerce propio");
    expect(prompt).toContain("2 personas de sistemas");
  });

  it("aguanta un dossier vacío sin romper", async () => {
    const r = await generateIntro(PROSPECTO, { client: clienteFalso("nota") });
    expect(r.ok).toBe(true);
  });

  it("usa el modelo declarado", async () => {
    const client = clienteFalso("nota");
    await generateIntro(PROSPECTO, { client, dossier: {} });
    expect(client.messages.create.mock.calls[0][0].model).toBe(MODELO);
  });
});
