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

// El tramo de plantilla que se corresponde con facturar 50-100 M€ en España.
// Antes eran 51-100 y 101-250, la definición europea de mediana empresa; con el
// criterio nuevo de facturación esos tramos apuntan demasiado bajo, porque
// 50-100 M€ rara vez caben en menos de cien empleados.
//
// Consecuencia asumida del cambio: las reglas aprendidas sobre "51,100" dejan de
// aplicar. No se borra nada — deriveRules cuenta decisiones, y las de un tramo
// que ya no se busca simplemente no afectan a ninguna consulta.
//
// Sigue partido en dos tramos por la misma razón que antes: la búsqueda de
// Apollo NO devuelve la plantilla, así que la única forma de saber en qué tramo
// cae un candidato es haberlo preguntado.
export const APOLLO_EMPLOYEE_RANGES = ["101,250", "251,500"];

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

// Cada cuántas ejecuciones tiene que salir OBLIGATORIAMENTE una combinación,
// tenga la tasa de acierto que tenga.
//
// Este número es lo único que separa una rotación ponderada de un trinquete. Sin
// él, una combinación con mala racha temprana deja de salir, y al no salir no
// puede generar decisiones nuevas, y sin decisiones nuevas su tasa no cambia
// jamás: queda condenada por tres semanas malas.
//
// Con 14 combinaciones y una al día, la rotación fija anterior muestreaba cada
// una cada 14 ejecuciones. 20 es por tanto una relajación deliberada: da margen
// a la ponderación sin dejar que nada desaparezca más de un mes natural. Es el
// parámetro a revisar con datos a los tres meses.
export const SUELO_EJECUCIONES = 20;

// Qué combinación toca hoy.
//
// `historial` trae, por combinación, cuántas ejecuciones han pasado desde la
// última vez que salió y su recuento de aciertos. **Sin historial, esto se
// comporta exactamente como la rotación fija de antes**, que es lo que garantiza
// que el cambio no altere el comportamiento del primer día.
export function comboForDay(profile = BUYER_PROFILE, dayIndex, { historial = [] } = {}) {
  const combos = searchCombos(profile);
  if (!combos.length || !Number.isFinite(dayIndex)) return combos[0] ?? null;

  const porClave = new Map(historial.map((h) => [`${h.sector}|${h.size}`, h]));
  const datos = (c) => porClave.get(`${c.sector}|${c.size}`);

  // 1 · El suelo manda sobre todo lo demás. Si varias lo han superado, sale la
  // que lleve más tiempo sin aparecer.
  const vencidas = combos
    .filter((c) => (datos(c)?.ejecucionesDesde ?? Infinity) >= SUELO_EJECUCIONES)
    .sort(
      (a, b) =>
        (datos(b)?.ejecucionesDesde ?? Infinity) - (datos(a)?.ejecucionesDesde ?? Infinity),
    );
  if (vencidas.length) return vencidas[0];

  // 2 · Sin historial en absoluto, rotación fija: el comportamiento anterior.
  if (historial.length === 0) {
    return combos[((dayIndex % combos.length) + combos.length) % combos.length];
  }

  // 3 · Ponderado por tasa suavizada (Laplace: +1 acierto, +2 total). Sin
  // suavizar, una combinación con un solo acierto de un intento (1/1)
  // adelantaría a una con cuarenta de cincuenta, que es de la que más sabemos.
  //
  // La elección es DETERMINISTA a partir de `dayIndex`, no aleatoria: el mismo
  // día con los mismos datos da la misma combinación, y eso es lo que permite
  // que el modo `?preview=1` del cron enseñe de verdad lo que va a hacer.
  const pesos = combos.map((c) => {
    const h = datos(c);
    return ((h?.hits ?? 0) + 1) / ((h?.total ?? 0) + 2);
  });

  const suma = pesos.reduce((a, b) => a + b, 0);
  // Rueda de ruleta recorrida con una posición derivada del día.
  const posicion = ((dayIndex % 1000) / 1000) * suma;
  let acumulado = 0;
  for (let i = 0; i < combos.length; i++) {
    acumulado += pesos[i];
    if (posicion < acumulado) return combos[i];
  }
  return combos[combos.length - 1];
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
