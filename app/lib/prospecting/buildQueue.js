import { filterCandidates, normalizeCompany } from "./candidateFilter";

// Cuántas fichas se le ponen delante cada mañana. Veinte y no cuatro o cinco
// porque buscar es gratis: el cuello de botella es el presupuesto de créditos,
// que se gasta al decir que sí, no al mirar.
export const QUEUE_SIZE = 20;

// Cuántas páginas recorrer en una ejecución buscando caras nuevas. Con 25 por
// página son hasta 125 personas revisadas, y buscar no cuesta créditos.
export const MAX_SEARCH_PAGES = 5;

// Resultados por página que devuelve Apollo. Se usa para deducir por qué página
// va cada combinación (ver `startPageFor`), y `collectFreshCandidates` la
// impone en toda consulta que envía para que sea imposible que las dos
// dejen de coincidir: si el `per_page` real de la búsqueda divergiera de esta
// constante, `startPageFor` calcularía la ventana con el número equivocado y
// se saltaría páginas enteras sin que nadie lo notara — con 50 de verdad y 100
// vistos arrancaría en la página 4 en vez de la 3, perdiendo 50 personas.
export const PER_PAGE = 25;

// Por qué página empezar en una combinación de la que ya hemos visto gente.
//
// La búsqueda es determinista: pedir siempre la página 1 devuelve las mismas 25
// personas. Al principio da igual, porque se filtran por conocidas y se avanza;
// pero cuando una combinación lleva 125 caras vistas, las cinco páginas del
// recorrido son todas conocidas y deja de encontrar a nadie para siempre.
//
// En vez de guardar un puntero por combinación, se deduce de lo que ya hay en
// la base: a 25 por página, 60 personas vistas caen a mitad de la página 3
// (60 / 25 = 2.4), así que la página 3 todavía puede tener caras nuevas — y por
// eso se empieza en la 2, una página de solape antes, no en la 3. Restar esa
// página es intencional: el índice de Apollo se mueve y las fronteras no son
// exactas.
export function startPageFor(seenInCombo) {
  if (!seenInCombo) return 1;
  return Math.max(1, Math.floor(seenInCombo / PER_PAGE));
}

// Recorre páginas hasta reunir `wanted` candidatos que no hayamos visto y que
// pasen el filtro local. No escribe nada y no gasta créditos: la búsqueda de
// personas de Apollo es gratis.
//
// `search` se inyecta para poder probar esto sin red.
export async function collectFreshCandidates({
  search,
  query,
  wanted = QUEUE_SIZE,
  rules = {},
  knownIds = new Set(),
  startPage = 1,
}) {
  const candidates = [];
  const dropped = [];
  const yaElegidos = new Set();
  // Empresas ya colocadas en la cola en páginas anteriores de esta misma
  // llamada. Se normalizan con `normalizeCompany`, la misma función que usa
  // `filterCandidates` por dentro, importada de allí en vez de reimplementada
  // aquí: así es imposible que las dos normalizaciones diverjan y dejen de
  // casar (que es justo el bug que hacía que se colaran varios candidatos de
  // la misma empresa repartidos entre páginas).
  const empresasElegidas = new Set();
  let searched = 0;
  let lastPageFetched = 0;
  let pagesFetched = 0;
  let totalEntries = null;

  const lastPage = startPage + MAX_SEARCH_PAGES - 1;
  for (let page = startPage; page <= lastPage && candidates.length < wanted; page++) {
    // `per_page: PER_PAGE` va después de `...query` a propósito, para que gane
    // siempre y la consulta no pueda colar un valor distinto (ver el
    // comentario de PER_PAGE).
    const result = await search({ ...query, page, per_page: PER_PAGE });
    lastPageFetched = page;
    pagesFetched += 1;
    searched += result.people.length;
    totalEntries = result.totalEntries ?? totalEntries;

    if (result.people.length === 0) break;

    // Los ya elegidos en páginas anteriores cuentan como conocidos: Apollo puede
    // devolver a la misma persona en dos páginas si el índice se mueve entre
    // llamadas.
    const vistos = new Set([...knownIds, ...yaElegidos]);
    const { kept, dropped: fuera } = filterCandidates(result.people, {
      rules,
      knownIds: vistos,
      knownCompanies: empresasElegidas,
    });
    dropped.push(...fuera);

    for (const p of kept) {
      if (candidates.length >= wanted) break;
      candidates.push(p);
      yaElegidos.add(p.id);
      const companyKey = normalizeCompany(p.organization?.name ?? null);
      if (companyKey) empresasElegidas.add(companyKey);
    }
  }

  return {
    candidates,
    dropped,
    searched,
    // Dos números distintos a propósito. `lastPageFetched` es la página
    // absoluta en la que se paró, y sirve para saber por dónde va esta
    // combinación; `pagesFetched` es cuántas llamadas se hicieron. Con
    // startPage 3 y cinco páginas, la primera vale 7 y la segunda 5, y leer una
    // por la otra hace pensar que se buscó más de lo que se buscó.
    lastPageFetched,
    pagesFetched,
    totalEntries,
    // Se agotó el pozo de esta combinación: o no quedan páginas o no quedan
    // caras nuevas. Lo consume el cron para avisar.
    exhausted: candidates.length < wanted,
  };
}
