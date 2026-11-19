import { describe, expect, it } from "vitest";
import {
  BUSQUEDAS_OBJETIVO,
  CATEGORIA_DEL_CLUSTER,
  clusterQueToca,
  elegirBusqueda,
  respondeABusqueda,
  semanaIso,
} from "./busquedasObjetivo";
import { CATEGORY_CLUSTER, RESERVED_QUERIES, reservedQueriesIn } from "./clusters";

// 07:30 de Madrid en octubre (UTC+2) son las 05:30 UTC.
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

describe("clusterQueToca (rotación lunes y jueves)", () => {
  const post = (category, dia, published = true) => ({ category, date: new Date(`${dia}T06:30:00Z`), published });

  it("elige el cluster que lleva más tiempo sin post", () => {
    const corpus = [
      post("UX", "2026-11-16"), // C2, el lunes
      post("TECH", "2026-11-12"), // C3, el jueves anterior
      post("PRODUCT", "2026-11-05"), // C1, hace dos semanas
    ];
    expect(clusterQueToca(corpus)).toEqual({
      cluster: "C1",
      category: "PRODUCT",
      ultimoPost: new Date("2026-11-05T06:30:00Z"),
    });
  });

  it("un cluster sin ningún post va primero", () => {
    const corpus = [post("UX", "2026-11-16"), post("PRODUCT", "2026-11-12")];
    expect(clusterQueToca(corpus)).toMatchObject({ cluster: "C3", category: "TECH", ultimoPost: null });
  });

  it("DESIGN cuenta como C2 y los borradores no cuentan", () => {
    const corpus = [
      post("DESIGN", "2026-11-16"),
      post("PRODUCT", "2026-11-12"),
      post("TECH", "2026-11-09"),
      post("TECH", "2026-11-17", false), // borrador: no es un post publicado
    ];
    expect(clusterQueToca(corpus).cluster).toBe("C3");
  });

  it("los programados sí cuentan: ya tienen fecha en el blog", () => {
    const corpus = [post("TECH", "2026-11-26"), post("UX", "2026-11-16"), post("PRODUCT", "2026-11-12")];
    expect(clusterQueToca(corpus).cluster).toBe("C1");
  });

  it("si empatan, desempata C2 > C1 > C3 (corpus vacío: C2)", () => {
    expect(clusterQueToca([]).cluster).toBe("C2");
  });

  it("rota por los tres clusters en semanas seguidas", () => {
    const corpus = [post("UX", "2026-11-02"), post("PRODUCT", "2026-11-05"), post("TECH", "2026-11-09")];
    const elegidos = [];
    for (const dia of ["2026-11-12", "2026-11-16", "2026-11-19", "2026-11-23"]) {
      const { category } = clusterQueToca(corpus);
      elegidos.push(category);
      corpus.push(post(category, dia));
    }
    expect(elegidos).toEqual(["UX", "PRODUCT", "TECH", "UX"]);
  });

  it("la categoría de cada cluster es coherente con su cluster", () => {
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

  it("da por cubierta una búsqueda que solo recoge el slug (el fallo de octubre)", () => {
    const listaC2 = { C2: ["diferencia entre diseño de producto y diseño UX", "customer journey de un producto digital"] };
    const existentes = [
      {
        title_es: "Diseño de Producto vs. Diseño UX: La Distinción que Tu Equipo Necesita Entender Ya",
        slug_es: "diferencia-entre-diseno-de-producto-y-diseno-ux",
      },
    ];
    expect(elegirBusqueda("C2", existentes, listaC2)?.busqueda).toBe("customer journey de un producto digital");
  });

  it("también mira el metaTitle", () => {
    expect(elegirBusqueda("C1", [{ title_es: "Otra cosa", metaTitle_es: "Cómo validar una idea de producto digital" }], lista)?.posicion).toBe(2);
  });

  it("salta las búsquedas descartadas a mano", () => {
    expect(elegirBusqueda("C1", [], lista, ["Cómo validar una idea de producto digital"])?.posicion).toBe(2);
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
