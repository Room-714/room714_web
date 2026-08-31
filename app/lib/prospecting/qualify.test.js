import { describe, expect, it, vi } from "vitest";
import {
  parseVerdicts,
  construirEjemplos,
  informeDesdeVeredictos,
  quickLook,
  deepDive,
  MODELO_VISTAZO,
  MODELO_FONDO,
} from "./qualify";

const VEREDICTOS_OK = {
  revenue: { verdict: "pass", value: "≈71 M€ (2024)", evidence: "Cuentas depositadas", sources: ["https://e.example/x"] },
  digitalNeed: { verdict: "pass", value: "Portal B2B", evidence: "Nota de prensa", sources: [] },
  itTeam: { verdict: "pass", value: "3 personas", evidence: "LinkedIn", sources: [] },
  advisory: { verdict: "pass", value: "Alta", evidence: "Dos proyectos", sources: [] },
  summary: "Fabricante de 71 M€ montando su primer canal digital.",
};

describe("parseVerdicts", () => {
  it("acepta un JSON completo", () => {
    const r = parseVerdicts(JSON.stringify(VEREDICTOS_OK));
    expect(r.ok).toBe(true);
    expect(r.veredictos.revenue.verdict).toBe("pass");
  });

  it("rechaza JSON inválido y dice por qué", () => {
    const r = parseVerdicts("{ esto no es json");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/json/i);
  });

  it("rechaza si falta alguno de los cuatro criterios", () => {
    const { itTeam, ...incompleto } = VEREDICTOS_OK;
    const r = parseVerdicts(JSON.stringify(incompleto));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/itTeam/);
  });

  it("normaliza un veredicto desconocido a unclear en vez de romper", () => {
    const raro = { ...VEREDICTOS_OK, itTeam: { ...VEREDICTOS_OK.itTeam, verdict: "quizás" } };
    const r = parseVerdicts(JSON.stringify(raro));
    expect(r.ok).toBe(true);
    expect(r.veredictos.itTeam.verdict).toBe("unclear");
  });

  it("saca el JSON aunque venga envuelto en texto o en un bloque de código", () => {
    const envuelto = "Aquí tienes:\n```json\n" + JSON.stringify(VEREDICTOS_OK) + "\n```";
    expect(parseVerdicts(envuelto).ok).toBe(true);
  });

  it("se queda con el PRIMER objeto completo si vienen dos JSON seguidos", () => {
    // Caso real: la respuesta trajo dos objetos y el corte de la primera `{` a
    // la última `}` los abarcaba a los dos, produciendo algo que no parsea.
    // Costó un análisis ya pagado descubrirlo.
    const doble = JSON.stringify(VEREDICTOS_OK) + "\n" + JSON.stringify(VEREDICTOS_OK);
    const r = parseVerdicts(doble);
    expect(r.ok).toBe(true);
    expect(r.veredictos.summary).toBe(VEREDICTOS_OK.summary);
  });

  it("aguanta llaves dentro de las cadenas del JSON", () => {
    const conLlaves = {
      ...VEREDICTOS_OK,
      summary: "Usa una plantilla con {llaves} y \"comillas\" dentro",
    };
    const r = parseVerdicts(JSON.stringify(conLlaves));
    expect(r.ok).toBe(true);
    expect(r.veredictos.summary).toContain("{llaves}");
  });

  it("una cifra de facturación fuera de rango fuerza fail, diga lo que diga el modelo", () => {
    // Caso real: a una empresa de 424 M€ el modelo le puso "pass" con la cifra
    // correcta escrita al lado. Comprobar si un número cae en un rango es
    // aritmética, no criterio, y la aritmética no se delega al modelo.
    const grande = {
      ...VEREDICTOS_OK,
      revenue: { ...VEREDICTOS_OK.revenue, verdict: "pass", amountEurM: 424 },
    };
    const r = parseVerdicts(JSON.stringify(grande));
    expect(r.veredictos.revenue.verdict).toBe("fail");
    expect(r.veredictos.revenue.evidence).toMatch(/fuera del rango/i);
  });

  it("una cifra por debajo del rango también fuerza fail", () => {
    const pequena = {
      ...VEREDICTOS_OK,
      revenue: { ...VEREDICTOS_OK.revenue, verdict: "pass", amountEurM: 12 },
    };
    expect(parseVerdicts(JSON.stringify(pequena)).veredictos.revenue.verdict).toBe("fail");
  });

  it("dentro de rango respeta el veredicto del modelo, incluso si duda", () => {
    // Dentro del rango sí hay criterio que respetar: un grupo que no consolida,
    // una cifra de hace tres años. Eso el modelo lo ve y nosotros no.
    const dudoso = {
      ...VEREDICTOS_OK,
      revenue: { ...VEREDICTOS_OK.revenue, verdict: "unclear", amountEurM: 71 },
    };
    expect(parseVerdicts(JSON.stringify(dudoso)).veredictos.revenue.verdict).toBe("unclear");
  });

  it("sin cifra numérica no toca el veredicto", () => {
    const sinCifra = {
      ...VEREDICTOS_OK,
      revenue: { ...VEREDICTOS_OK.revenue, verdict: "unclear", amountEurM: null },
    };
    const r = parseVerdicts(JSON.stringify(sinCifra));
    expect(r.veredictos.revenue.verdict).toBe("unclear");
    expect(r.veredictos.revenue.amountEurM).toBeNull();
  });

  it("normaliza sources a array de strings aunque llegue basura", () => {
    const sucio = { ...VEREDICTOS_OK, revenue: { ...VEREDICTOS_OK.revenue, sources: null } };
    const r = parseVerdicts(JSON.stringify(sucio));
    expect(r.veredictos.revenue.sources).toEqual([]);
  });
});

