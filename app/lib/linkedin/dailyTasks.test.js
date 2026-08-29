import { describe, expect, it } from "vitest";
import { buildDailyTasks } from "./dailyTasks";

const SITE = "https://www.room714.com";

// Lunes 27 y miércoles 29 de julio de 2026, 07:30 Madrid.
const LUNES = new Date("2026-07-27T05:30:00Z");
const MIERCOLES = new Date("2026-07-29T05:30:00Z");

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
  it("lunes: primer comentario y recompartir desde la página", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: LUNES })],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["first_comment", "reshare_company"]);
  });

  it("martes: solo comentar desde el perfil", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        variante({
          variant: 2,
          postDate: LUNES,
          scheduledFor: new Date("2026-07-28T05:30:00Z"),
        }),
      ],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["comment_personal"]);
  });

  it("miércoles: primer comentario y recompartir del segundo artículo", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: MIERCOLES })],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["first_comment", "reshare_company"]);
  });

  it("viernes: la toma 3 del lunes es tuya y la recomparte la página", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        variante({
          variant: 3,
          postDate: LUNES,
          scheduledFor: new Date("2026-07-31T05:30:00Z"),
        }),
      ],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["first_comment", "reshare_company"]);
  });

  it("no pide revisar el texto: el briefing llega cuando ya se ha publicado", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: LUNES })],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).not.toContain("review_own");
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
    expect(kinds(tasks)).toEqual(["reshare_company"]);
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

  it("avisa si el artículo de hoy se quedó sin tomas", () => {
    const { incidents } = buildDailyTasks({
      blogPost: {
        id: 10,
        date: LUNES,
        translations: [{ lang: "es", slug: "mi-post", title: "Mi post" }],
        linkedinVariants: [],
      },
      siteUrl: SITE,
    });
    expect(incidents.map((i) => i.kind)).toContain("no_takes");
  });

  it("no avisa si el artículo de hoy ya tiene sus tomas", () => {
    const { incidents } = buildDailyTasks({
      blogPost: {
        id: 10,
        date: LUNES,
        translations: [{ lang: "es", slug: "mi-post", title: "Mi post" }],
        linkedinVariants: [{ id: 1 }],
      },
      siteUrl: SITE,
    });
    expect(incidents.map((i) => i.kind)).not.toContain("no_takes");
  });

  // El caso viejo comparaba tres tareas que caían todas a la misma hora
  // (10:00), así que en realidad solo probaba el desempate before/antes de
  // after/después y nunca el orden ascendente entre horas distintas. Al quitar
  // review_own, blog_review sigue siendo la única tarea "before" del día, así
  // que se conserva ese desempate y además se añade una toma a otra hora
  // (08:35) para que el orden ascendente quede probado de verdad.
  it("ordena por hora, y a igual hora lo previo antes que lo posterior", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        // 08:35, canal personal → primer comentario + recompartir (después).
        variante({
          id: 2,
          variant: 1,
          postDate: LUNES,
          scheduledFor: new Date("2026-07-27T06:35:00Z"),
        }),
        // 07:30, canal personal → primer comentario + recompartir (después).
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
      ["07:30", "before"],
      ["07:30", "after"],
      ["07:30", "after"],
      ["08:35", "after"],
      ["08:35", "after"],
    ]);
  });
});
