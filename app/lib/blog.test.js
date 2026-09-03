import { describe, expect, it } from "vitest";
import { ordenarPorSlugs } from "@/app/lib/blog";

// Los posts llegan ya ordenados por fecha descendente, como los devuelve
// getAllPosts.
const posts = [
  { id: 1, slug: "recien-publicado" },
  { id: 2, slug: "de-la-semana-pasada" },
  { id: 3, slug: "piloto-ia" },
  { id: 4, slug: "friccion" },
  { id: 5, slug: "deuda-tecnica" },
];

describe("ordenarPorSlugs", () => {
  it("respeta el orden de los slugs fijados, no el de fecha", () => {
    const salida = ordenarPorSlugs(posts, ["deuda-tecnica", "piloto-ia"], 2);
    expect(salida.map((p) => p.slug)).toEqual(["deuda-tecnica", "piloto-ia"]);
  });

  it("rellena con lo más reciente si faltan piezas fijadas", () => {
    const salida = ordenarPorSlugs(posts, ["piloto-ia"], 3);
    expect(salida.map((p) => p.slug)).toEqual([
      "piloto-ia",
      "recien-publicado",
      "de-la-semana-pasada",
    ]);
  });

  it("ignora un slug fijado que ya no existe, sin dejar hueco", () => {
    const salida = ordenarPorSlugs(
      posts,
      ["no-existe", "friccion", "tampoco-existe"],
      3,
    );
    expect(salida.map((p) => p.slug)).toEqual([
      "friccion",
      "recien-publicado",
      "de-la-semana-pasada",
    ]);
  });

  it("nunca repite un post, aunque el slug venga dos veces", () => {
    const salida = ordenarPorSlugs(posts, ["piloto-ia", "piloto-ia"], 3);
    const ids = salida.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("devuelve como mucho el número pedido", () => {
    expect(ordenarPorSlugs(posts, [], 3)).toHaveLength(3);
    expect(
      ordenarPorSlugs(posts, ["piloto-ia", "friccion", "deuda-tecnica"], 3),
    ).toHaveLength(3);
  });

  it("descarta los posts sin traducción en el idioma, que llegan sin slug", () => {
    const conHuecos = [{ id: 9, slug: undefined }, ...posts];
    const salida = ordenarPorSlugs(conHuecos, [], 2);
    expect(salida.every((p) => p.slug)).toBe(true);
  });

  it("sin nada fijado se comporta como antes: los más recientes", () => {
    expect(ordenarPorSlugs(posts, [], 2).map((p) => p.slug)).toEqual([
      "recien-publicado",
      "de-la-semana-pasada",
    ]);
  });
});
