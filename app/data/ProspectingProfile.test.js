import { describe, expect, it } from "vitest";
import {
  APOLLO_EMPLOYEE_RANGES,
  APOLLO_PERSON_LOCATIONS,
  APOLLO_SENIORITIES,
  IDEAL_CUSTOMER_PROFILE,
  buildApolloQuery,
} from "./ProspectingProfile";

describe("buildApolloQuery", () => {
  it("apunta a dirección general y de negocio", () => {
    const q = buildApolloQuery();
    expect(q.person_titles).toContain("CEO");
    expect(q.person_titles).toContain("Director General");
    expect(q.person_titles).toContain("Director de Operaciones");
  });

  // ─── El error de la primera versión, convertido en test ───────────────────
  // Buscar cargos de producto o sectores de software trae empresas que ya
  // tienen la capacidad dentro: exactamente las que NO nos contratan. La
  // primera consulta hizo eso y devolvió agencias digitales y startups de
  // software, competencia incluida.
  it("NO busca cargos de producto: implicarían empresas con equipo propio", () => {
    const titles = buildApolloQuery().person_titles.join(" ").toLowerCase();
    for (const prohibido of ["cpo", "head of product", "head of ux", "product owner"]) {
      expect(titles).not.toContain(prohibido);
    }
  });

  it("NO busca sectores que se autoabastecen", () => {
    const tags = buildApolloQuery().q_organization_keyword_tags.join(" ").toLowerCase();
    for (const prohibido of ["saas", "software", "agency", "consulting", "information technology"]) {
      expect(tags).not.toContain(prohibido);
    }
  });

  it("parte los cargos compuestos en títulos sueltos", () => {
    // Apollo no entiende "CEO / Founder": hay que trocearlo.
    const q = buildApolloQuery({ roles: ["CEO / Founder"], sectors: [] });
    expect(q.person_titles).toEqual(["CEO", "Founder"]);
  });

  it("no repite títulos que aparecen en varios roles", () => {
    const q = buildApolloQuery({
      roles: ["CEO / Founder", "Founder / CTO"],
      sectors: [],
    });
    expect(q.person_titles).toEqual(["CEO", "Founder", "CTO"]);
  });

  it("traduce los sectores del perfil a etiquetas de Apollo, sin duplicados", () => {
    const q = buildApolloQuery({
      roles: [],
      sectors: ["Industria y fabricación", "Salud y clínicas"],
    });
    expect(q.q_organization_keyword_tags).toEqual([
      "manufacturing",
      "industrial automation",
      "health care",
      "hospital & health care",
    ]);
  });

  it("busca empresas medianas: ni sin presupuesto ni con equipo propio", () => {
    expect(buildApolloQuery().organization_num_employees_ranges).toEqual([
      "51,250",
    ]);
  });

  it("ignora sectores sin traducción en vez de romper la búsqueda", () => {
    const q = buildApolloQuery({ roles: [], sectors: ["Sector inventado"] });
    expect(q.q_organization_keyword_tags).toEqual([]);
  });

  it("lleva ubicación, tamaño y seniority desde las constantes visibles", () => {
    const q = buildApolloQuery();
    expect(q.person_locations).toEqual(APOLLO_PERSON_LOCATIONS);
    expect(q.organization_num_employees_ranges).toEqual(APOLLO_EMPLOYEE_RANGES);
    expect(q.person_seniorities).toEqual(APOLLO_SENIORITIES);
    expect(q.include_similar_titles).toBe(true);
  });

  it("no pide nunca revelar email ni teléfono, que es lo que dispara el gasto", () => {
    const q = buildApolloQuery();
    expect(q).not.toHaveProperty("reveal_personal_emails");
    expect(q).not.toHaveProperty("reveal_phone_number");
    expect(q).not.toHaveProperty("run_waterfall_email");
    expect(q).not.toHaveProperty("run_waterfall_phone");
  });

  it("acepta overrides para paginar sin tocar el resto", () => {
    const q = buildApolloQuery(IDEAL_CUSTOMER_PROFILE, { page: 3 });
    expect(q.page).toBe(3);
    expect(q.per_page).toBe(25);
    expect(q.person_locations).toEqual(APOLLO_PERSON_LOCATIONS);
  });

  it("cubre todos los sectores del ICP real: ninguno se queda sin traducir", () => {
    const q = buildApolloQuery();
    // Si alguien añade un sector al ICP y olvida el mapeo, este test lo caza.
    expect(q.q_organization_keyword_tags.length).toBeGreaterThanOrEqual(
      IDEAL_CUSTOMER_PROFILE.sectors.length,
    );
  });
});
