import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildUserPrompt,
  buildTakesPrompt,
  validateTakes,
  generateLinkedInTakes,
} from "./generator";
import { getAnthropicClient } from "./anthropic";

// Mock del cliente Anthropic: generateLinkedInTakes es la única pieza de esta
// tarea que hace una llamada real, y es la que gasta dinero y tiene el modo de
// fallo caro (reintento agota la generación y puede dejar la semana sin
// publicaciones). Se prueba aquí el bucle de reintentos, no el modelo en sí.
vi.mock("./anthropic", () => ({
  getAnthropicClient: vi.fn(),
  MODEL: "claude-test-model",
}));

const TRENDING = [
  { title: "Un titular en tendencia", source: "Medium", description: "..." },
];

const RECENT = [
  {
    date: "2026-07-27",
    category: "TECH",
    title: "Post reciente con slug",
    tags: ["IA"],
    slug_es: "post-reciente-con-slug",
    slug_en: "recent-post-with-slug",
  },
];

const CORPUS = [
  {
    date: "2026-06-01",
    category: "TECH",
    title_es: "Seguridad en IA para equipos pequeños",
    title_en: "AI security for small teams",
    tags: ["IA", "Seguridad"],
  },
  {
    date: "2026-05-04",
    category: "UX",
    title_es: "La paradoja de la elección en onboarding",
    title_en: "The paradox of choice in onboarding",
    tags: ["UX"],
  },
];

function prompt(extra = {}) {
  return buildUserPrompt({
    category: "TECH",
    trending: TRENDING,
    recentPosts: RECENT,
    ...extra,
  });
}

describe("buildUserPrompt — corpus publicado", () => {
  it("incluye los títulos del corpus que se le pasan", () => {
    const out = prompt({ publishedCorpus: CORPUS });
    expect(out).toContain("Seguridad en IA para equipos pequeños");
    expect(out).toContain("La paradoja de la elección en onboarding");
  });

  it("agrupa por categoría y anota fecha y tags", () => {
    const out = prompt({ publishedCorpus: CORPUS });
    expect(out).toContain("### TECH");
    expect(out).toContain("### UX");
    expect(out).toContain("(2026-06-01)");
    expect(out).toContain("[IA, Seguridad]");
  });

  it("lleva la instrucción explícita de no repetir ángulos", () => {
    const out = prompt({ publishedCorpus: CORPUS });
    expect(out).toContain("NO repitas ninguno de estos ángulos");
    expect(out).toContain("Google trate ambos como duplicados");
  });

  it("cae en silencio si no hay corpus", () => {
    expect(prompt({ publishedCorpus: [] })).not.toContain("Corpus ya publicado");
    expect(prompt()).not.toContain("Corpus ya publicado");
  });

  it("mantiene intacta la sección de posts recientes con sus slugs", () => {
    // validateGenerated la usa para validar los enlaces internos: si
    // desapareciera, el enlazado interno se rompería en silencio.
    const out = prompt({ publishedCorpus: CORPUS });
    expect(out).toContain("slug_es: post-reciente-con-slug");
    expect(out).toContain("INTERNAL LINKING");
  });

  it("usa el título en inglés si falta el español", () => {
    const out = prompt({
      publishedCorpus: [
        {
          date: "2026-04-01",
          category: "PRODUCT",
          title_es: null,
          title_en: "Only english title",
          tags: [],
        },
      ],
    });
    expect(out).toContain("Only english title");
  });
});

