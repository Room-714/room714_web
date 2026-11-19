import { describe, expect, it, vi } from "vitest";
import { MODEL } from "@/app/lib/ai/anthropic";
import {
  CIERRE,
  MAX_CARACTERES,
  MIN_CARACTERES,
  buildPerfilPrompt,
  buscarRepeticion,
  fraseInicial,
  generarTextoPerfil,
  incumplimientos,
  montarTextoPerfil,
} from "./perfilPersonal";

// Un cuerpo de ~700 caracteres, como lo escribiría el modelo.
const cuerpo = (inicio = "Una aseguradora perdía a la mitad de sus clientes en el alta digital.") =>
  [
    inicio,
    "El formulario pedía catorce datos antes de enseñar un solo precio y nadie en el equipo lo veía como un problema, porque cada campo tenía un dueño que lo defendía en su comité.",
    "Lo que había detrás no era diseño: era que cada área había añadido su pregunta por si acaso, sin medir lo que costaba en abandonos ni quién la usaba después.",
    "Quitamos todo lo que no hacía falta para dar un precio y dejamos el resto para cuando el cliente ya había decidido. Las altas completas subieron y el soporte dejó de recibir llamadas de gente atascada en el paso tres.",
  ].join("\n\n");

const cuerpoDistinto = () =>
  [
    "En retail vi algo parecido la semana pasada: una cadena cobraba dos veces a quien cambiaba de tienda.",
    "Cada sistema cuadraba por separado, así que ningún informe lo enseñaba y las reclamaciones llegaban sueltas a atención al cliente, que las resolvía una a una sin ver el patrón.",
    "El fallo estaba en el traspaso del pedido entre tiendas, que nadie había dibujado de principio a fin porque cada equipo solo conocía su tramo.",
    "Pintamos el recorrido completo con el equipo de caja, encontramos el doble cobro en una tarde y lo cerramos antes del siguiente cierre mensual, que era cuando más dolía.",
  ].join("\n\n");

const respuesta = ({ texto = cuerpo(), hashtags = ["ExperienciaDeCliente"], idea = "Quitar campos del alta que nadie usa" } = {}) => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", name: "publicacion_perfil", input: { texto, hashtags, idea } }],
  usage: { input_tokens: 10, output_tokens: 20 },
});

const clienteFalso = (...respuestas) => {
  const create = vi.fn();
  for (const r of respuestas) create.mockResolvedValueOnce(r);
  return { messages: { create } };
};

const POST = { id: 9, titulo: "El alta que nadie termina", contenidoHtml: "<p>Contenido</p>" };

