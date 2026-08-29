// ─── Perfil de prospección en LinkedIn ──────────────────────────────────────
// Hubo un segundo público, "referencia" (gente que publica mucho, a quien se
// comentaba para ganar alcance), y un flujo entero de comentar publicaciones
// alrededor de él. Se retiraron los dos: en meses no produjeron ni un solo
// engagement registrado. Lo que queda es un único público, el comprador, y las
// acciones diarias se reducen a revisar la cola de candidatos que trae Apollo
// y darle feedback a la búsqueda.
//
// Editar este fichero ES editar la estrategia de prospección: no hay más
// configuración escondida.

// Se normaliza aquí con la misma función que usa candidateFilter.js por la
// misma razón que allí: los cargos excluidos por las reglas vienen del
// `title` crudo que devuelve Apollo, y los de este perfil los escribimos
// nosotros a mano ("CEO", con mayúsculas y sin espacios de sobra). Comparar
// sin normalizar los dos lados deja pasar exactamente los cargos que se
// querían excluir.
import { normalizeTitle } from "@/app/lib/prospecting/candidateFilter";

// ─── El comprador ───────────────────────────────────────────────────────────
// Ojo con la tentación de meter aquí cargos de producto (CPO, Head of Product)
// o sectores de software: buscar esos cargos garantiza dar con empresas que ya
// tienen la capacidad dentro, que son exactamente las que NO nos necesitan. La
// primera versión de este fichero cometía ese error y trajo agencias digitales
// y startups de software, competencia incluida.
export const BUYER_PROFILE = {
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
};

// ─── Traducción del perfil de comprador a una consulta de Apollo ────────────

// Lo primero que se va a querer cambiar. Apollo acepta país, región o ciudad.
export const APOLLO_PERSON_LOCATIONS = ["Spain"];

// "Mediana empresa" según la definición europea: 50 a 250 empleados. Por debajo
// no hay presupuesto; por encima suele haber equipo propio.
//
// Va partido en dos tramos, y no como un rango único, por una razón que no es
// obvia: la búsqueda de Apollo NO devuelve la plantilla de la empresa (solo una
// bandera de si la tiene), así que la única forma de saber en qué tramo cae un
// candidato es haberlo preguntado. Sin esta partición, el motivo de descarte
// "el tamaño no encaja" no tendría a qué apuntar y la regla derivada que quita
// un tramo de la consulta no podría existir.
export const APOLLO_EMPLOYEE_RANGES = ["51,100", "101,250"];

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

// Cargos que de verdad se le piden a Apollo hoy: los del perfil menos los que
// las reglas han excluido, comparando normalizado (ver el comentario del
// import de normalizeTitle).
//
// Un array vacío en `person_titles` no es "ningún cargo" para Apollo: es
// "cualquier cargo", sin que nada lo avise (verificado contra la API: con
// person_titles: [] Apollo devuelve gente de cualquier cargo dentro de las
// seniorities pedidas). Si excluir deja la lista ENTERA vacía —las reglas han
// excluido los catorce cargos del perfil, algo que hoy no puede pasar a la
// vez con TITLE_STRIKES pero que no cuesta nada defender—, ignorar la
// exclusión entera y pedir la lista completa es mejor que mandar un filtro
// que en apariencia funciona y en realidad no filtra nada.
export function effectiveTitles(profile = BUYER_PROFILE, rules = {}) {
  const candidatos = titlesFromRoles(profile.roles);
  const excluidos = (rules.excludedTitles ?? []).map(normalizeTitle);
  const filtrados = candidatos.filter((t) => !excluidos.includes(normalizeTitle(t)));
  return filtrados.length ? filtrados : candidatos;
}

// Qué tramo de plantilla se busca de verdad. La combinación del día propone
// uno, pero si las reglas ya lo excluyeron (SIZE_STRIKES descartes y ningún
// sí que lo salve, ver app/lib/prospecting/rules.js) buscar en él de todas
// formas ignoraría precisamente la señal que esa regla existe para aplicar.
// En ese caso se ensancha a todos los tramos no excluidos: no se salta a OTRO
// tramo dentro del par sector+tramo (eso rompería la lectura de "qué
// combinación tocaba hoy" en el panel de aprendizaje) ni se deja de buscar
// (un día sin búsqueda no aporta nada). El sector de la combinación nunca se
// toca aquí: solo el tramo es lo que las reglas pueden haber desaconsejado.
//
// Por lo mismo que effectiveTitles: si excluir vacía los dos tramos a la vez,
// un array vacío en `organization_num_employees_ranges` sería "cualquier
// tamaño" para Apollo, no "ninguno", así que se ignora la exclusión entera.
//
// Esta es también la función que hay que usar para saber qué tramo etiquetar
// en cada candidato (ver el cron): la combinación del día es una PROPUESTA,
// no necesariamente lo que se ha buscado, y etiquetar con la propuesta en
// vez de con esto sería mentir en un dato que realimenta las reglas.
export function effectiveSizes(combo, rules = {}) {
  const excluidos = rules.excludedSizes ?? [];
  if (combo?.size && !excluidos.includes(combo.size)) return [combo.size];
  const restantes = APOLLO_EMPLOYEE_RANGES.filter((r) => !excluidos.includes(r));
  return restantes.length ? restantes : APOLLO_EMPLOYEE_RANGES;
}

