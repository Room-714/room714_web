import { describe, expect, it } from "vitest";
import { normalizeSlugParam, slugify } from "@/app/lib/slug";

// El caso que rompió en producción: un artículo publicado, en el sitemap y en
// el listado del blog, cuyo slug llevaba una "ñ". La URL devolvía 404 porque
// los params de una ruta dinámica llegan SIN decodificar, y la consulta a la
// base de datos buscaba el literal "a%C3%B1adir".
const SLUG_CON_ENIE = "la-ia-que-nadie-pidio-cuando-anadir-inteligencia-es-ruido".replace(
  "anadir",
  "añadir",
);
const SLUG_CODIFICADO =
  "la-ia-que-nadie-pidio-cuando-a%C3%B1adir-inteligencia-es-ruido";

describe("normalizeSlugParam", () => {
  it("deja intacto un slug ASCII, que es el 99% de los casos", () => {
    expect(normalizeSlugParam("rag-no-es-magia")).toBe("rag-no-es-magia");
  });

  it("decodifica el slug percent-encoded que Next entrega en params", () => {
    expect(normalizeSlugParam(SLUG_CODIFICADO)).toBe(SLUG_CON_ENIE);
  });

  it("devuelve la forma NFC, la que guarda Postgres", () => {
    // La misma palabra puede llegar como "ñ" (NFC) o como n + tilde
    // combinante (NFD). Son bytes distintos, así que una consulta por
    // igualdad solo encuentra el post si unificamos antes.
    const nfd = "añadir"; // n + tilde combinante
    const nfc = "añadir"; // ene precompuesta
    expect(nfd).not.toBe(nfc); // que de verdad son cadenas distintas
    expect(normalizeSlugParam(nfd)).toBe(nfc);
  });

  it("no explota con una secuencia de escape inválida", () => {
    expect(normalizeSlugParam("100%-de-friccion")).toBe("100%-de-friccion");
  });

  it("tolera ausencia de valor en lugar de lanzar", () => {
    expect(normalizeSlugParam(undefined)).toBe("");
    expect(normalizeSlugParam(null)).toBe("");
  });
});

describe("slugify", () => {
  it("quita tildes y eñes, que es lo que evita el fallo de raíz", () => {
    expect(slugify("Cuando Añadir Inteligencia es Ruido")).toBe(
      "cuando-anadir-inteligencia-es-ruido",
    );
  });

  it("no deja pasar dos puntos ni otra puntuación de titular", () => {
    expect(slugify("El Modelo Canónico: Que no «alucine» tu IA")).toBe(
      "el-modelo-canonico-que-no-alucine-tu-ia",
    );
  });

  it("es idempotente sobre un slug ya limpio", () => {
    const limpio = "rag-no-es-magia-como-elegir-arquitectura";
    expect(slugify(limpio)).toBe(limpio);
  });

  it("nunca deja caracteres que haya que percent-encodear", () => {
    const salida = slugify(
      "¿Diseño o Decoración? Estética que Factura — 2026",
    );
    expect(salida).toBe(encodeURIComponent(salida));
  });

  it("recorta a 70 caracteres para no generar URLs interminables", () => {
    expect(slugify("palabra ".repeat(30)).length).toBeLessThanOrEqual(70);
  });

  it("no deja guiones colgando en los extremos", () => {
    expect(slugify("  ¡Hola mundo!  ")).toBe("hola-mundo");
  });

  it("devuelve cadena vacía si no hay texto", () => {
    expect(slugify("")).toBe("");
    expect(slugify(undefined)).toBe("");
  });
});
