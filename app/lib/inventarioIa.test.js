import { describe, expect, it } from "vitest";
import {
  NIVELES,
  NORMATIVA,
  PASOS,
  PREGUNTAS,
  TITULOS_PASOS,
  diagnostico,
  fraseEnvio,
  nivel,
  pasos,
  riesgos,
  validarRespuestas,
} from "@/app/lib/inventarioIa";

// Una empresa ordenada: sin riesgos y con plan.
const ORDENADA = {
  datos: ["documentos", "codigo"],
  normas: ["politica"],
  formacion: ["adaptada"],
  cuentas: ["gestionadas"],
  plan: ["plan"],
};

const CRITICA = {
  ...ORDENADA,
  datos: ["documentos", "clientes"],
  normas: ["ninguna"],
  formacion: ["no"],
  cuentas: ["personales"],
  plan: ["no"],
};

describe("nivel de gravedad", () => {
  it("crítico: datos sensibles, sin normas, sin formación y cuentas personales", () => {
    expect(riesgos(CRITICA).puntos).toBe(9);
    expect(nivel(CRITICA)).toBe("critico");
  });

  it("sin datos sensibles nunca es crítico, aunque sume mucho", () => {
    const r = { ...CRITICA, datos: ["documentos", "nose"] };
    expect(riesgos(r).puntos).toBeGreaterThanOrEqual(8);
    expect(nivel(r)).toBe("alto");
  });

  it("datos sensibles y sin normas: como mínimo alto", () => {
    expect(nivel({ ...ORDENADA, datos: ["financiera"], normas: ["ninguna"] })).toBe("alto");
  });

  it("alto sin datos sensibles: no saber qué se usa, cuentas personales y normas informales", () => {
    const r = { ...ORDENADA, datos: ["nose"], cuentas: ["personales"], normas: ["informales"] };
    expect(riesgos(r).puntos).toBe(5);
    expect(nivel(r)).toBe("alto");
  });

  it("moderado: normas informales y formación parcial", () => {
    expect(nivel({ ...ORDENADA, normas: ["informales"], formacion: ["algunas"] })).toBe("moderado");
  });

  it("bajo: una empresa ordenada", () => {
    expect(riesgos(ORDENADA).puntos).toBe(0);
    expect(nivel(ORDENADA)).toBe("bajo");
  });
});

describe("pasos", () => {
  it("los tres más urgentes, en el orden fijado", () => {
    expect(pasos(CRITICA)).toEqual(["datos", "cuentas", "normas"]);
  });

  it("sin datos sensibles empieza por lo siguiente que aplica", () => {
    const r = { ...ORDENADA, datos: ["nose"], formacion: ["no"], plan: ["pruebas"] };
    expect(pasos(r)).toEqual(["visibilidad", "formacion", "plan"]);
  });

  it("una empresa ordenada sin plan solo tiene el paso del plan", () => {
    expect(pasos({ ...ORDENADA, plan: ["no"] })).toEqual(["plan"]);
  });

  it("una empresa ordenada con plan no tiene pasos", () => {
    expect(pasos(ORDENADA)).toEqual([]);
  });
});

describe("diagnostico", () => {
  it("crítico con datos de clientes: artículo 4 y RGPD", () => {
    const d = diagnostico(CRITICA);
    expect(d.nivel).toBe("critico");
    expect(d.titular).toBe(NIVELES.critico.titular);
    expect(d.normativa).toEqual([NORMATIVA.articulo4, NORMATIVA.rgpd]);
    expect(d.pasos).toEqual([PASOS.datos, PASOS.cuentas, PASOS.normas]);
  });

  it("con datos financieros pero no personales: solo el artículo 4", () => {
    const d = diagnostico({ ...ORDENADA, datos: ["financiera"], normas: ["ninguna"] });
    expect(d.normativa).toEqual([NORMATIVA.articulo4]);
  });

  it("en «Bajo» no se menciona la normativa", () => {
    const d = diagnostico({ ...ORDENADA, plan: ["no"] });
    expect(d.nivel).toBe("bajo");
    expect(d.normativa).toEqual([]);
  });

  it("meter datos de empleados ya no es «Bajo» y trae el RGPD", () => {
    const d = diagnostico({ ...ORDENADA, datos: ["empleados"] });
    expect(d.nivel).toBe("moderado");
    expect(d.normativa).toEqual([NORMATIVA.articulo4, NORMATIVA.rgpd]);
  });
});

describe("validarRespuestas", () => {
  it("acepta respuestas completas y las ordena como las opciones", () => {
    const v = validarRespuestas({ ...ORDENADA, datos: ["codigo", "documentos"] });
    expect(v.datos).toEqual(["documentos", "codigo"]);
  });

  it("rechaza si falta una de las preguntas nuevas", () => {
    const { cuentas, ...sinCuentas } = ORDENADA;
    expect(cuentas).toBeDefined();
    expect(validarRespuestas(sinCuentas)).toBeNull();
  });

  it("rechaza ids desconocidos y varias respuestas en una pregunta de respuesta única", () => {
    expect(validarRespuestas({ ...ORDENADA, plan: ["quizas"] })).toBeNull();
    expect(validarRespuestas({ ...ORDENADA, cuentas: ["personales", "gestionadas"] })).toBeNull();
  });
});

describe("cuestionario de cinco preguntas", () => {
  it("son datos, normas, formación, cuentas y plan", () => {
    expect(PREGUNTAS.map((p) => p.id)).toEqual(["datos", "normas", "formacion", "cuentas", "plan"]);
  });

  it("una respuesta antigua con herramientas y quien sigue valiendo: las claves de más se ignoran", () => {
    const v = validarRespuestas({ ...ORDENADA, herramientas: ["chat"], quien: ["equipos"] });
    expect(v).toEqual(ORDENADA);
  });

  it("las reglas no fallan si falta una pregunta", () => {
    expect(() => diagnostico({ datos: ["clientes"] })).not.toThrow();
    expect(riesgos({}).puntos).toBe(0);
  });
});

describe("primer paso en pantalla", () => {
  it("lleva el título corto y la frase del paso", () => {
    expect(diagnostico(CRITICA).primerPaso).toEqual({ titulo: TITULOS_PASOS.datos, texto: PASOS.datos });
  });

  it("sin pasos no hay primer paso", () => {
    expect(diagnostico(ORDENADA).primerPaso).toBeNull();
  });

  it("todos los pasos tienen título", () => {
    expect(Object.keys(TITULOS_PASOS).sort()).toEqual(Object.keys(PASOS).sort());
  });
});

describe("frase sobre el formulario", () => {
  it("con tres pasos y normativa: dice lo que llega al correo", () => {
    expect(fraseEnvio(diagnostico(CRITICA))).toBe(
      "Te enviamos a tu correo el diagnóstico completo, con los otros dos pasos recomendados y la normativa que te afecta.",
    );
  });

  it("con dos pasos, uno más", () => {
    expect(fraseEnvio({ pasos: ["a", "b"], normativa: [] })).toBe(
      "Te enviamos a tu correo el diagnóstico completo, con el otro paso recomendado.",
    );
  });

  it("con un paso y sin normativa, o sin pasos, una frase genérica", () => {
    expect(fraseEnvio({ pasos: ["a"], normativa: [] })).toBe("Te enviamos el diagnóstico completo a tu correo.");
    expect(fraseEnvio(diagnostico(ORDENADA))).toBe("Te enviamos el diagnóstico completo a tu correo.");
  });

  it("nunca promete un plan que el correo no lleva", () => {
    expect(fraseEnvio(diagnostico(CRITICA))).not.toMatch(/plan/);
  });
});