describe("montarTextoPerfil (reglas que se aplican en código)", () => {
  it("quita enlaces, emojis y hashtags del cuerpo", () => {
    const t = montarTextoPerfil({
      texto: "Un banco perdía clientes 🚀🔥.\n\nMás en https://www.room714.com/es/blog/x, www.room714.com y room714.com/es #UX",
      hashtags: [],
    });
    expect(t).not.toMatch(/https?:|www\.|room714\.com|🚀|🔥|#UX/);
    expect(t).toContain("Un banco perdía clientes");
  });

  it("cierra siempre con la invitación al diagnóstico, una sola vez", () => {
    const t = montarTextoPerfil({
      texto: `${cuerpo()}\n\n¿Te suena? Escríbeme y hacemos una sesión de diagnóstico.`,
      hashtags: [],
    });
    expect(t.endsWith(CIERRE)).toBe(true);
    expect(t.match(/diagn[oó]stico/g)).toHaveLength(1);
  });

  it("como mucho 3 hashtags, al final y normalizados", () => {
    const t = montarTextoPerfil({ texto: cuerpo(), hashtags: ["#UX", "Producto Digital", "CX", "Banca", "UX"] });
    expect(t.split("\n\n").at(-1)).toBe("#UX #ProductoDigital #CX");
    expect(t.split("\n\n").at(-2)).toBe(CIERRE);
  });
});

describe("incumplimientos", () => {
  it(`exige entre ${MIN_CARACTERES} y ${MAX_CARACTERES} caracteres`, () => {
    expect(incumplimientos(montarTextoPerfil({ texto: cuerpo() }))).toEqual([]);
    expect(incumplimientos(montarTextoPerfil({ texto: "Corto." }))[0]).toMatch(/mínimo/);
    expect(incumplimientos(montarTextoPerfil({ texto: cuerpo().repeat(3) }))[0]).toMatch(/máximo/);
  });
});

describe("deduplicación contra los últimos textos del perfil", () => {
  const publicado = {
    postId: 1,
    texto: montarTextoPerfil({ texto: cuerpo("Un operador de telco tenía tres apps para lo mismo.") }),
    idea: "Unificar las apps del cliente de una telco",
  };

  it("fraseInicial corta en el primer punto", () => {
    expect(fraseInicial("Primera frase. Segunda frase.")).toBe("Primera frase.");
    expect(fraseInicial("¿Pregunta inicial? Resto")).toBe("¿Pregunta inicial?");
  });

  it("detecta la misma frase inicial", () => {
    const nuevo = { texto: montarTextoPerfil({ texto: cuerpo("Un operador de telco tenía tres apps para lo mismo.") }), idea: "Otra cosa distinta", postId: 2 };
    expect(buscarRepeticion(nuevo, [publicado])).toMatchObject({ tipo: "frase" });
  });

  it("detecta una frase inicial casi igual", () => {
    const nuevo = { texto: montarTextoPerfil({ texto: cuerpo("Un operador de telco tenía tres apps distintas para lo mismo.") }), idea: "x", postId: 2 };
    expect(buscarRepeticion(nuevo, [publicado])?.tipo).toBe("frase");
  });

  it("detecta la misma idea con otras palabras de arranque", () => {
    const nuevo = { texto: montarTextoPerfil({ texto: cuerpo("Hace poco vi otra vez el mismo error.") }), idea: "Unificar las apps de cliente de una telco", postId: 2 };
    expect(buscarRepeticion(nuevo, [publicado])).toMatchObject({ tipo: "idea" });
  });

  it("un post del blog ya usado cuenta como idea repetida", () => {
    const nuevo = { texto: "Otra cosa completamente distinta sobre facturas.", idea: "Facturas", postId: 1 };
    expect(buscarRepeticion(nuevo, [publicado])).toMatchObject({ tipo: "idea" });
  });

  it("un texto distinto pasa", () => {
    const nuevo = {
      texto: "Una cadena de retail cobraba dos veces a los clientes que cambiaban de tienda. Nadie lo veía porque cada sistema cuadraba por separado.",
      idea: "Cobros duplicados entre tiendas de retail",
      postId: 2,
    };
    expect(buscarRepeticion(nuevo, [publicado])).toBeNull();
  });

  it("solo compara con los últimos 20", () => {
    const relleno = Array.from({ length: 20 }, (_, i) => ({
      postId: 100 + i,
      texto: `Texto ${i} sobre facturación número ${i}.`,
      idea: `Idea ${i} de facturación`,
    }));
    const nuevo = { texto: publicado.texto, idea: publicado.idea, postId: 2 };
    expect(buscarRepeticion(nuevo, [...relleno, publicado])).toBeNull();
  });
});

describe("generarTextoPerfil", () => {
  it("devuelve el texto final con el modelo del proyecto", async () => {
    const client = clienteFalso(respuesta());
    const r = await generarTextoPerfil({ post: POST, recientes: [], client });
    expect(r.intentos).toBe(1);
    expect(r.texto.endsWith("#ExperienciaDeCliente")).toBe(true);
    expect(r.texto).toContain(CIERRE);
    expect(r.idea).toBe("Quitar campos del alta que nadie usa");
    const args = client.messages.create.mock.calls[0][0];
    expect(args.model).toBe(MODEL);
    expect(args.tool_choice).toEqual({ type: "tool", name: "publicacion_perfil" });
  });

  it("si repite la frase inicial de uno publicado, lo pide otra vez y explica por qué", async () => {
    const recientes = [{ postId: 1, texto: montarTextoPerfil({ texto: cuerpo() }), idea: "Otra idea sobre bancos" }];
    const client = clienteFalso(
      respuesta(),
      respuesta({ texto: cuerpoDistinto(), idea: "Cobros duplicados entre tiendas" }),
    );
    const r = await generarTextoPerfil({ post: POST, recientes, client });
    expect(r.intentos).toBe(2);
    expect(r.texto.startsWith("En retail vi algo parecido")).toBe(true);
    expect(client.messages.create.mock.calls[1][0].messages[0].content).toMatch(/frase inicial repite/);
  });

  it("si tampoco vale el segundo intento, lanza un error con el motivo", async () => {
    const client = clienteFalso(respuesta({ texto: "Corto." }), respuesta({ texto: "Corto también." }));
    await expect(generarTextoPerfil({ post: POST, client })).rejects.toThrow(/2 intentos.*mínimo/);
  });

  it("si el modelo rechaza, lanza un error", async () => {
    const client = clienteFalso({ stop_reason: "refusal", content: [] });
    await expect(generarTextoPerfil({ post: POST, client })).rejects.toThrow("no ha querido");
  });

  it("el prompt lleva las reglas y las aperturas ya usadas", () => {
    const prompt = buildPerfilPrompt({
      titulo: "T",
      contenidoHtml: "<p>Hola <b>mundo</b></p>",
      recientes: [{ texto: "Primera frase usada. Resto.", idea: "Idea usada" }],
    });
    expect(prompt).toContain("Hola mundo");
    expect(prompt).toMatch(/telco, seguros, banca o retail/);
    expect(prompt).toMatch(/Prohibido el contenido genérico sobre IA/);
    expect(prompt).toContain("«Primera frase usada.»");
    expect(prompt).toContain("Idea usada");
  });
});
