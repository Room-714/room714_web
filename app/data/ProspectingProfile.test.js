import { describe, expect, it } from "vitest";
import {
  APOLLO_EMPLOYEE_RANGES,
  APOLLO_PERSON_LOCATIONS,
  APOLLO_SENIORITIES,
  BUYER_PROFILE,
  buildApolloQuery,
  comboForDay,
  dayIndexFor,
  effectiveSizes,
  emptiedDimensions,
  searchCombos,
  SUELO_EJECUCIONES,
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
      combo: { sector: "Industria y fabricación", size: "101,250" },
    });
    expect(q.organization_num_employees_ranges).toEqual(["101,250"]);
    expect(q.q_organization_keyword_tags).toEqual([
      "manufacturing",
      "industrial automation",
    ]);
  });

  it("quita de la consulta los cargos excluidos por las reglas", () => {
    const q = buildApolloQuery(BUYER_PROFILE, {
      combo: { sector: "Educación", size: "101,250" },
      rules: { excludedTitles: ["CEO"], excludedSizes: [] },
    });
    expect(q.person_titles).not.toContain("CEO");
    expect(q.person_titles).toContain("COO");
  });

  // ─── El bug del Paso 1: comparar sin normalizar ───────────────────────────
  // `excludedTitles` sale de `deriveRules`, que guarda `t.original`: el
  // `title` CRUDO que devolvió Apollo la primera vez que se vio ese cargo.
  // Con `include_similar_titles: true` casi nunca coincide en forma con el
  // rol tal y como está escrito en BUYER_PROFILE ("CEO" vs "ceo", espacios de
  // sobra…). El test de arriba pasaba "por casualidad": "CEO" excluido y
  // "CEO" en el perfil coinciden letra por letra. Este no.
  it("quita el cargo aunque Apollo lo escriba de otra forma", () => {
    const q = buildApolloQuery(BUYER_PROFILE, {
      combo: { sector: "Educación", size: "101,250" },
      rules: { excludedTitles: ["  chief executive officer ", "CEO"] },
    });
    expect(q.person_titles).not.toContain("CEO");
  });

  // ─── El bug del Paso 3: una exclusión que vacía la lista entera ───────────
  // Si las reglas llegaran a excluir TODOS los cargos del perfil, un
  // `person_titles: []` no le dice a Apollo "ningún cargo": le dice
  // "cualquier cargo", sin que nada lo avise. Mejor ignorar la exclusión
  // entera (buscar de más, que es gratis) que mandar un filtro fantasma.
  it("si excluir vacía todos los cargos, ignora la exclusión y pide la lista completa", () => {
    const todosLosCargos = buildApolloQuery(BUYER_PROFILE).person_titles;
    const q = buildApolloQuery(BUYER_PROFILE, {
      rules: { excludedTitles: todosLosCargos },
    });
    expect(q.person_titles).toEqual(todosLosCargos);
  });

  it("no revienta sin reglas ni combinación", () => {
    const q = buildApolloQuery();
    expect(q.person_titles.length).toBeGreaterThan(0);
    expect(q.organization_num_employees_ranges).toEqual(["101,250", "251,500"]);
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
      combo: { sector: "Educación", size: "101,250" },
      rules: { excludedSizes: ["101,250"] },
    });
    expect(q.organization_num_employees_ranges).toEqual(["251,500"]);
    // El sector de la combinación se mantiene: solo el tramo se ensancha.
    expect(q.q_organization_keyword_tags).toEqual([
      "education management",
      "higher education",
    ]);
  });

  it("no filtra `combo` ni `rules` a la consulta final", () => {
    const q = buildApolloQuery(BUYER_PROFILE, {
      combo: { sector: "Educación", size: "101,250" },
      rules: { excludedTitles: ["CEO"] },
      page: 3,
    });
    expect(q.page).toBe(3);
    expect(q).not.toHaveProperty("combo");
    expect(q).not.toHaveProperty("rules");
  });
});

// ─── El bug del Paso 2: etiquetar con lo que se PROPUSO, no con lo que se
// buscó de verdad ────────────────────────────────────────────────────────
// `buildApolloQuery` usa esto por dentro, pero el cron también lo necesita
// directamente: es la función que decide qué `sizeQuery` guardar en cada
// candidato, y guardar `combo.size` a pelo en vez de esto es precisamente el
// bug (etiquetar un tramo que no se buscó, lo que realimenta mal las
// reglas).
describe("effectiveSizes", () => {
  it("caso normal: el tramo de la combinación no está excluido", () => {
    expect(effectiveSizes({ sector: "Educación", size: "101,250" }, {})).toEqual([
      "101,250",
    ]);
  });

  it("el tramo del día está excluido: ensancha a los tramos no excluidos", () => {
    expect(
      effectiveSizes(
        { sector: "Educación", size: "101,250" },
        { excludedSizes: ["101,250"] },
      ),
    ).toEqual(["251,500"]);
  });

  it("los dos tramos están excluidos: ignora la exclusión y busca en todos (una lista vacía sería «cualquier tamaño» para Apollo, no «ninguno»)", () => {
    expect(
      effectiveSizes(
        { sector: "Educación", size: "101,250" },
        { excludedSizes: ["101,250", "251,500"] },
      ),
    ).toEqual(APOLLO_EMPLOYEE_RANGES);
  });
});

