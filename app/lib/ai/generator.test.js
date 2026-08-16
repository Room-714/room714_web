import { describe, expect, it } from "vitest";
import { buildUserPrompt } from "./generator";

const TRENDING = [
  { title: "Un titular en tendencia", source: "Medium", description: "..." },
];

const RECENT = [
  {
    date: "2026-07-27",
    category: "TECH",
    title: "Post reciente con slug",
    tags: ["IA"],
    slug_es: "post-reciente-con-slug",
    slug_en: "recent-post-with-slug",
  },
];

const CORPUS = [
  {
    date: "2026-06-01",
    category: "TECH",
    title_es: "Seguridad en IA para equipos pequeños",
    title_en: "AI security for small teams",
    tags: ["IA", "Seguridad"],
  },
  {
    date: "2026-05-04",
    category: "UX",
    title_es: "La paradoja de la elección en onboarding",
    title_en: "The paradox of choice in onboarding",
    tags: ["UX"],
  },
];

function prompt(extra = {}) {
  return buildUserPrompt({
    category: "TECH",
    trending: TRENDING,
    recentPosts: RECENT,
    ...extra,
  });
}

describe("buildUserPrompt — corpus publicado", () => {
  it("incluye los títulos del corpus que se le pasan", () => {
    const out = prompt({ publishedCorpus: CORPUS });
    expect(out).toContain("Seguridad en IA para equipos pequeños");
    expect(out).toContain("La paradoja de la elección en onboarding");
  });

  it("agrupa por categoría y anota fecha y tags", () => {
    const out = prompt({ publishedCorpus: CORPUS });
    expect(out).toContain("### TECH");
    expect(out).toContain("### UX");
    expect(out).toContain("(2026-06-01)");
    expect(out).toContain("[IA, Seguridad]");
  });

  it("lleva la instrucción explícita de no repetir ángulos", () => {
    const out = prompt({ publishedCorpus: CORPUS });
    expect(out).toContain("NO repitas ninguno de estos ángulos");
    expect(out).toContain("Google trate ambos como duplicados");
  });

  it("cae en silencio si no hay corpus", () => {
    expect(prompt({ publishedCorpus: [] })).not.toContain("Corpus ya publicado");
    expect(prompt()).not.toContain("Corpus ya publicado");
  });

  it("mantiene intacta la sección de posts recientes con sus slugs", () => {
    // validateGenerated la usa para validar los enlaces internos: si
    // desapareciera, el enlazado interno se rompería en silencio.
    const out = prompt({ publishedCorpus: CORPUS });
    expect(out).toContain("slug_es: post-reciente-con-slug");
    expect(out).toContain("INTERNAL LINKING");
  });

  it("usa el título en inglés si falta el español", () => {
    const out = prompt({
      publishedCorpus: [
        {
          date: "2026-04-01",
          category: "PRODUCT",
          title_es: null,
          title_en: "Only english title",
          tags: [],
        },
      ],
    });
    expect(out).toContain("Only english title");
  });
});
