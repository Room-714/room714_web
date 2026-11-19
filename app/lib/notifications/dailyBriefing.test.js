import { describe, expect, it } from "vitest";
import { renderBriefingHtml, renderTaskHtml } from "./dailyBriefing";

const blogReview = (extra = {}) => ({
  id: "blog-77",
  kind: "blog_review",
  when: "after",
  time: "07:30",
  channel: null,
  title: "El artículo de hoy ya está publicado",
  articleTitle: "Mi post",
  articleUrl: "https://www.room714.com/es/blog/mi-post",
  adminUrl: "https://www.room714.com/admin?postId=77",
  ...extra,
});

describe("renderBriefingHtml (solo informa, no pide acciones)", () => {
  it("se presenta como resumen, sin tareas que hacer", () => {
    const html = renderBriefingHtml({ tasks: [blogReview()], incidents: [], dateLabel: "lunes 16" });
    expect(html).toContain("Resumen del blog — lunes 16");
    expect(html).toContain("no tienes que hacer nada");
    expect(html).not.toMatch(/tus tareas/i);
  });

  it("el artículo del día dice que ya está publicado", () => {
    const html = renderBriefingHtml({ tasks: [blogReview()], incidents: [], dateLabel: "lunes 16" });
    expect(html).toContain("ya está publicado");
    expect(html).toContain("Se publicó a las 07:30");
  });

  it("escapa el HTML del título del artículo", () => {
    const html = renderBriefingHtml({
      tasks: [blogReview({ articleTitle: '<script>alert("x")</script>' })],
      incidents: [],
      dateLabel: "lunes 16",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("las incidencias informan sin pedir que se relance nada a mano", () => {
    const html = renderBriefingHtml({
      tasks: [],
      incidents: [
        { id: "no-takes-10", kind: "no_takes", title: "El artículo de hoy se publicó sin tomas de LinkedIn", articleTitle: "Mi post" },
        { id: "no-article", kind: "no_article", title: "Hoy tocaba artículo y no se generó ninguno", articleTitle: null },
      ],
      dateLabel: "jueves 19",
    });
    expect(html).toContain("se publicó sin tomas de LinkedIn");
    expect(html).toContain("Hoy tocaba artículo");
    expect(html).not.toMatch(/force=1|a mano|Revisa los logs/);
  });

  it("las tareas manuales antiguas ya no se pintan", () => {
    for (const kind of ["comment_personal", "reshare_company", "first_comment", "not_published"]) {
      expect(renderTaskHtml({ kind, title: "x" })).toBe("");
    }
  });
});
