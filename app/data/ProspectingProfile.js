// ─── Perfiles de prospección en LinkedIn ────────────────────────────────────
// Hay DOS públicos con objetivos distintos, y confundirlos fue el primer error
// de este sistema:
//
//   COMPRADOR   → empresas medianas tradicionales con canal digital pero sin
//                 equipo propio de producto, diseño o tecnología. Son las que
//                 pueden contratar a Room714. Se encuentran con Apollo.
//   REFERENCIA  → gente que publica con asiduidad sobre producto, diseño o
//                 tecnología. No son clientes: comentar sus publicaciones da
//                 alcance y presencia. NO se encuentran con Apollo (no sabe
//                 filtrar por actividad de publicación), sino con las búsquedas
//                 de contenido de LinkedIn y criterio humano.
//
// Editar este fichero ES editar la estrategia de prospección: no hay más
// configuración escondida.

// ─── Público 1: el comprador ────────────────────────────────────────────────
// Ojo con la tentación de meter aquí cargos de producto (CPO, Head of Product)
// o sectores de software: buscar esos cargos garantiza dar con empresas que ya
// tienen la capacidad dentro, que son exactamente las que NO nos necesitan. La
// primera versión de este fichero cometía ese error y trajo agencias digitales
// y startups de software, competencia incluida.
export const BUYER_PROFILE = {
  kind: "buyer",
  // Donde no hay CPO ni Head of Design, la decisión de buscar ayuda fuera la
  // toma negocio, no tecnología.
  // Cuatro familias de cargo, todas con una cosa en común: sienten una
  // limitación técnica, de producto o de diseño como un problema del negocio.
  //
  // Ojo con lo que NO está y por qué: nada de Director Comercial ni de
  // Marketing. Se probaron y no funcionan — un cargo funcional solo compra lo
  // que mueve su propia métrica, y la del comercial es volumen de ventas, que
  // esto no toca de forma directa. El "responsable de empresa" sí: su métrica
  // es el negocio entero.
  roles: [
    // Dirección general y propiedad: decide sin pedir permiso.
    "CEO",
    "Director General",
    "Consejero Delegado",
    "Gerente",
    "Propietario",
    "Fundador",
    // Transformación digital: si el cargo existe, hay mandato y presupuesto.
    "Director de Transformación Digital",
    "Director de Innovación",
    "Director de Negocio Digital",
    // Operaciones: sufren la limitación a diario y piensan en procesos.
    "COO",
    "Director de Operaciones",
    // IT y sistemas: detectan la limitación técnica antes que nadie.
    "CIO",
    "Director de IT",
    "Director de Sistemas",
  ],
  // Empresas con canal digital relevante y sin músculo propio para sostenerlo.
  sectors: [
    "Industria y fabricación",
    "Retail no nativo digital",
    "Salud y clínicas",
    "Seguros y banca tradicional",
    "Educación",
    "Servicios profesionales",
    "Turismo y hostelería",
  ],
  // Señales de que un post suyo es comentable con nuestra voz.
  signals: [
    "Habla de digitalizar procesos o canales de venta",
    "Se queja de una web o app que no convierte",
    "Menciona sistemas antiguos que frenan al negocio",
    "Anuncia un proyecto digital o una transformación",
    "Pregunta u opina sobre IA sin tener equipo técnico propio",
  ],
  keywords: [
    "transformación digital",
    "canal digital",
    "digitalización",
    "experiencia de cliente",
    "comercio electrónico",
  ],
};

// ─── Público 2: las referencias ─────────────────────────────────────────────
// No hay consulta de Apollo aquí a propósito: lo que las define es que
// publiquen a menudo, y eso solo se ve leyendo LinkedIn. El briefing abre
// búsquedas de contenido reciente por estos temas y el alta es manual.
export const REFERENCE_PROFILE = {
  kind: "reference",
  roles: [
    "Head of Design",
    "Design Lead",
    "Head of Product",
    "Product Lead",
    "CTO",
    "Principal Engineer",
    "Consultor de producto",
  ],
  signals: [
    "Publica varias veces por semana, no una vez al trimestre",
    "Escribe opinión propia, no solo comparte enlaces",
    "Tiene conversación en comentarios (no monólogo)",
    "Toca producto, diseño, research o ingeniería con criterio",
  ],
  // Temas por los que buscar publicaciones recientes.
  keywords: [
    "UX",
    "product management",
    "diseño de producto",
    "investigación de usuarios",
    "arquitectura de software",
    "IA en producto",
  ],
};

// Compatibilidad: el redactor de comentarios y el briefing importaban este
// nombre. Apunta al comprador, que es el perfil comercial.
export const IDEAL_CUSTOMER_PROFILE = BUYER_PROFILE;

// Búsquedas de contenido en LinkedIn para encontrar posts comentables. Rotan
// por día para no repetir.
export function contentSearchUrl(keyword) {
  return `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(
    keyword,
  )}&sortBy=%22date_posted%22`;
}

