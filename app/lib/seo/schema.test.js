import { describe, expect, it } from "vitest";
import {
  FOUNDER_ID,
  ORGANIZATION_ID,
  articleSchema,
  breadcrumbSchema,
  founderSchema,
  jsonLdGraph,
  organizationSchema,
} from "@/app/lib/seo/schema";
import { SITE_URL } from "@/app/lib/seo/urls";

describe("organizationSchema", () => {
  it("lleva los campos que pide el rich result: nombre, url, logo y dirección", () => {
    const org = organizationSchema("es");
    expect(org["@type"]).toContain("Organization");
    expect(org.name).toBe("Room 714");
    expect(org.url).toBe(SITE_URL);
    expect(org.logo.url.startsWith(SITE_URL)).toBe(true);
    expect(org.address).toMatchObject({
      addressLocality: "Madrid",
      addressCountry: "ES",
    });
  });

  it("solo enlaza el LinkedIn de la empresa", () => {
    const { sameAs } = organizationSchema("es");
    expect(sameAs).toHaveLength(1);
    expect(sameAs[0]).toContain("linkedin.com/company/room-714");
  });

  it("describe el estudio en el idioma de la página", () => {
    expect(organizationSchema("es").description).not.toBe(
      organizationSchema("en").description,
    );
  });
});

describe("founderSchema", () => {
  it("es una Person con su LinkedIn", () => {
    const p = founderSchema();
    expect(p["@type"]).toBe("Person");
    expect(p.name).toBe("José Antonio Ces Franjo");
    expect(p.sameAs[0]).toContain("linkedin.com/in/josecesfranjo");
  });

  it("cuelga de la organización por @id, sin repetirla", () => {
    expect(founderSchema().worksFor).toEqual({ "@id": ORGANIZATION_ID });
  });
});

describe("articleSchema", () => {
  const base = {
    lang: "es",
    url: `${SITE_URL}/es/blog/x`,
    headline: "Un titular",
    description: "Una descripción",
    imageUrl: `${SITE_URL}/img.png`,
    datePublished: "2026-07-22T08:00:00.000Z",
    dateModified: "2026-08-30T10:00:00.000Z",
    articleBody: "cuerpo",
  };

  it("firma el artículo con la Person, no con la Organization", () => {
    expect(articleSchema(base).author).toEqual({ "@id": FOUNDER_ID });
  });

  it("distingue fecha de publicación y de modificación", () => {
    const a = articleSchema(base);
    expect(a.datePublished).toBe(base.datePublished);
    expect(a.dateModified).toBe(base.dateModified);
    expect(a.dateModified).not.toBe(a.datePublished);
  });

  it("si no hay fecha de modificación cae en la de publicación", () => {
    const a = articleSchema({ ...base, dateModified: null });
    expect(a.dateModified).toBe(base.datePublished);
  });

  it("marca el idioma del artículo", () => {
    expect(articleSchema(base).inLanguage).toBe("es-ES");
    expect(articleSchema({ ...base, lang: "en" }).inLanguage).toBe("en-US");
  });
});

describe("breadcrumbSchema", () => {
  it("numera las posiciones desde 1 y en orden", () => {
    const b = breadcrumbSchema([
      { name: "Inicio", url: `${SITE_URL}/es` },
      { name: "Ideas", url: `${SITE_URL}/es/blog` },
      { name: "Un artículo", url: `${SITE_URL}/es/blog/x` },
    ]);
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(b.itemListElement[2].name).toBe("Un artículo");
    expect(b.itemListElement[0].item).toBe(`${SITE_URL}/es`);
  });
});

describe("jsonLdGraph", () => {
  it("declara @context una vez y agrupa los nodos", () => {
    const g = jsonLdGraph(organizationSchema("es"), founderSchema());
    expect(g["@context"]).toBe("https://schema.org");
    expect(g["@graph"]).toHaveLength(2);
  });

  it("descarta los nodos ausentes en lugar de meter null en el grafo", () => {
    const g = jsonLdGraph(organizationSchema("es"), null, undefined);
    expect(g["@graph"]).toHaveLength(1);
  });
});
