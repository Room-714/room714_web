import { describe, expect, it } from "vitest";
import {
  NIVELES,
  NORMATIVA,
  PASOS,
  diagnostico,
  nivel,
  pasos,
  riesgos,
  validarRespuestas,
} from "@/app/lib/inventarioIa";

// Una empresa ordenada: sin riesgos y con plan.
const ORDENADA = {
  herramientas: ["chat", "ofimatica"],
  quien: ["equipos"],
  datos: ["documentos", "codigo"],
  normas: ["politica"],
  formacion: ["adaptada"],
  cuentas: ["gestionadas"],
  plan: ["plan"],
};

const CRITICA = {
  ...ORDENADA,
  quien: ["porSuCuenta"],
  datos: ["documentos", "clientes"],
  normas: ["ninguna"],
  formacion: ["no"],
  cuentas: ["personales"],
  plan: ["no"],
};

describe("nivel de gravedad", () => {
  it("crítico: datos sensibles, sin normas, sin formación y cuentas personales", () => {
    expect(riesgos(CRITICA).puntos).toBe(10);
    expect(nivel(CRITICA)).toBe("critico");
  });

  it("sin datos sensibles nunca es crítico, aunque sume mucho", () => {
    const r = { ...CRITICA, datos: ["documentos"], herramientas: ["nose"] };
    expect(riesgos(r).puntos).toBeGreaterThanOrEqual(8);
    expect(nivel(r)).toBe("alto");
  });

  it("datos sensibles y sin normas: como mínimo alto", () => {
    expect(nivel({ ...ORDENADA, datos: ["financiera"], normas: ["ninguna"] })).toBe("alto");
  });

  it("alto sin datos sensibles: no saber qué se usa, cuentas personales y normas informales", () => {
    const r = { ...ORDENADA, herramientas: ["nose"], cuentas: ["personales"], normas: ["informales"] };
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
    const r = { ...ORDENADA, herramientas: ["nose"], formacion: ["no"], plan: ["pruebas"] };
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
    const v = validarRespuestas({ ...ORDENADA, herramientas: ["ofimatica", "chat"] });
    expect(v.herramientas).toEqual(["chat", "ofimatica"]);
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
