// ─── Perfil de cliente ideal (ICP) para la prospección en LinkedIn ─────────
// Derivado de los servicios de Room714 (UX/UI, Product Management, CX
// Research, Transformación Digital, Software Development). Se usa en dos
// sitios: el prompt del redactor de comentarios (contexto de a quién le
// hablamos) y las búsquedas sugeridas del briefing cuando la lista de
// prospectos aún es corta.
//
// Editar este fichero ES editar la estrategia de prospección: no hay más
// configuración escondida.

export const IDEAL_CUSTOMER_PROFILE = {
  // A quién buscamos: decisores con presupuesto de producto/digital.
  roles: [
    "CEO / Founder",
    "CPO / Head of Product",
    "CTO / VP Engineering",
    "Head of Digital / Transformación Digital",
    "Head of UX / Design Lead",
    "Director de Innovación",
  ],
  // Dónde: empresas con producto digital propio o canal digital relevante.
  sectors: [
    "SaaS y scaleups",
    "Banca y fintech",
    "Retail y ecommerce",
    "Salud digital",
    "Industria con canal digital (B2B)",
    "Medios y educación online",
  ],
  // Señales de que un post suyo es comentable con nuestra voz.
  signals: [
    "Habla de rediseños, lanzamientos o roadmap de producto",
    "Se queja de fricción, churn o conversión",
    "Menciona modernizar sistemas legados",
    "Pregunta o opina sobre IA aplicada a producto",
    "Comparte métricas o aprendizajes de UX/CX",
  ],
  // Palabras clave para búsquedas de contenido en LinkedIn.
  keywords: [
    "UX",
    "product management",
    "experiencia de cliente",
    "transformación digital",
    "producto digital",
    "IA en producto",
  ],
};

// Búsquedas de contenido en LinkedIn para encontrar posts comentables cuando
// un prospecto no ha publicado nada reciente. Rotan por día para no repetir.
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

// Cuántas tareas de prospección entran en el briefing de cada día laborable.
export const PROSPECT_TASKS_PER_DAY = 2;

// ─── Traducción del ICP a una consulta de Apollo ────────────────────────────
// El perfil de arriba está escrito para humanos y para el prompt del redactor.
// Esto lo convierte en filtros de la People Search API. Se mantienen separados
// a propósito: el ICP es la estrategia, esto es su implementación.

// Lo primero que se va a querer cambiar. Apollo acepta país, región o ciudad.
export const APOLLO_PERSON_LOCATIONS = ["Spain"];

// Ni startup sin presupuesto ni multinacional inalcanzable. Apollo espera
// cadenas "mínimo,máximo".
export const APOLLO_EMPLOYEE_RANGES = ["51,1000"];

// Valores del enum de Apollo: owner, founder, c_suite, partner, vp, head,
// director, manager, senior, entry, intern.
export const APOLLO_SENIORITIES = ["c_suite", "founder", "head", "director"];

// Apollo NO tiene filtro de industria en la People Search API (verificado en
// docs.apollo.io/reference/people-api-search y /organization-search: no existe
// `organization_industries` ni se documenta `organization_industry_tag_ids`,
// que además exigiría IDs numéricos internos sin forma documentada de
// obtenerlos). Lo más cercano que SÍ está documentado es el filtro por
// etiquetas de palabra clave, así que traducimos cada sector del ICP a los
// términos en inglés con los que Apollo etiqueta a esas empresas.
export const SECTOR_TO_APOLLO_TAGS = {
  "SaaS y scaleups": ["saas", "software"],
  "Banca y fintech": ["banking", "fintech"],
  "Retail y ecommerce": ["retail", "e-commerce"],
  "Salud digital": ["digital health", "health care"],
  "Industria con canal digital (B2B)": ["manufacturing", "industrial"],
  "Medios y educación online": ["media", "e-learning"],
};

// "CEO / Founder" es legible para una persona pero no es un cargo que Apollo
// entienda: hay que partirlo en cargos sueltos.
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

// Pura: mismo perfil, misma consulta. Es la pieza que decide a quién se dirige
// la empresa, así que está cubierta por tests.
export function buildApolloQuery(profile = IDEAL_CUSTOMER_PROFILE, overrides = {}) {
  return {
    person_titles: titlesFromRoles(profile.roles),
    // Los cargos reales rara vez coinciden literalmente ("Head of Product
    // Design", "Directora de Producto"…).
    include_similar_titles: true,
    person_seniorities: APOLLO_SENIORITIES,
    person_locations: APOLLO_PERSON_LOCATIONS,
    organization_num_employees_ranges: APOLLO_EMPLOYEE_RANGES,
    q_organization_keyword_tags: tagsFromSectors(profile.sectors),
    page: 1,
    per_page: 25,
    ...overrides,
  };
}