describe("construirEjemplos", () => {
  it("con memoria vacía no añade apartado de ejemplos", () => {
    expect(construirEjemplos([])).toBe("");
  });

  it("mete la decisión y el motivo de cada vecino", () => {
    const texto = construirEjemplos([
      { text: "COO · Herrajes Nordeste · ACEPTADO", metadata: { decision: "yes" } },
      { text: "CEO · Vitalis · DESCARTADO por revenue", metadata: { decision: "no", reasonCode: "revenue" } },
    ]);
    expect(texto).toContain("Herrajes Nordeste");
    expect(texto).toContain("revenue");
  });

  it("ignora los documentos que no son decisiones", () => {
    expect(construirEjemplos([{ kind: "criterio", text: "Room714 vende criterio", metadata: {} }])).toBe("");
  });
});

describe("informeDesdeVeredictos", () => {
  it("reconstruye prosa legible a partir del JSON", () => {
    const informe = informeDesdeVeredictos(VEREDICTOS_OK);
    expect(informe).toContain("Fabricante de 71 M€");
    expect(informe).toContain("Facturación");
    expect(informe).toContain("≈71 M€ (2024)");
    expect(informe).toContain("https://e.example/x");
  });
});

describe("quickLook", () => {
  function clienteFalso({ json = JSON.stringify(VEREDICTOS_OK) } = {}) {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: json }],
      usage: { input_tokens: 10_000, output_tokens: 300 },
    });
    return { messages: { create } };
  }

  it("devuelve veredictos, informe y coste", async () => {
    const r = await quickLook(
      { title: "COO", company: "Herrajes Nordeste" },
      { client: clienteFalso(), ejemplos: [] },
    );
    expect(r.ok).toBe(true);
    expect(r.veredictos.revenue.verdict).toBe("pass");
    expect(r.cost).toBeGreaterThan(0);
    expect(r.depth).toBe("vistazo");
  });

  it("hace UNA sola llamada, no dos", async () => {
    const client = clienteFalso();
    await quickLook({ company: "X" }, { client, ejemplos: [] });
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it("pide la salida estructurada en la misma llamada que busca", async () => {
    const client = clienteFalso();
    await quickLook({ company: "X" }, { client, ejemplos: [] });
    const params = client.messages.create.mock.calls[0][0];
    expect(params.output_config?.format).toBeTruthy();
    expect(params.tools).toHaveLength(1);
  });

  it("no manda thinking ni effort: Haiku 4.5 no los admite como los modelos nuevos", async () => {
    const client = clienteFalso();
    await quickLook({ company: "X" }, { client, ejemplos: [] });
    const params = client.messages.create.mock.calls[0][0];
    expect(params.thinking).toBeUndefined();
    expect(params.output_config?.effort).toBeUndefined();
  });

  it("sin ejemplos NO manda un segundo bloque de sistema", async () => {
    // La API rechaza con 400 los bloques de texto vacíos o de solo espacios:
    // "text content blocks must contain non-whitespace text". Con la memoria
    // vacía —que es el estado del primer día— mandar " " hacía fallar TODAS
    // las llamadas. Comprobado contra la API real, no en teoría.
    const client = clienteFalso();
    await quickLook({ company: "X" }, { client, ejemplos: [] });
    const { system } = client.messages.create.mock.calls[0][0];
    expect(system).toHaveLength(1);
    expect(system[0].text.trim().length).toBeGreaterThan(0);
  });

  it("con ejemplos manda dos bloques, y el de ejemplos no va cacheado", async () => {
    const client = clienteFalso();
    await quickLook(
      { company: "X" },
      {
        client,
        ejemplos: [
          { text: "COO · Herrajes Nordeste · ACEPTADO", metadata: { decision: "yes" } },
        ],
      },
    );
    const { system } = client.messages.create.mock.calls[0][0];
    expect(system).toHaveLength(2);
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(system[1].cache_control).toBeUndefined();
    expect(system[1].text).toContain("Herrajes Nordeste");
  });

  it("ningún bloque de sistema puede ser vacío o de solo espacios", async () => {
    for (const ejemplos of [[], [{ kind: "criterio", text: "x", metadata: {} }]]) {
      const client = clienteFalso();
      await quickLook({ company: "X" }, { client, ejemplos });
      for (const bloque of client.messages.create.mock.calls[0][0].system) {
        expect(bloque.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("usa el modelo del vistazo, no el caro", async () => {
    const client = clienteFalso();
    await quickLook({ company: "X" }, { client, ejemplos: [] });
    expect(client.messages.create.mock.calls[0][0].model).toBe(MODELO_VISTAZO);
  });

  it("el informe que devuelve es prosa, no el JSON en crudo", async () => {
    // El chat y el análisis a fondo consumen `report` como contexto: pasarles
    // el JSON tal cual lo leerían peor.
    const r = await quickLook({ company: "X" }, { client: clienteFalso(), ejemplos: [] });
    expect(r.report).toContain("Facturación");
    expect(r.report.trim().startsWith("{")).toBe(false);
  });

  it("si el JSON no se puede parsear, devuelve ok false con el coste ya gastado", async () => {
    const r = await quickLook(
      { company: "X" },
      { client: clienteFalso({ json: "no soy json" }), ejemplos: [] },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/json/i);
    expect(r.cost).toBeGreaterThan(0);
  });

  it("si la API lanza, devuelve ok false sin romper el cron", async () => {
    const client = { messages: { create: vi.fn().mockRejectedValue(new Error("529 overloaded")) } };
    const r = await quickLook({ company: "X" }, { client, ejemplos: [] });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/529/);
  });
});

describe("deepDive", () => {
  function clienteFondo() {
    const create = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "informe largo en prosa con fuentes" }],
        usage: { input_tokens: 50_000, output_tokens: 2_000 },
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(VEREDICTOS_OK) }],
        usage: { input_tokens: 2_000, output_tokens: 400 },
      });
    return { messages: { create } };
  }

  it("hace DOS llamadas y devuelve el informe en prosa de la primera", async () => {
    const client = clienteFondo();
    const r = await deepDive({ company: "X" }, { client, ejemplos: [] });
    expect(client.messages.create).toHaveBeenCalledTimes(2);
    expect(r.report).toBe("informe largo en prosa con fuentes");
    expect(r.depth).toBe("fondo");
  });

  it("la primera llamada busca sin esquema; la segunda estructura sin herramientas", async () => {
    const client = clienteFondo();
    await deepDive({ company: "X" }, { client, ejemplos: [] });
    const [primera, segunda] = client.messages.create.mock.calls.map((c) => c[0]);
    expect(primera.tools).toHaveLength(1);
    expect(primera.output_config).toBeUndefined();
    expect(segunda.tools).toBeUndefined();
    expect(segunda.output_config?.format).toBeTruthy();
  });

  it("usa el modelo caro y pensamiento adaptativo", async () => {
    const client = clienteFondo();
    await deepDive({ company: "X" }, { client, ejemplos: [] });
    const primera = client.messages.create.mock.calls[0][0];
    expect(primera.model).toBe(MODELO_FONDO);
    expect(primera.thinking).toEqual({ type: "adaptive" });
  });

  it("le dice explícitamente qué criterios quedaron en duda", async () => {
    const client = clienteFondo();
    await deepDive(
      { company: "X" },
      {
        client,
        ejemplos: [],
        dossierPrevio: {
          report: "el vistazo dijo esto",
          veredictos: { ...VEREDICTOS_OK, itTeam: { verdict: "unclear" } },
        },
      },
    );
    const prompt = client.messages.create.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain("el vistazo dijo esto");
    expect(prompt).toContain("itTeam");
  });

  it("suma el coste de las dos llamadas", async () => {
    const client = clienteFondo();
    const r = await deepDive({ company: "X" }, { client, ejemplos: [] });
    expect(r.cost).toBeGreaterThan(0.2); // 50k entrada de opus 5 ya son 0,25 $
  });
});
