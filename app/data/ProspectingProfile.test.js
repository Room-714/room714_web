import { describe, expect, it } from "vitest";
import {
  APOLLO_EMPLOYEE_RANGES,
  APOLLO_PERSON_LOCATIONS,
  APOLLO_SENIORITIES,
  BUYER_PROFILE,
  IDEAL_CUSTOMER_PROFILE,
  buildApolloQuery,
  roleGroupFor,
  weekIndexFor,
} from "./ProspectingProfile";

describe("buildApolloQuery", () => {
  it("apunta a dirección general y de negocio", () => {
    const q = buildApolloQuery(); // sin semana: todos los cargos
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

// ─── Rotación semanal de cargos ─────────────────────────────────────────────
// Con los siete cargos a la vez, Apollo llenaba la primera página de un solo
// perfil: diez COOs de diez en la primera prueba real. Rotando, la lista acaba
// con las cuatro miradas del problema.
describe("rotación de cargos por semana", () => {
  it("cada semana busca un grupo distinto y vuelve a empezar al completar el ciclo", () => {
    const grupos = BUYER_PROFILE.roleGroups.length;
    const nombres = Array.from({ length: grupos }, (_, i) =>
      roleGroupFor(BUYER_PROFILE, i).name,
    );
    expect(new Set(nombres).size).toBe(grupos);
    // El ciclo se repite: la semana `grupos` vuelve al primer grupo.
    expect(roleGroupFor(BUYER_PROFILE, grupos).name).toBe(nombres[0]);
  });

  it("la consulta de una semana lleva solo los cargos de su grupo", () => {
    const q = buildApolloQuery(BUYER_PROFILE, { weekIndex: 1 });
    expect(q.person_titles).toEqual(["COO", "Director de Operaciones"]);
    expect(q.person_titles).not.toContain("CEO");
  });

  it("aguanta índices negativos sin salirse del array", () => {
    expect(roleGroupFor(BUYER_PROFILE, -1)).toBeDefined();
    expect(roleGroupFor(BUYER_PROFILE, -1).name).toBe(
      BUYER_PROFILE.roleGroups[BUYER_PROFILE.roleGroups.length - 1].name,
    );
  });

  it("un perfil sin grupos usa todos sus cargos", () => {
    const q = buildApolloQuery(
      { roles: ["CEO", "CFO"], sectors: [] },
      { weekIndex: 3 },
    );
    expect(q.person_titles).toEqual(["CEO", "CFO"]);
  });

  it("weekIndexFor avanza de siete en siete días", () => {
    const lunes = new Date("2026-08-17T09:00:00Z");
    const mismaSemana = new Date("2026-08-19T09:00:00Z");
    const siguiente = new Date("2026-08-26T09:00:00Z");
    expect(weekIndexFor(mismaSemana)).toBe(weekIndexFor(lunes));
    expect(weekIndexFor(siguiente)).toBe(weekIndexFor(lunes) + 1);
  });

  it("no rompe el resto de filtros", () => {
    const q = buildApolloQuery(BUYER_PROFILE, { weekIndex: 2, page: 3 });
    expect(q.page).toBe(3);
    expect(q.organization_num_employees_ranges).toEqual(APOLLO_EMPLOYEE_RANGES);
    expect(q.q_organization_keyword_tags.length).toBeGreaterThan(0);
    expect(q).not.toHaveProperty("weekIndex");
  });
});