describe("emptiedDimensions", () => {
  it("sin reglas, ninguna dimensión se ha vaciado", () => {
    expect(emptiedDimensions(BUYER_PROFILE, {})).toEqual([]);
  });

  it("con un solo tramo excluido, no se ha vaciado nada: todavía queda el otro", () => {
    expect(emptiedDimensions(BUYER_PROFILE, { excludedSizes: ["101,250"] })).toEqual([]);
  });

  it("con los dos tramos excluidos, marca «tramos» como vaciada", () => {
    expect(
      emptiedDimensions(BUYER_PROFILE, { excludedSizes: ["101,250", "251,500"] }),
    ).toEqual(["tramos"]);
  });

  it("con todos los cargos excluidos, marca «cargos» como vaciada", () => {
    const todosLosCargos = buildApolloQuery(BUYER_PROFILE).person_titles;
    expect(
      emptiedDimensions(BUYER_PROFILE, { excludedTitles: todosLosCargos }),
    ).toEqual(["cargos"]);
  });

  it("puede vaciarse más de una dimensión a la vez", () => {
    const todosLosCargos = buildApolloQuery(BUYER_PROFILE).person_titles;
    const vaciadas = emptiedDimensions(BUYER_PROFILE, {
      excludedTitles: todosLosCargos,
      excludedSizes: ["101,250", "251,500"],
    });
    expect(vaciadas).toEqual(["cargos", "tramos"]);
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

describe("comboForDay con ponderación", () => {
  const combos = searchCombos(BUYER_PROFILE);

  it("respeta el suelo: una combinación sin muestrear vuelve a salir aunque su tasa sea cero", () => {
    const olvidada = combos[7];
    const historial = combos.map((c) => ({
      sector: c.sector,
      size: c.size,
      ejecucionesDesde: c === olvidada ? SUELO_EJECUCIONES + 1 : 1,
      hits: c === olvidada ? 0 : 10,
      total: c === olvidada ? 20 : 10,
    }));
    expect(comboForDay(BUYER_PROFILE, 0, { historial })).toEqual(olvidada);
  });

  it("entre varias vencidas, sale la que lleva más tiempo sin aparecer", () => {
    const historial = combos.map((c, i) => ({
      sector: c.sector,
      size: c.size,
      ejecucionesDesde: i === 3 ? 99 : i === 5 ? 30 : 1,
      hits: 5,
      total: 10,
    }));
    expect(comboForDay(BUYER_PROFILE, 0, { historial })).toEqual(combos[3]);
  });

  it("una combinación con tasa cero sigue saliendo alguna vez: no hay trinquete", () => {
    // Es la propiedad que hace sostenible la ponderación. Si este test cae,
    // se ha reintroducido el trinquete que el proyecto ya rechazó una vez.
    const mala = combos[3];
    const salidas = [];
    for (let dia = 0; dia < SUELO_EJECUCIONES; dia++) {
      const historial = combos.map((c) => ({
        sector: c.sector,
        size: c.size,
        ejecucionesDesde: c === mala ? dia : 0,
        hits: c === mala ? 0 : 5,
        total: c === mala ? 20 : 10,
      }));
      salidas.push(comboForDay(BUYER_PROFILE, dia, { historial }));
    }
    expect(salidas).toContainEqual(mala);
  });

  it("prefiere las combinaciones que aciertan más, en igualdad de recencia", () => {
    const buena = combos[2];
    const historial = combos.map((c) => ({
      sector: c.sector,
      size: c.size,
      ejecucionesDesde: 1,
      hits: c === buena ? 15 : 0,
      total: 20,
    }));
    const salidas = Array.from({ length: 20 }, (_, i) =>
      comboForDay(BUYER_PROFILE, i, { historial }),
    );
    const veces = salidas.filter(
      (c) => c.sector === buena.sector && c.size === buena.size,
    ).length;
    expect(veces).toBeGreaterThan(1);
  });

  it("sin historial se comporta igual que la rotación fija de siempre", () => {
    for (let d = 0; d < 14; d++) {
      expect(comboForDay(BUYER_PROFILE, d, { historial: [] })).toEqual(
        comboForDay(BUYER_PROFILE, d),
      );
    }
  });
});

describe("dayIndexFor", () => {
  it("avanza de uno en uno cada 24 horas", () => {
    const dia = new Date("2026-08-17T09:00:00Z");
    const siguiente = new Date("2026-08-18T09:00:00Z");
    expect(dayIndexFor(siguiente)).toBe(dayIndexFor(dia) + 1);
  });
});
