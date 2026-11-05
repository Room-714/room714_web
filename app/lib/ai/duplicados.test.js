import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@/app/lib/prisma", () => ({ prisma: { $queryRaw: (...a) => queryRaw(...a) } }));

import {
  agruparFilas,
  buscarParecidos,
  cargarCorpus,
  estadoDe,
  metasRepetidas,
  normalizar,
  postsRecientes,
  resumenPost,
  slugUnico,
  slugsOcupados,
  terminosClave,
  titulosExistentes,
} from "./duplicados";
import fixture from "../../../seo/fixtures/posts-publicados.json";

const AHORA = new Date("2026-11-05T12:00:00Z");

const fila = (id, lang, slug, title, extra = {}) => ({
  id,
  date: "2026-10-14T05:30:00Z",
  createdAt: "2026-10-13T04:00:00Z",
  category: "UX",
  published: true,
  lang,
  slug,
  title,
  metaTitle: null,
  metaDescription: null,
  tags: [],
  ...extra,
});

// El post principal de octubre, tal y como está en la BD.
const PRINCIPAL = [
  fila(900, "es", "diferencia-entre-diseno-de-producto-y-diseno-ux", "Diseño de Producto vs. Diseño UX: La Distinción que Tu Equipo Necesita Entender Ya", {
    metaTitle: "Diseño de producto vs. diseño UX",
    metaDescription: "La diferencia entre diseño de producto y diseño UX no es semántica.",
  }),
  fila(900, "en", "difference-between-product-design-and-ux-design", "Product Design vs. UX Design: The Distinction Your Team Can't Afford to Blur"),
];

// Los posts publicados del fixture (snapshot real del blog) más el principal.
const filasFixture = (Array.isArray(fixture) ? fixture : fixture.posts).map((r) =>
  fila(r.postId, r.locale, r.slug, r.title, { metaTitle: r.metaTitle, metaDescription: r.metaDescription }),
);
const CORPUS = agruparFilas([...filasFixture, ...PRINCIPAL]);

describe("normalización", () => {
  it("quita mayúsculas, acentos y signos", () => {
    expect(normalizar("¿Diseño UX vs. Producto?")).toBe("diseno ux vs producto");
  });

  it("deja solo los términos clave, sin palabras vacías y con singular y plural iguales", () => {
    expect(terminosClave("La diferencia entre diseño de producto y diseño UX")).toEqual([
      "diferencia",
      "diseno",
      "producto",
      "ux",
    ]);
    expect(terminosClave("productos digitales")).toEqual(terminosClave("producto digital"));
  });

  it("trata un slug como un texto", () => {
    expect(terminosClave("diferencia-entre-diseno-de-producto-y-diseno-ux")).toEqual(
      terminosClave("diferencia entre diseño de producto y diseño UX"),
    );
  });
});

describe("buscarParecidos", () => {
  it("marca el tema duplicado de octubre contra el post principal", () => {
    const [primero] = buscarParecidos({ es: "diferencia entre diseño de producto y UX" }, CORPUS);
    expect(primero.post.id).toBe(900);
    expect(primero.puntuacion).toBe(1);
  });

  it("también en inglés, por el slug", () => {
    const [primero] = buscarParecidos({ en: "difference between product design and UX design" }, CORPUS);
    expect(primero.post.id).toBe(900);
  });

  it("no marca temas que solo comparten términos genéricos", () => {
    for (const tema of [
      "errores al lanzar un producto digital",
      "qué es el discovery de producto digital",
      "cómo definir el MVP de un producto digital",
      "métricas de experiencia de usuario en productos digitales",
      "equipo de desarrollo interno o externo",
    ]) {
      expect(buscarParecidos({ es: tema }, CORPUS), tema).toEqual([]);
    }
  });

  it("un tema de una sola palabra clave no basta para marcar nada", () => {
    expect(buscarParecidos({ es: "producto" }, CORPUS)).toEqual([]);
  });

  it("a igual parecido señala el original (el más antiguo), no la copia", () => {
    const conCopia = agruparFilas([
      fila(950, "es", "diferencia-diseno-de-producto-y-diseno-ux", "Diseño de Producto y UX: Son lo Mismo Hasta que Dejan de Serlo", {
        date: "2026-10-21T05:30:00Z",
      }),
      ...PRINCIPAL,
    ]);
    const [primero] = buscarParecidos({ es: "diferencia entre diseño de producto y UX" }, conCopia);
    expect(primero.post.id).toBe(900);
  });

  it("devuelve cada post una vez, con su campo más parecido", () => {
    const res = buscarParecidos({ es: "diferencia diseño producto UX" }, CORPUS);
    expect(res.filter((r) => r.post.id === 900)).toHaveLength(1);
  });
});

