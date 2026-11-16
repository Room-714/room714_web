import { describe, expect, it } from "vitest";
import {
  ASUNTO_INVENTARIO,
  htmlInventario,
  textoInventario,
  urlFormulario,
} from "@/app/lib/leads/emailInventario";
import { CIERRE, NIVELES, NORMATIVA, PASOS, diagnostico } from "@/app/lib/inventarioIa";

const CRITICA = {
  herramientas: ["chat"],
  quien: ["porSuCuenta"],
  datos: ["clientes"],
  normas: ["ninguna"],
  formacion: ["no"],
  cuentas: ["personales"],
  plan: ["no"],
};

const ORDENADA = {
  herramientas: ["chat"],
  quien: ["equipos"],
  datos: ["documentos"],
  normas: ["politica"],
  formacion: ["adaptada"],
  cuentas: ["gestionadas"],
  plan: ["plan"],
};

describe("email del diagnóstico", () => {
  it("lleva el nivel, la normativa, los tres pasos y el cierre", () => {
    const d = diagnostico(CRITICA);
    const html = htmlInventario(d);
    expect(ASUNTO_INVENTARIO).toBe("Tu diagnóstico de IA");
    expect(html).toContain("Criticidad muy alta");
    expect(html).toContain(NIVELES.critico.etiqueta);
    expect(html).toContain(NIVELES.critico.titular);
    expect(html).toContain(NORMATIVA.articulo4.titulo);
    expect(html).toContain(NORMATIVA.rgpd.titulo);
    for (const p of [PASOS.datos, PASOS.cuentas, PASOS.normas]) {
      expect(html).toContain(p);
    }
    expect(html).toContain(CIERRE.titulo);
    expect(urlFormulario()).toBe("https://www.room714.com/es/hablemos");
    expect(html).toContain(urlFormulario());
    expect(html).not.toContain("/descargas/");
  });

  it("en «Bajo» y sin pasos no pinta esas secciones", () => {
    const d = diagnostico(ORDENADA);
    const html = htmlInventario(d);
    expect(html).toContain(NIVELES.bajo.titular);
    expect(html).not.toContain("Lo que dice la normativa");
    expect(html).not.toContain("primeros pasos");
    expect(html).toContain(CIERRE.titulo);
  });

  it("la versión en texto plano lleva lo mismo", () => {
    const texto = textoInventario(diagnostico(CRITICA));
    expect(texto).toContain("Tu diagnóstico de IA · Criticidad muy alta");
    expect(texto).toContain(`1. ${PASOS.datos}`);
    expect(texto).toContain(urlFormulario());
  });
});