describe("buildTakesPrompt", () => {
  const base = {
    articleTitle: "El impuesto de lujo de la deuda técnica",
    articleContentEs: "<p>Un párrafo del artículo.</p><h2>Sección</h2>",
    articleUrl: "https://www.room714.com/es/blog/impuesto-de-lujo",
    count: 3,
    crossActions: ["reshare_company", "comment_personal", "reshare_company"],
  };

  it("pide exactamente el número de tomas que se le indica", () => {
    expect(buildTakesPrompt(base)).toContain("exactamente 3 tomas");
    expect(buildTakesPrompt({ ...base, count: 2 })).toContain(
      "exactamente 2 tomas",
    );
  });

  it("incluye el título y el contenido del artículo", () => {
    const prompt = buildTakesPrompt(base);
    expect(prompt).toContain("El impuesto de lujo de la deuda técnica");
    expect(prompt).toContain("Un párrafo del artículo.");
  });

  it("describe la acción cruzada de cada toma", () => {
    const prompt = buildTakesPrompt(base);
    expect(prompt).toContain("Toma 1:");
    expect(prompt).toContain("RECOMPARTICIÓN DE ROOM714");
    expect(prompt).toContain("Toma 3:");
    expect(prompt).toContain("COMENTARIO DE JOSÉ");
  });

  it("no habla de acciones cruzadas si no hay ninguna", () => {
    const prompt = buildTakesPrompt({
      ...base,
      crossActions: [null, null, null],
    });
    expect(prompt).not.toContain("ACCIONES CRUZADAS");
  });

  it("no menciona tomas que no se han pedido", () => {
    const prompt = buildTakesPrompt({ ...base, count: 2 });
    expect(prompt).toContain("Toma 2:");
    expect(prompt).not.toContain("Toma 3:");
  });
});

describe("validateTakes", () => {
  const take = {
    angle: "data",
    text: "Un post de LinkedIn suficientemente largo para pasar por bueno.",
    hashtags: ["#IA", "#UX"],
    image_query: "abstract industrial texture",
    cross_note: "Sugerencia",
  };

  it("acepta el número exacto de tomas", () => {
    const data = { takes: [take, take] };
    expect(validateTakes(data, 2).takes).toHaveLength(2);
  });

  it("rechaza si vienen de menos", () => {
    expect(() => validateTakes({ takes: [take] }, 3)).toThrow(
      /exactamente 3 tomas/,
    );
  });

  it("recorta si vienen de más en vez de tirar la generación", () => {
    const data = { takes: [take, take, take] };
    expect(validateTakes(data, 2).takes).toHaveLength(2);
  });

  it("rechaza una toma sin texto", () => {
    const rota = { ...take, text: "" };
    expect(() => validateTakes({ takes: [take, rota] }, 2)).toThrow(
      /takes\[1\] incompleto/,
    );
  });

  it("rechaza una toma sin hashtags en array", () => {
    const rota = { ...take, hashtags: "#IA" };
    expect(() => validateTakes({ takes: [rota] }, 1)).toThrow(
      /takes\[0\] incompleto/,
    );
  });
});

describe("generateLinkedInTakes", () => {
  const take = {
    angle: "data",
    text: "Un post de LinkedIn suficientemente largo para pasar por bueno.",
    hashtags: ["#IA", "#UX"],
    image_query: "abstract industrial texture",
    cross_note: "",
  };

  // Construye una respuesta de la API con la forma mínima que
  // generateLinkedInTakes necesita leer (stop_reason, content, usage).
  function mockResponse(takes) {
    return {
      stop_reason: "tool_use",
      content: [
        { type: "tool_use", name: "create_linkedin_takes", input: { takes } },
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("si el primer intento no valida, reintenta y devuelve las tomas del segundo", async () => {
    const create = vi
      .fn()
      // Primer intento: la toma 0 llega sin texto, validateTakes la rechaza.
      .mockResolvedValueOnce(mockResponse([{ ...take, text: "" }, take]))
      // Segundo intento: las dos tomas llegan completas.
      .mockResolvedValueOnce(mockResponse([take, take]));
    getAnthropicClient.mockReturnValue({ messages: { create } });

    const result = await generateLinkedInTakes({
      articleTitle: "Título",
      articleContentEs: "<p>Contenido</p>",
      articleUrl: "https://www.room714.com/es/blog/x",
      count: 2,
      crossActions: [null, null],
    });

    expect(result.takes).toHaveLength(2);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("si los dos intentos fallan, lanza tras agotarlos", async () => {
    const create = vi
      .fn()
      .mockResolvedValue(mockResponse([{ ...take, text: "" }]));
    getAnthropicClient.mockReturnValue({ messages: { create } });

    await expect(
      generateLinkedInTakes({
        articleTitle: "Título",
        articleContentEs: "<p>Contenido</p>",
        articleUrl: "https://www.room714.com/es/blog/x",
        count: 1,
        crossActions: [null],
      }),
    ).rejects.toThrow(/tras 2 intentos/);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
