import { describe, expect, it } from "vitest";
import {
  CASOS,
  EN_SITEMAP,
  ROUTES,
  RENOMBRADAS,
  TODAS,
  guardasDeIdioma,
  path,
  pathsOf,
} from "@/app/lib/routes.mjs";

describe("el mapa", () => {
  it("define las dos versiones de idioma de cada página", () => {
    for (const [clave, ruta] of Object.entries(TODAS)) {
      expect(ruta, clave).toHaveProperty("es");
      expect(ruta, clave).toHaveProperty("en");
    }
  });

  it("no repite ninguna ruta dentro del mismo idioma", () => {
    for (const lang of ["es", "en"]) {
      const rutas = Object.values(TODAS).map((r) => r[lang]);
      expect(new Set(rutas).size).toBe(rutas.length);
    }
  });

  it("las rutas empiezan por barra, salvo la portada", () => {
    for (const [clave, ruta] of Object.entries(TODAS)) {
      for (const lang of ["es", "en"]) {
        if (clave === "home") expect(ruta[lang]).toBe("");
        else expect(ruta[lang], `${clave}.${lang}`).toMatch(/^\//);
      }
    }
  });

  it("no lleva caracteres que haya que percent-encodear", () => {
    for (const ruta of Object.values(TODAS)) {
      for (const lang of ["es", "en"]) {
        expect(ruta[lang]).toBe(encodeURI(ruta[lang]));
      }
    }
  });

  it("los tres casos cuelgan del índice de casos en su idioma", () => {
    for (const caso of Object.values(CASOS)) {
      expect(caso.es.startsWith(`${ROUTES.casos.es}/`)).toBe(true);
      expect(caso.en.startsWith(`${ROUTES.casos.en}/`)).toBe(true);
    }
  });
});

describe("path", () => {
  it("mete el idioma delante", () => {
    expect(path("casos", "es")).toBe("/es/casos");
    expect(path("casos", "en")).toBe("/en/cases");
  });

  it("la portada es solo el idioma", () => {
    expect(path("home", "es")).toBe("/es");
  });

  it("protesta si la ruta no existe, en lugar de devolver /es/undefined", () => {
    expect(() => path("noExiste", "es")).toThrow(/desconocida/);
  });
});

describe("pathsOf", () => {
  it("da las dos rutas, que es lo que piden los hreflang", () => {
    expect(pathsOf("hablemos")).toEqual({
      es: "/es/hablemos",
      en: "/en/lets-talk",
    });
  });
});

describe("RENOMBRADAS", () => {
  it("cubre las seis URLs antiguas del menú viejo", () => {
    expect(RENOMBRADAS).toHaveLength(6);
    const origenes = RENOMBRADAS.map((r) => r.de);
    for (const vieja of [
      "/es/projects",
      "/en/projects",
      "/es/about",
      "/en/about",
      "/es/contact",
      "/en/contact",
    ]) {
      expect(origenes).toContain(vieja);
    }
  });

  it("ningún destino es a su vez un origen: cero cadenas de redirección", () => {
    const origenes = new Set(RENOMBRADAS.map((r) => r.de));
    for (const r of RENOMBRADAS) expect(origenes.has(r.a)).toBe(false);
  });

  it("cada redirección se queda en su idioma", () => {
    for (const r of RENOMBRADAS) {
      expect(r.a.slice(0, 3)).toBe(r.de.slice(0, 3));
    }
  });
});

describe("guardasDeIdioma", () => {
  const guardas = guardasDeIdioma();

  it("no genera guarda para las páginas que se llaman igual en los dos idiomas", () => {
    for (const g of guardas) {
      expect(g.de).not.toMatch(/\/(blog|careers|diagnostic|privacy|terms|cookies)$/);
    }
  });

  it("manda la ruta castellana bajo /en a su equivalente inglesa", () => {
    expect(guardas).toContainEqual({ de: "/en/casos", a: "/en/cases" });
    expect(guardas).toContainEqual({ de: "/es/cases", a: "/es/casos" });
  });

  it("cubre también las páginas de caso", () => {
    expect(guardas).toContainEqual({
      de: "/en/casos/saas-soporte-autogestion",
      a: "/en/cases/saas-support-self-service",
    });
  });

  it("dos filas por página con nombre distinto", () => {
    const distintas = Object.values(TODAS).filter((r) => r.es !== r.en);
    expect(guardas).toHaveLength(distintas.length * 2);
  });

  it("ninguna guarda apunta a sí misma", () => {
    for (const g of guardas) expect(g.de).not.toBe(g.a);
  });

  it("ningún destino de guarda es origen de otra: cero cadenas", () => {
    const origenes = new Set(guardas.map((g) => g.de));
    for (const g of guardas) expect(origenes.has(g.a)).toBe(false);
  });
});

describe("EN_SITEMAP", () => {
  it("solo lista claves que existen en el mapa", () => {
    for (const clave of EN_SITEMAP) expect(TODAS).toHaveProperty(clave);
  });

  it("no anuncia las paginas de caso, que aun no existen", () => {
    for (const clave of Object.keys(CASOS)) {
      expect(EN_SITEMAP).not.toContain(clave);
    }
  });

  it("no repite ninguna clave", () => {
    expect(new Set(EN_SITEMAP).size).toBe(EN_SITEMAP.length);
  });

  it("incluye la portada y las cuatro situaciones", () => {
    for (const clave of [
      "home",
      "queHacemos",
      "productoClientes",
      "productoEquipo",
      "iaProducto",
      "empezarDeCero",
    ]) {
      expect(EN_SITEMAP).toContain(clave);
    }
  });
});
