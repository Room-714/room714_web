import * as medium from "./medium";
import * as devto from "./devto";
import * as hackernews from "./hackernews";
import * as nngroup from "./nngroup";
import * as smashing from "./smashing";
import { dedupeByTitle, sortByDateDesc } from "./_rss";

const SOURCES = [medium, devto, hackernews, nngroup, smashing];

function interleave(lists) {
  const result = [];
  const maxLen = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (list[i]) result.push(list[i]);
    }
  }
  return result;
}

export async function getCrossSourceTrending(category, maxItems = 24) {
  const lists = await Promise.all(
    SOURCES.map(async (src) => {
      try {
        const items = await src.getTrendingForCategory(category);
        return sortByDateDesc(items);
      } catch (err) {
        console.warn(`Fuente ${src.SOURCE_NAME ?? "?"} falló:`, err.message);
        return [];
      }
    }),
  );

  const interleaved = interleave(lists);
  const unique = dedupeByTitle(interleaved, 60);

  return unique.slice(0, maxItems);
}

export function summarizeSources(items) {
  const counts = {};
  for (const it of items) {
    const s = it.source ?? "?";
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}