describe("cargarCorpus", () => {
  beforeEach(() => queryRaw.mockReset());

  it("hace UNA sola consulta y agrupa las traducciones por post", async () => {
    queryRaw.mockResolvedValue([...PRINCIPAL, fila(901, "es", "borrador-x", "Un borrador", { published: false })]);
    const corpus = await cargarCorpus();
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(corpus).toHaveLength(2);
    expect(corpus[0].es.slug).toBe("diferencia-entre-diseno-de-producto-y-diseno-ux");
    expect(corpus[0].en.slug).toBe("difference-between-product-design-and-ux-design");
  });

  it("no pide el content (el campo pesado)", async () => {
    queryRaw.mockResolvedValue([]);
    await cargarCorpus();
    const sql = queryRaw.mock.calls[0][0].join("");
    expect(sql).not.toMatch(/content/i);
    expect(sql).toMatch(/metaTitle/);
  });
});

describe("estado, títulos y recientes", () => {
  const corpus = agruparFilas([
    fila(1, "es", "publicado", "Publicado"),
    fila(2, "es", "programado", "Programado", { date: "2026-11-09T06:30:00Z", createdAt: "2026-11-05T05:00:00Z" }),
    fila(3, "es", "borrador", "Borrador", { published: false, createdAt: "2026-11-01T05:00:00Z" }),
  ]);

  it("distingue publicado, programado y borrador", () => {
    expect(corpus.map((p) => estadoDe(p, AHORA))).toEqual(["publicado", "programado", "borrador"]);
  });

  it("los títulos existentes incluyen borradores y programados", () => {
    expect(titulosExistentes(corpus, AHORA).map((t) => t.estado)).toEqual(["publicado", "programado", "borrador"]);
  });

  it("los recientes van por fecha de creación, como getRecentPosts", () => {
    expect(postsRecientes(corpus, 2).map((p) => p.slug_es)).toEqual(["programado", "borrador"]);
  });

  it("solo un post en vivo tiene URL pública", () => {
    expect(resumenPost(corpus[0], AHORA).url).toBe("/es/blog/publicado");
    expect(resumenPost(corpus[2], AHORA).url).toBeNull();
  });
});

describe("slugUnico", () => {
  it("añade -2, -3… sin consultar la BD", () => {
    const ocupados = slugsOcupados(agruparFilas([fila(1, "es", "tema", "x"), fila(2, "es", "tema-2", "y")]));
    expect(slugUnico("tema", ocupados)).toBe("tema-3");
    expect(slugUnico("libre", ocupados)).toBe("libre");
  });
});

describe("metasRepetidas", () => {
  const corpus = agruparFilas(PRINCIPAL);
  const borrador = {
    meta_title_es: "Otro título",
    meta_title_en: "Another title",
    meta_description_es: "Otra descripción",
    meta_description_en: "Another description",
  };

  it("vacío si nada coincide", () => {
    expect(metasRepetidas(borrador, corpus)).toEqual([]);
  });

  it("detecta un metaTitle igual aunque cambien mayúsculas, acentos y signos", () => {
    const rep = metasRepetidas({ ...borrador, meta_title_es: "DISENO DE PRODUCTO VS DISEÑO UX" }, corpus);
    expect(rep).toEqual([{ campo: "meta_title_es", valor: "DISENO DE PRODUCTO VS DISEÑO UX", postId: 900 }]);
  });

  it("detecta una metaDescription igual", () => {
    const rep = metasRepetidas(
      { ...borrador, meta_description_en: "La diferencia entre diseño de producto y diseño UX no es semántica." },
      corpus,
    );
    expect(rep.map((r) => r.campo)).toEqual(["meta_description_en"]);
  });

  it("ignora un metaTitle descartado (null)", () => {
    expect(metasRepetidas({ ...borrador, meta_title_es: null }, corpus)).toEqual([]);
  });
});
