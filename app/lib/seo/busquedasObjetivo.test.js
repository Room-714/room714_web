import { describe, expect, it } from "vitest";
import {
  BUSQUEDAS_OBJETIVO,
  CATEGORIA_DEL_CLUSTER,
  clusterDelDia,
  elegirBusqueda,
  respondeABusqueda,
  semanaIso,
} from "./busquedasObjetivo";
import { CATEGORY_CLUSTER, RESERVED_QUERIES, reservedQueriesIn } from "./clusters";

// 07:30 de Madrid en octubre (UTC+2) son las 05:30 UTC: la hora a la que se
// publica el post y con la que el orquestador decide el cluster.
const publicacion = (dia) => new Date(`${dia}T05:30:00.000Z`);

describe("semanaIso", () => {
  it("numera las semanas como ISO 8601, también en el cambio de año", () => {
    expect(semanaIso(publicacion("2026-10-05"))).toBe(41);
    expect(semanaIso(publicacion("2026-10-12"))).toBe(42);
    expect(semanaIso(new Date("2026-12-28T12:00:00Z"))).toBe(53);
    expect(semanaIso(new Date("2027-01-04T12:00:00Z"))).toBe(1);
    expect(semanaIso(new Date("2021-01-01T12:00:00Z"))).toBe(53);
  });
});

describe("clusterDelDia", () => {
  it("los miércoles toca C2, con la categoría de experiencia de usuario", () => {
    expect(clusterDelDia(publicacion("2026-10-07"))).toEqual({ cluster: "C2", category: "UX" });
    expect(clusterDelDia(publicacion("2026-10-14"))).toEqual({ cluster: "C2", category: "UX" });
  });

  it("los lunes de semana ISO impar toca C1 (Producto) y los de semana par C3 (Tecnología)", () => {
    expect(clusterDelDia(publicacion("2026-10-05"))).toEqual({ cluster: "C1", category: "PRODUCT" }); // semana 41
    expect(clusterDelDia(publicacion("2026-10-12"))).toEqual({ cluster: "C3", category: "TECH" }); // semana 42
    expect(clusterDelDia(publicacion("2026-10-19"))).toEqual({ cluster: "C1", category: "PRODUCT" }); // semana 43
  });

  it("decide con el día de Madrid, no con el de UTC", () => {
    // Domingo 22:30 UTC = lunes 00:30 en Madrid.
    expect(clusterDelDia(new Date("2026-10-04T22:30:00Z"))?.cluster).toBe("C1");
    // Miércoles 23:30 UTC = jueves 01:30 en Madrid: no toca nada.
    expect(clusterDelDia(new Date("2026-10-07T23:30:00Z"))).toBeNull();
  });

  it("el resto de días no fija cluster", () => {
    for (const dia of ["2026-10-06", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]) {
      expect(clusterDelDia(publicacion(dia))).toBeNull();
    }
  });

  it("la categoría de cada cluster es coherente con la que lo sugería antes", () => {
    for (const [cluster, categoria] of Object.entries(CATEGORIA_DEL_CLUSTER)) {
      expect(CATEGORY_CLUSTER[categoria]).toBe(cluster);
    }
  });
});

describe("respondeABusqueda", () => {
  it("pide todas las palabras con significado, sin importar acentos, plurales ni orden", () => {
    expect(respondeABusqueda("cómo validar una idea de producto digital", "Validar ideas de producto digital sin gastar")).toBe(true);
    expect(respondeABusqueda("deuda técnica en productos digitales", "La deuda tecnica de tu producto digital")).toBe(true);
    expect(respondeABusqueda("cómo validar una idea de producto digital", "Validar una idea antes de construir")).toBe(false);
  });
});

describe("elegirBusqueda", () => {
  const lista = {
    C1: ["cómo validar una idea de producto digital", "qué es el discovery de producto digital", "cómo definir el MVP"],
  };

  it("toma la primera búsqueda que ningún título publicado cubre", () => {
    const publicados = [{ title_es: "Cómo validar una idea de producto digital en dos semanas" }];
    expect(elegirBusqueda("C1", publicados, lista)).toEqual({
      busqueda: "qué es el discovery de producto digital",
      posicion: 2,
      total: 3,
    });
  });

  it("sin títulos que la cubran, empieza por la primera", () => {
    expect(elegirBusqueda("C1", [], lista)?.busqueda).toBe("cómo validar una idea de producto digital");
  });

  it("mira el título en español", () => {
    const soloIngles = [{ title_es: "Otra cosa", title_en: "How to validate a digital product idea" }];
    expect(elegirBusqueda("C1", soloIngles, lista)?.posicion).toBe(1);
  });

  it("si todas están cubiertas, devuelve null (el generador vuelve al comportamiento anterior)", () => {
    const publicados = [
      { title_es: "Validar una idea de producto digital" },
      { title_es: "Qué es el discovery de producto digital" },
      { title_es: "Cómo definir el MVP sin perder el foco" },
    ];
    expect(elegirBusqueda("C1", publicados, lista)).toBeNull();
    expect(elegirBusqueda("C9", [], lista)).toBeNull();
  });
});

describe("BUSQUEDAS_OBJETIVO (la lista real)", () => {
  it("tiene búsquedas en los tres clusters, sin repetir", () => {
    for (const cluster of ["C1", "C2", "C3"]) {
      expect(BUSQUEDAS_OBJETIVO[cluster].length).toBeGreaterThan(0);
    }
    const todas = Object.values(BUSQUEDAS_OBJETIVO).flat();
    expect(new Set(todas).size).toBe(todas.length);
  });

  it("ninguna es una búsqueda reservada a una página de servicio", () => {
    const reservadas = Object.values(BUSQUEDAS_OBJETIVO)
      .flat()
      .map((b) => ({ busqueda: b, reservadas: reservedQueriesIn(b, "es") }))
      .filter((b) => b.reservadas.length);
    expect(reservadas, `Reservadas: ${RESERVED_QUERIES.es.join(", ")}`).toEqual([]);
  });
});
