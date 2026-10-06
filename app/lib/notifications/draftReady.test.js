import { describe, expect, it } from "vitest";
import { buildSeoSection } from "./draftReady";

const base = {
  cluster: "C1",
  clusterName: "Ideación y discovery de producto digital",
  busqueda: "qué es el discovery de producto digital",
  busquedaDeLaLista: { busqueda: "qué es el discovery de producto digital", posicion: 1, total: 8 },
  sinBusquedas: false,
  clusterDelDia: "C1",
  sinEnlaceCluster: [],
};

describe("buildSeoSection", () => {
  it("muestra el cluster y la búsqueda objetivo con su posición en la lista", () => {
    const html = buildSeoSection(base);
    expect(html).toContain("C1 · Ideación y discovery de producto digital");
    expect(html).toContain("qué es el discovery de producto digital");
    expect(html).toContain("n.º 1 de 8");
    expect(html).not.toContain("⚠");
  });

  it("avisa si el post no enlaza a la página de su cluster", () => {
    const html = buildSeoSection({ ...base, sinEnlaceCluster: ["es", "en"] });
    expect(html).toContain("⚠ El post no enlaza a la página de su cluster en ES ni en EN");
  });

  it("avisa si se acabaron las búsquedas del cluster", () => {
    const html = buildSeoSection({
      ...base,
      busqueda: "otra búsqueda que eligió la IA",
      busquedaDeLaLista: null,
      sinBusquedas: true,
    });
    expect(html).toContain("No quedan búsquedas sin cubrir en la lista de C1");
    expect(html).toContain("elegida por la IA, no de la lista");
  });

  it("escapa el HTML de la búsqueda", () => {
    expect(buildSeoSection({ ...base, busqueda: "<b>x</b>", busquedaDeLaLista: null })).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("sin datos de posicionamiento no añade nada", () => {
    expect(buildSeoSection(null)).toBe("");
  });
});