// Feed de actividad reciente de un perfil o página a partir de su URL.
export function activityFeedUrl(linkedinUrl) {
  const clean = String(linkedinUrl || "").replace(/\/+$/, "");
  if (clean.includes("/company/")) return `${clean}/posts/`;
  return `${clean}/recent-activity/all/`;
}

// Cuántas tareas de prospección entran en el briefing de cada día laborable, y
// cómo se reparten: una de cada público, para avanzar las dos estrategias en
// paralelo.
export const PROSPECT_TASKS_PER_DAY = 2;
export const TASKS_PER_KIND = { buyer: 1, reference: 1 };

// ─── Traducción del perfil de comprador a una consulta de Apollo ────────────

// Lo primero que se va a querer cambiar. Apollo acepta país, región o ciudad.
export const APOLLO_PERSON_LOCATIONS = ["Spain"];

// "Mediana empresa" según la definición europea: 50 a 250 empleados. Por debajo
// no hay presupuesto; por encima suele haber equipo propio. Apollo espera
// cadenas "mínimo,máximo".
export const APOLLO_EMPLOYEE_RANGES = ["51,250"];

// Valores del enum de Apollo: owner, founder, c_suite, partner, vp, head,
// director, manager, senior, entry, intern.
export const APOLLO_SENIORITIES = ["c_suite", "founder", "director", "vp"];

// Apollo NO tiene filtro de industria en la People Search API (verificado en
// docs.apollo.io/reference/people-api-search y /organization-search: no existe
// `organization_industries` ni se documenta `organization_industry_tag_ids`,
// que además exigiría IDs numéricos internos sin forma documentada de
// obtenerlos). Lo más cercano documentado es el filtro por etiquetas de
// palabra clave, así que traducimos cada sector a los términos en inglés con
// los que Apollo etiqueta a esas empresas.
//
// Aquí NO debe aparecer software, saas, agencias ni consultoría tecnológica:
// esas empresas resuelven dentro lo que nosotros vendemos.
export const SECTOR_TO_APOLLO_TAGS = {
  "Industria y fabricación": ["manufacturing", "industrial automation"],
  "Retail no nativo digital": ["retail", "consumer goods"],
  "Salud y clínicas": ["health care", "hospital & health care"],
  "Seguros y banca tradicional": ["insurance", "banking"],
  Educación: ["education management", "higher education"],
  "Servicios profesionales": ["professional services", "accounting"],
  "Turismo y hostelería": ["hospitality", "leisure, travel & tourism"],
};

function titlesFromRoles(roles = []) {
  const titles = roles
    .flatMap((role) => String(role).split("/"))
    .map((t) => t.trim())
    .filter(Boolean);
  return [...new Set(titles)];
}

function tagsFromSectors(sectors = []) {
  const tags = sectors.flatMap((s) => SECTOR_TO_APOLLO_TAGS[s] || []);
  return [...new Set(tags)];
}

// Semanas transcurridas desde la época Unix. No pretende ser el número de
// semana ISO: solo un entero que avanza de siete en siete días, que es lo que
// necesita la rotación.
export function weekIndexFor(date = new Date()) {
  return Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
}

// Qué sector toca esta semana. La rotación es por SECTOR y no por cargo: los
// cargos buenos son los que son y no conviene alternarlos con peores solo por
// tener variedad. Lo que sí interesa variar son las empresas, y con una lista
// larga de cargos y un solo sector cada semana, la primera página de Apollo
// deja de ser monocolor.
//
// Devuelve null si no hay semana o el perfil no tiene sectores (los perfiles de
// los tests), y entonces se buscan todos a la vez.
export function sectorForWeek(profile = BUYER_PROFILE, weekIndex) {
  const sectors = profile.sectors;
  if (!sectors?.length || !Number.isFinite(weekIndex)) return null;
  return sectors[((weekIndex % sectors.length) + sectors.length) % sectors.length];
}

// Pura: mismo perfil y misma semana, misma consulta. Es la pieza que decide a
// quién se dirige la empresa, así que está cubierta por tests.
export function buildApolloQuery(
  profile = BUYER_PROFILE,
  { weekIndex, ...overrides } = {},
) {
  const sector = sectorForWeek(profile, weekIndex);
  const sectors = sector ? [sector] : profile.sectors;

  return {
    person_titles: titlesFromRoles(profile.roles),
    // Los cargos reales rara vez coinciden literalmente ("Directora General",
    // "Chief Operating Officer"…).
    include_similar_titles: true,
    person_seniorities: APOLLO_SENIORITIES,
    person_locations: APOLLO_PERSON_LOCATIONS,
    organization_num_employees_ranges: APOLLO_EMPLOYEE_RANGES,
    q_organization_keyword_tags: tagsFromSectors(sectors),
    page: 1,
    per_page: 25,
    ...overrides,
  };
}
