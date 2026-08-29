import { describe, expect, it } from "vitest";
import {
  APOLLO_EMPLOYEE_RANGES,
  APOLLO_PERSON_LOCATIONS,
  APOLLO_SENIORITIES,
  BUYER_PROFILE,
  buildApolloQuery,
  comboForDay,
  dayIndexFor,
  searchCombos,
} from "./ProspectingProfile";

describe("buildApolloQuery", () => {
  it("apunta a responsables de empresa, no a cargos funcionales de venta", () => {
    const q = buildApolloQuery();
    expect(q.person_titles).toContain("CEO");
    expect(q.person_titles).toContain("Director General");
    expect(q.person_titles).toContain("Director de Transformación Digital");
    expect(q.person_titles).toContain("Director de Operaciones");
    expect(q.person_titles).toContain("CIO");
  });

  // El segundo error de premisa, convertido en test: un director comercial
  // solo compra lo que mueve su metrica, y la suya es volumen de ventas.
  it("NO busca cargos comerciales ni de marketing", () => {
    const titles = buildApolloQuery().person_titles.join(" ").toLowerCase();
    for (const prohibido of ["comercial", "commercial", "marketing", "ventas", "sales"]) {
      expect(titles).not.toContain(prohibido);
    }
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

  it("sin combinación busca los dos tramos de plantilla a la vez", () => {
    expect(buildApolloQuery().organization_num_employees_ranges).toEqual(
      APOLLO_EMPLOYEE_RANGES,
    );
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
    const q = buildApolloQuery(BUYER_PROFILE, { page: 3 });
    expect(q.page).toBe(3);
    expect(q.per_page).toBe(25);
    expect(q.person_locations).toEqual(APOLLO_PERSON_LOCATIONS);
  });

  it("cubre todos los sectores del perfil de comprador: ninguno se queda sin traducir", () => {
    const q = buildApolloQuery();
    // Si alguien añade un sector al perfil y olvida el mapeo, este test lo caza.
    expect(q.q_organization_keyword_tags.length).toBeGreaterThanOrEqual(
      BUYER_PROFILE.sectors.length,
    );
  });

  it("pide un solo sector y un solo tramo cuando se le da una combinación", () => {
    const q = buildApolloQuery(BUYER_PROFILE, {
      combo: { sector: "Industria y fabricación", size: "51,100" },
    });
    expect(q.organization_num_employees_ranges).toEqual(["51,100"]);
    expect(q.q_organization_keyword_tags).toEqual([
      "manufacturing",
      "industrial automation",
    ]);
  });

  it("quita de la consulta los cargos excluidos por las reglas", () => {
    const q = buildApolloQuery(BUYER_PROFILE, {
      combo: { sector: "Educación", size: "51,100" },
      rules: { excludedTitles: ["CEO"], excludedSizes: [] },
    });
    expect(q.person_titles).not.toContain("CEO");
    expect(q.person_titles).toContain("COO");
  });

  it("no revienta sin reglas ni combinación", () => {
    const q = buildApolloQuery();
    expect(q.person_titles.length).toBeGreaterThan(0);
    expect(q.organization_num_employees_ranges).toEqual(["51,100", "101,250"]);
  });

  // ─── La incoherencia del Paso 4, resuelta ─────────────────────────────────
  // Si la rotación diaria llega a una combinación cuyo tramo ya está excluido
  // por las reglas (SIZE_STRIKES descartes y ningún sí que lo salve), NO se
  // busca en ese tramo solo porque "hoy tocaba": eso ignoraría precisamente la
  // señal que la regla existe para aplicar. En vez de eso, la función cae al
  // mismo comportamiento que si no hubiera combinación de tramo: busca en
  // todos los tramos no excluidos. El sector de la combinación SÍ se respeta
  // (no se ensancha también), porque el tramo es lo único que las reglas han
  // desaconsejado.
  it("si el tramo de la combinación del día está excluido, cae a los tramos no excluidos sin dejar de buscar", () => {
    const q = buildApolloQuery(BUYER_PROFILE, {
      combo: { sector: "Educación", size: "51,100" },
      rules: { excludedSizes: ["51,100"] },
    });
    expect(q.organization_num_employees_ranges).toEqual(["101,250"]);
    // El sector de la combinación se mantiene: solo el tramo se ensancha.
    expect(q.q_organization_keyword_tags).toEqual([
      "education management",
      "higher education",
    ]);
  });

  it("no filtra `combo` ni `rules` a la consulta final", () => {
    const q = buildApolloQuery(BUYER_PROFILE, {
      combo: { sector: "Educación", size: "51,100" },
      rules: { excludedTitles: ["CEO"] },
      page: 3,
    });
    expect(q.page).toBe(3);
    expect(q).not.toHaveProperty("combo");
    expect(q).not.toHaveProperty("rules");
  });
});

// ─── Rotación diaria por sector y tramo de plantilla ────────────────────────
// Antes se rotaba por sector una vez por semana. Ahora se rota por la
// combinación de sector y tramo, una vez al día: 7 sectores × 2 tramos = 14
// combinaciones.
describe("searchCombos", () => {
  it("genera 7 sectores × 2 tramos = 14 combinaciones", () => {
    expect(searchCombos(BUYER_PROFILE)).toHaveLength(14);
  });
});

describe("comboForDay", () => {
  it("recorre las 14 combinaciones antes de repetir", () => {
    const vistas = new Set();
    for (let d = 0; d < 14; d++) {
      const c = comboForDay(BUYER_PROFILE, d);
      vistas.add(`${c.sector}|${c.size}`);
    }
    expect(vistas.size).toBe(14);
  });

  it("es estable: el mismo día da la misma combinación", () => {
    expect(comboForDay(BUYER_PROFILE, 100)).toEqual(comboForDay(BUYER_PROFILE, 100));
  });

  it("cierra el ciclo: el día 14 repite la combinación del día 0", () => {
    expect(comboForDay(BUYER_PROFILE, 14)).toEqual(comboForDay(BUYER_PROFILE, 0));
  });

  it("aguanta índices negativos", () => {
    const combos = searchCombos(BUYER_PROFILE);
    expect(comboForDay(BUYER_PROFILE, -1)).toEqual(combos[combos.length - 1]);
  });
});

describe("dayIndexFor", () => {
  it("avanza de uno en uno cada 24 horas", () => {
    const dia = new Date("2026-08-17T09:00:00Z");
    const siguiente = new Date("2026-08-18T09:00:00Z");
    expect(dayIndexFor(siguiente)).toBe(dayIndexFor(dia) + 1);
  });
});
