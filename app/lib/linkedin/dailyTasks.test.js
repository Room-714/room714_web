import { describe, expect, it } from "vitest";
import { buildDailyTasks } from "./dailyTasks";

const SITE = "https://www.room714.com";

// Lunes 27 y miércoles 29 de julio de 2026, 10:00 Madrid.
const LUNES = new Date("2026-07-27T08:00:00Z");
const MIERCOLES = new Date("2026-07-29T08:00:00Z");

function variante({
  id = 1,
  variant = 1,
  postDate = LUNES,
  scheduledFor,
  ...rest
}) {
  return {
    id,
    variant,
    text: "Texto de la variante",
    hashtags: ["#IA", "#UX"],
    crossNote: "Sugerencia generada",
    scheduledFor: scheduledFor ?? postDate,
    post: {
      id: 10,
      date: postDate,
      translations: [{ lang: "es", slug: "mi-post", title: "Mi post" }],
    },
    ...rest,
  };
}

function kinds(tasks) {
  return tasks.map((t) => t.kind);
}

describe("buildDailyTasks — variantes del día", () => {
  it("lunes: revisar, primer comentario y recompartir desde la página", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: LUNES })],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual([
      "review_own",
      "first_comment",
      "reshare_company",
    ]);
  });

  it("martes: solo comentar desde el perfil", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        variante({
          variant: 2,
          postDate: LUNES,
          scheduledFor: new Date("2026-07-28T08:00:00Z"),
        }),
      ],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["comment_personal"]);
  });

  it("miércoles: dos publicaciones y ninguna acción cruzada", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        // Deriv. 1 del artículo nuevo, 10:00, canal personal.
        variante({ id: 1, variant: 1, postDate: MIERCOLES }),
        // Deriv. 3 del artículo del lunes, 16:00, canal empresa.
        variante({
          id: 2,
          variant: 3,
          postDate: LUNES,
          scheduledFor: new Date("2026-07-29T14:00:00Z"),
        }),
      ],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["review_own", "first_comment"]);
  });

  it("viernes: la v3 del miércoles es tuya y la recomparte la página", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        variante({
          variant: 3,
          postDate: MIERCOLES,
          scheduledFor: new Date("2026-07-31T14:00:00Z"),
        }),
      ],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual([
      "review_own",
      "first_comment",
      "reshare_company",
    ]);
  });

  it("la tarea de revisión trae todo lo necesario para ejecutarla", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: LUNES })],
      siteUrl: SITE,
    });
    const review = tasks.find((t) => t.kind === "review_own");
    expect(review.when).toBe("before");
    expect(review.time).toBe("10:00");
    expect(review.text).toBe("Texto de la variante");
    expect(review.hashtags).toEqual(["#IA", "#UX"]);
    expect(review.articleUrl).toBe(`${SITE}/es/blog/mi-post`);
    expect(review.voiceHint).toContain("primera persona");
  });

  it("las acciones cruzadas enlazan al redirector y llevan la sugerencia", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ id: 42, variant: 1, postDate: LUNES })],
      siteUrl: SITE,
    });
    const reshare = tasks.find((t) => t.kind === "reshare_company");
    expect(reshare.when).toBe("after");
    expect(reshare.suggestion).toBe("Sugerencia generada");
    expect(reshare.linkUrl).toBe(`${SITE}/api/go/variant/42`);
  });

  it("mantiene la tarea aunque no haya sugerencia generada", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        variante({ variant: 1, postDate: LUNES, crossNote: null }),
      ],
      siteUrl: SITE,
    });
    const reshare = tasks.find((t) => t.kind === "reshare_company");
    expect(reshare).toBeDefined();
    expect(reshare.suggestion).toBeNull();
  });

  it("omite el primer comentario si Make ya lo publica", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: LUNES })],
      siteUrl: SITE,
      firstCommentAutomated: true,
    });
    expect(kinds(tasks)).toEqual(["review_own", "reshare_company"]);
  });

  it("ignora variantes sin traducción española", () => {
    const sinEs = variante({ variant: 1, postDate: LUNES });
    sinEs.post.translations = [
      { lang: "en", slug: "my-post", title: "My post" },
    ];
    const { tasks } = buildDailyTasks({ todayVariants: [sinEs], siteUrl: SITE });
    expect(tasks).toEqual([]);
  });

  it("devuelve listas vacías si no hay nada hoy", () => {
    const { tasks, incidents } = buildDailyTasks({ siteUrl: SITE });
    expect(tasks).toEqual([]);
    expect(incidents).toEqual([]);
  });
});

describe("buildDailyTasks — blog, incidencias y orden", () => {
  it("añade la revisión del artículo que se publica hoy", () => {
    const { tasks } = buildDailyTasks({
      blogPost: {
        id: 77,
        date: LUNES,
        translations: [
          { lang: "es", slug: "articulo-nuevo", title: "Artículo nuevo" },
        ],
      },
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["blog_review"]);
    expect(tasks[0].articleUrl).toBe(`${SITE}/es/blog/articulo-nuevo`);
    expect(tasks[0].adminUrl).toBe(`${SITE}/admin?postId=77`);
  });

  it("no añade nada de blog si hoy no se publica artículo", () => {
    const { tasks } = buildDailyTasks({ blogPost: null, siteUrl: SITE });
    expect(tasks).toEqual([]);
  });

  it("informa de las variantes de ayer que no llegaron a publicarse", () => {
    const { tasks, incidents } = buildDailyTasks({
      yesterdayUnsent: [
        {
          id: 5,
          variant: 2,
          scheduledFor: new Date("2026-07-28T08:00:00Z"),
          post: {
            id: 10,
            date: LUNES,
            translations: [{ lang: "es", slug: "mi-post", title: "Mi post" }],
          },
        },
      ],
      siteUrl: SITE,
    });
    expect(tasks).toEqual([]);
    expect(kinds(incidents)).toEqual(["not_published"]);
    expect(incidents[0].title).toContain("no llegó a publicarse");
  });

  it("ordena por hora, y a igual hora lo previo antes que lo posterior", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        // 16:00, canal empresa, sin acción cruzada → no genera tareas.
        variante({
          id: 2,
          variant: 3,
          postDate: LUNES,
          scheduledFor: new Date("2026-07-29T14:00:00Z"),
        }),
        // 10:00, canal personal → revisar (antes) + primer comentario (después).
        variante({ id: 1, variant: 1, postDate: MIERCOLES }),
      ],
      blogPost: {
        id: 77,
        date: MIERCOLES,
        translations: [
          { lang: "es", slug: "articulo-nuevo", title: "Artículo nuevo" },
        ],
      },
      siteUrl: SITE,
    });
    expect(tasks.map((t) => [t.time, t.when])).toEqual([
      ["10:00", "before"],
      ["10:00", "before"],
      ["10:00", "after"],
    ]);
  });
});
