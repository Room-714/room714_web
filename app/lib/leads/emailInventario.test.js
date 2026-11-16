import { describe, expect, it } from "vitest";
import { htmlInventario, textoInventario, urlFormulario } from "@/app/lib/leads/emailInventario";
import { PUNTOS, calcularResultado } from "@/app/lib/inventarioIa";
import { DESCARGAS } from "@/app/data/incorporarIa";

const base = {
  herramientas: ["chat"],
  quien: ["equipos"],
  datos: ["documentos"],
  normas: ["politica"],
  formacion: ["adaptada"],
};

describe("email del inventario", () => {
  it("lleva el resumen, los cuatro enlaces y el enlace al formulario", () => {
    const r = calcularResultado({ ...base, quien: ["porSuCuenta"] });
    const html = htmlInventario(r);
    expect(html).toContain("1 tipo de herramienta en uso y 1 punto a revisar.");
    expect(html).toContain(PUNTOS.porSuCuenta);
    for (const d of Object.values(DESCARGAS)) {
      expect(html).toContain(`https://www.room714.com${d.pdf}`);
      expect(html).toContain(`https://www.room714.com${d.docx}`);
    }
    expect(urlFormulario()).toBe(
      "https://www.room714.com/es/incorporar-ia-empresa#hablemos",
    );
    expect(html).toContain(urlFormulario());
    expect(html).toContain("José Antonio Ces");
  });

  it("sin puntos a revisar muestra la buena base", () => {
    const r = calcularResultado(base);
    expect(htmlInventario(r)).toContain(PUNTOS.buenaBase);
    expect(textoInventario(r)).toContain(PUNTOS.buenaBase);
  });
});
