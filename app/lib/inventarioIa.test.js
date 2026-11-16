import { describe, expect, it } from "vitest";
import {
  PUNTOS,
  calcularResultado,
  encabezado,
  validarRespuestas,
} from "@/app/lib/inventarioIa";

// Los tres recorridos que pide la verificación, más los bordes.
const TODO_NOSE = {
  herramientas: ["nose"],
  quien: ["casiNadie"],
  datos: ["nose"],
  normas: ["ninguna"],
  formacion: ["no"],
};

const SIN_PUNTOS = {
  herramientas: ["chat", "ofimatica"],
  quien: ["equipos"],
  datos: ["documentos", "codigo"],
  normas: ["politica"],
  formacion: ["adaptada"],
};

const MEZCLA = {
  herramientas: ["chat", "gestion", "programacion"],
  quien: ["porSuCuenta"],
  datos: ["documentos", "clientes"],
  normas: ["informales"],
  formacion: ["adaptada"],
};

describe("calcularResultado", () => {
  it("todo «No lo sé con certeza»: visibilidad, política y formación", () => {
    const r = calcularResultado(TODO_NOSE);
    expect(r.herramientas).toBe(0);
    expect(r.puntos).toEqual([PUNTOS.visibilidad, PUNTOS.politica, PUNTOS.formacion]);
    expect(r.encabezado).toBe("0 tipos de herramienta en uso y 3 puntos a revisar.");
    expect(r.buenaBase).toBe(false);
  });

  it("respuestas sin puntos a revisar: buena base", () => {
    const r = calcularResultado(SIN_PUNTOS);
    expect(r.puntos).toEqual([]);
    expect(r.buenaBase).toBe(true);
    expect(r.encabezado).toBe("2 tipos de herramienta en uso y 0 puntos a revisar.");
  });

  it("una mezcla: puntos en el orden fijado", () => {
    const r = calcularResultado(MEZCLA);
    expect(r.puntos).toEqual([PUNTOS.porSuCuenta, PUNTOS.sensible, PUNTOS.politica]);
    expect(r.encabezado).toBe("3 tipos de herramienta en uso y 3 puntos a revisar.");
  });

  it("«No lo sé» solo en la pregunta 3 también dispara la visibilidad", () => {
    const r = calcularResultado({ ...SIN_PUNTOS, datos: ["nose"] });
    expect(r.puntos).toEqual([PUNTOS.visibilidad]);
  });

  it("cualquiera de los tres datos sensibles dispara el punto", () => {
    for (const id of ["clientes", "empleados", "financiera"]) {
      expect(calcularResultado({ ...SIN_PUNTOS, datos: [id] }).puntos).toEqual([
        PUNTOS.sensible,
      ]);
    }
  });

  it("«No lo sé» no cuenta como tipo de herramienta", () => {
    expect(calcularResultado({ ...SIN_PUNTOS, herramientas: ["chat", "nose"] }).herramientas).toBe(1);
  });
});

describe("encabezado", () => {
  it("cuida el singular", () => {
    expect(encabezado(1, 1)).toBe("1 tipo de herramienta en uso y 1 punto a revisar.");
    expect(encabezado(5, 2)).toBe("5 tipos de herramienta en uso y 2 puntos a revisar.");
  });
});

describe("validarRespuestas", () => {
  it("acepta respuestas correctas y las ordena como las opciones", () => {
    expect(validarRespuestas({ ...SIN_PUNTOS, herramientas: ["ofimatica", "chat"] }).herramientas).toEqual([
      "chat",
      "ofimatica",
    ]);
  });

  it("rechaza preguntas sin responder, ids desconocidos y dobles en las únicas", () => {
    expect(validarRespuestas({ ...SIN_PUNTOS, quien: [] })).toBeNull();
    expect(validarRespuestas({ ...SIN_PUNTOS, datos: ["inventado"] })).toBeNull();
    expect(validarRespuestas({ ...SIN_PUNTOS, normas: ["ninguna", "politica"] })).toBeNull();
    expect(validarRespuestas({ herramientas: ["chat"] })).toBeNull();
    expect(validarRespuestas(null)).toBeNull();
  });
});
