import { describe, expect, it } from "vitest";
import {
  linkedinCompanySearch,
  linkedinPeopleSearch,
  lookupLinksFor,
  webSearch,
} from "./lookupLinks";

describe("linkedinPeopleSearch", () => {
  it("combina empresa y cargo, que es lo que da con la persona exacta", () => {
    const url = linkedinPeopleSearch({
      title: "Director de Operaciones",
      company: "Envases Soplados S.L.",
    });
    expect(url).toContain("/search/results/people/");
    expect(decodeURIComponent(url)).toContain("Envases Soplados S.L. Director de Operaciones");
  });

  it("escapa lo que rompería la URL", () => {
    const url = linkedinPeopleSearch({ title: "COO & CIO", company: "A/B Testing SL" });
    expect(url).not.toContain(" ");
    expect(url).toContain("%26"); // &
    expect(url).toContain("%2F"); // /
  });

  it("funciona con solo la empresa", () => {
    expect(linkedinPeopleSearch({ company: "Martiko" })).toContain("Martiko");
  });

  it("devuelve null si no hay nada con lo que buscar", () => {
    expect(linkedinPeopleSearch({})).toBeNull();
    expect(linkedinPeopleSearch({ title: "  ", company: "" })).toBeNull();
  });
});

describe("linkedinCompanySearch y webSearch", () => {
  it("apuntan a la empresa, no a la persona", () => {
    expect(linkedinCompanySearch({ company: "Martiko" })).toContain(
      "/search/results/companies/",
    );
    expect(webSearch({ company: "Martiko" })).toContain("google.com/search");
  });

  it("devuelven null sin empresa", () => {
    expect(linkedinCompanySearch({})).toBeNull();
    expect(webSearch({})).toBeNull();
  });
});

describe("lookupLinksFor", () => {
  it("da los tres enlaces cuando hay cargo y empresa", () => {
    const links = lookupLinksFor({ title: "COO", company: "Martiko" });
    expect(links).toHaveLength(3);
    expect(links.every((l) => l.url && l.label)).toBe(true);
  });

  it("omite los que no se pueden construir en vez de dar enlaces rotos", () => {
    expect(lookupLinksFor({ title: "COO" })).toHaveLength(1); // solo el de personas
    expect(lookupLinksFor({})).toEqual([]);
  });
});
