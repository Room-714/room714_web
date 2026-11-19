import { describe, expect, it } from "vitest";
import { buildDailyTasks } from "./dailyTasks";

const SITE = "https://www.room714.com";

// Lunes 16 de noviembre de 2026, 07:30 Madrid.
const LUNES = new Date("2026-11-16T06:30:00Z");

const kinds = (list) => list.map((t) => t.kind);

const articulo = (extra = {}) => ({
  id: 77,
  source: "AUTO",
  date: LUNES,
  translations: [{ lang: "es", slug: "articulo-nuevo", title: "Artículo nuevo" }],
  linkedinVariants: [{ id: 1 }],
  ...extra,
});

describe("buildDailyTasks — sin acciones manuales de LinkedIn", () => {
  it("no pide comentar, recompartir ni poner el primer comentario", () => {
    const { tasks } = buildDailyTasks({ blogPost: articulo(), siteUrl: SITE });
    expect(kinds(tasks)).toEqual(["blog_review"]);
    for (const k of ["comment_personal", "reshare_company", "first_comment"]) {
      expect(kinds(tasks)).not.toContain(k);
    }
  });

  it("ignora las variantes que le lleguen del calendario antiguo", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [{ id: 1, variant: 2, post: articulo() }],
      blogPost: null,
      siteUrl: SITE,
    });
    expect(tasks).toEqual([]);
  });
});

describe("buildDailyTasks — artículo e incidencias", () => {
  it("avisa del artículo que se ha publicado hoy", () => {
    const { tasks } = buildDailyTasks({ blogPost: articulo(), siteUrl: SITE });
    expect(tasks[0]).toMatchObject({
      kind: "blog_review",
      when: "after",
      time: "07:30",
      articleUrl: `${SITE}/es/blog/articulo-nuevo`,
      adminUrl: `${SITE}/admin?postId=77`,
    });
  });

  it("no añade nada si hoy no hay artículo ni tocaba", () => {
    expect(buildDailyTasks({ blogPost: null, siteUrl: SITE })).toEqual({ tasks: [], incidents: [] });
  });

  it("informa si el artículo automático se quedó sin toma", () => {
    const { incidents } = buildDailyTasks({
      blogPost: articulo({ linkedinVariants: [] }),
      siteUrl: SITE,
    });
    expect(kinds(incidents)).toEqual(["no_takes"]);
  });

  it("no informa de falta de toma en un artículo manual", () => {
    const { incidents } = buildDailyTasks({
      blogPost: articulo({ source: "MANUAL", linkedinVariants: [] }),
      siteUrl: SITE,
    });
    expect(incidents).toEqual([]);
  });

  it("informa si tocaba artículo y no se generó", () => {
    const { incidents } = buildDailyTasks({ blogPost: null, expectsArticle: true, siteUrl: SITE });
    expect(kinds(incidents)).toEqual(["no_article"]);
  });
});
