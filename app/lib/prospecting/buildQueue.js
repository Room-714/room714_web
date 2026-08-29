import { filterCandidates } from "./candidateFilter";

// Cuántas fichas se le ponen delante cada mañana. Veinte y no cuatro o cinco
// porque buscar es gratis: el cuello de botella es el presupuesto de créditos,
// que se gasta al decir que sí, no al mirar.
export const QUEUE_SIZE = 20;

// Cuántas páginas recorrer en una ejecución buscando caras nuevas. Con 25 por
// página son hasta 125 personas revisadas, y buscar no cuesta créditos.
export const MAX_SEARCH_PAGES = 5;

// Resultados por página que devuelve Apollo. Se usa para deducir por qué página
// va cada combinación.
export const PER_PAGE = 25;

// Por qué página empezar en una combinación de la que ya hemos visto gente.
//
// La búsqueda es determinista: pedir siempre la página 1 devuelve las mismas 25
// personas. Al principio da igual, porque se filtran por conocidas y se avanza;
// pero cuando una combinación lleva 125 caras vistas, las cinco páginas del
// recorrido son todas conocidas y deja de encontrar a nadie para siempre.
//
// En vez de guardar un puntero por combinación, se deduce de lo que ya hay en la
// base: si de esta combinación hemos visto 60 personas, están en las páginas 1 a
// 3, así que se empieza por la 3. Se resta una página de solape a propósito,
// porque el índice de Apollo se mueve y las fronteras no son exactas.
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
  let searched = 0;
  let pagesUsed = 0;
  let totalEntries = null;

  const lastPage = startPage + MAX_SEARCH_PAGES - 1;
  for (let page = startPage; page <= lastPage && candidates.length < wanted; page++) {
    const result = await search({ ...query, page });
    pagesUsed = page;
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
    });
    dropped.push(...fuera);

    for (const p of kept) {
      if (candidates.length >= wanted) break;
      candidates.push(p);
      yaElegidos.add(p.id);
    }
  }

  return {
    candidates,
    dropped,
    searched,
    pagesUsed,
    totalEntries,
    // Se agotó el pozo de esta combinación: o no quedan páginas o no quedan
    // caras nuevas. Lo consume el cron para avisar.
    exhausted: candidates.length < wanted,
  };
}