// Qué dimensiones de la consulta se han tenido que ignorar por completo hoy
// porque las reglas las habían vaciado (ver effectiveTitles/effectiveSizes
// arriba). Lo consume el cron para dejarlo a la vista en el resumen: si esto
// no sale vacío, alguna regla se ha vuelto tan agresiva que ha dejado de
// filtrar nada sin que nadie lo note — que es justamente el peligro de una
// lista vacía en Apollo.
export function emptiedDimensions(profile = BUYER_PROFILE, rules = {}) {
  const vaciadas = [];

  const candidatosTitulos = titlesFromRoles(profile.roles);
  const excluidosTitulos = (rules.excludedTitles ?? []).map(normalizeTitle);
  const quedanTitulos = candidatosTitulos.filter(
    (t) => !excluidosTitulos.includes(normalizeTitle(t)),
  );
  if (candidatosTitulos.length > 0 && quedanTitulos.length === 0) {
    vaciadas.push("cargos");
  }

  const excluidosTramos = rules.excludedSizes ?? [];
  if (APOLLO_EMPLOYEE_RANGES.every((r) => excluidosTramos.includes(r))) {
    vaciadas.push("tramos");
  }

  return vaciadas;
}

// Días transcurridos desde la época Unix. No pretende ser un número de día del
// año: solo un entero que avanza de uno en uno, que es lo que necesita la
// rotación.
export function dayIndexFor(date = new Date()) {
  return Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
}

// Todas las combinaciones de sector y tramo, en orden estable. Son 14, así que
// con una al día una combinación se repite cada dos semanas y media: tiempo de
// sobra para que Apollo tenga caras nuevas que enseñar.
export function searchCombos(profile = BUYER_PROFILE) {
  const sectors = profile.sectors?.length ? profile.sectors : [null];
  return sectors.flatMap((sector) =>
    APOLLO_EMPLOYEE_RANGES.map((size) => ({ sector, size })),
  );
}

// Qué combinación toca hoy. El ciclo es FIJO, y eso es deliberado: garantiza que
// todas las combinaciones se sigan muestreando. Ponderarlo por tasa de acierto
// sería un trinquete — una combinación con una mala racha temprana dejaría de
// salir y no podría demostrar nunca que era buena. La tasa se calcula y se
// enseña en el panel de aprendizaje, para que la decisión de estrechar el perfil
// la tome una persona.
export function comboForDay(profile = BUYER_PROFILE, dayIndex) {
  const combos = searchCombos(profile);
  if (!combos.length || !Number.isFinite(dayIndex)) return combos[0] ?? null;
  return combos[((dayIndex % combos.length) + combos.length) % combos.length];
}

// Pura: mismo perfil, misma combinación y mismas reglas, misma consulta. Es la
// pieza que decide a quién se dirige la empresa, así que está cubierta por tests.
//
// `rules` viene de app/lib/prospecting/rules.js y sale de contar las decisiones
// pasadas. Aquí solo se aplica; la política de cuándo excluir algo vive allí.
export function buildApolloQuery(
  profile = BUYER_PROFILE,
  { combo, rules = {}, ...overrides } = {},
) {
  const titles = effectiveTitles(profile, rules);
  const sectors = combo?.sector ? [combo.sector] : profile.sectors;
  const sizes = effectiveSizes(combo, rules);

  return {
    person_titles: titles,
    // Los cargos reales rara vez coinciden literalmente ("Directora General",
    // "Chief Operating Officer"…).
    include_similar_titles: true,
    person_seniorities: APOLLO_SENIORITIES,
    person_locations: APOLLO_PERSON_LOCATIONS,
    organization_num_employees_ranges: sizes,
    q_organization_keyword_tags: tagsFromSectors(sectors),
    page: 1,
    per_page: 25,
    ...overrides,
  };
}
