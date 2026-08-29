import { describe, expect, it } from "vitest";
import { renderBriefingHtml } from "./dailyBriefing";

// review_own desapareció del calendario nuevo: el briefing sale a las 08:50,
// cuando la publicación del día ya se ha hecho, así que no hay nada que
// revisar "antes". La cobertura de escapado de HTML se prueba abajo con
// reshare_company, que también pasa texto arbitrario por copyBox().
describe("renderBriefingHtml", () => {
  it("muestra el título y el resumen del día", () => {
    const html = renderBriefingHtml({
      tasks: [],
      incidents: [],
      dateLabel: "lunes 27",
    });
    expect(html).toContain("lunes 27");
  });

  it("escapa el HTML que venga en la sugerencia de una acción cruzada", () => {
    const html = renderBriefingHtml({
      tasks: [
        {
          id: "reshare-1",
          kind: "reshare_company",
          when: "after",
          time: "10:00",
          channel: "empresa",
          title: "Recomparte el post desde la página de Room714",
          articleTitle: "Mi post",
          suggestion: '<script>alert("x")</script>',
          articleUrl: "https://www.room714.com/es/blog/mi-post",
          linkUrl: "https://www.room714.com/api/go/variant/1",
        },
      ],
      incidents: [],
      dateLabel: "lunes 27",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("avisa cuando una acción cruzada no tiene sugerencia", () => {
    const html = renderBriefingHtml({
      tasks: [
        {
          id: "reshare-1",
          kind: "reshare_company",
          when: "after",
          time: "10:00",
          channel: "empresa",
          title: "Recomparte el post desde la página de Room714",
          articleTitle: "Mi post",
          suggestion: null,
          articleUrl: "https://www.room714.com/es/blog/mi-post",
          linkUrl: "https://www.room714.com/api/go/variant/1",
        },
      ],
      incidents: [],
      dateLabel: "lunes 27",
    });
    expect(html).toContain("Sin sugerencia generada");
    expect(html).toContain("https://www.room714.com/api/go/variant/1");
  });

  it("explica el cambio de identidad al recompartir, que es el paso que se olvida", () => {
    const html = renderBriefingHtml({
      tasks: [
        {
          id: "reshare-1",
          kind: "reshare_company",
          when: "after",
          time: "10:00",
          channel: "empresa",
          title: "Recomparte el post desde la página de Room714",
          articleTitle: "Mi post",
          suggestion: "Línea corporativa sugerida",
          articleUrl: "https://www.room714.com/es/blog/mi-post",
          linkUrl: "https://www.room714.com/api/go/variant/1",
        },
      ],
      incidents: [],
      dateLabel: "lunes 27",
    });
    expect(html).toContain("cambia la identidad de tu nombre a Room 714");
    expect(html).toContain("Compartir con tus comentarios");
    expect(html).toContain("Texto sugerido para la recompartición");
  });

  it("avisa de que hay que comentar desde el perfil, no como la página", () => {
    const html = renderBriefingHtml({
      tasks: [
        {
          id: "comment-1",
          kind: "comment_personal",
          when: "after",
          time: "10:00",
          channel: "personal",
          title: "Comenta desde tu perfil en el post de Room714",
          articleTitle: "Mi post",
          suggestion: "Un matiz con un dato",
          articleUrl: "https://www.room714.com/es/blog/mi-post",
          linkUrl: "https://www.room714.com/api/go/variant/1",
        },
      ],
      incidents: [],
      dateLabel: "martes 28",
    });
    expect(html).toContain("desde tu perfil personal");
    expect(html).toContain("Comentario sugerido");
  });

  it("etiqueta el enlace del primer comentario para no confundirlo con un texto sugerido", () => {
    const html = renderBriefingHtml({
      tasks: [
        {
          id: "first-comment-1",
          kind: "first_comment",
          when: "after",
          time: "10:00",
          channel: "personal",
          title: "Publica el enlace al artículo como primer comentario",
          articleTitle: "Mi post",
          articleUrl: "https://www.room714.com/es/blog/mi-post",
          linkUrl: "https://www.room714.com/api/go/variant/1",
        },
      ],
      incidents: [],
      dateLabel: "lunes 27",
    });
    expect(html).toContain("Enlace del artículo");
    expect(html).toContain("primer comentario");
  });

  it("lista las incidencias de ayer", () => {
    const html = renderBriefingHtml({
      tasks: [],
      incidents: [
        {
          id: "not-published-5",
          kind: "not_published",
          when: "before",
          time: "10:00",
          channel: null,
          title: "La derivación 2 de ayer no llegó a publicarse",
          articleTitle: "Mi post",
        },
      ],
      dateLabel: "martes 28",
    });
    expect(html).toContain("no llegó a publicarse");
  });

  it("avisa cuando el artículo de hoy se quedó sin tomas de LinkedIn", () => {
    const html = renderBriefingHtml({
      tasks: [],
      incidents: [
        {
          id: "no-takes-10",
          kind: "no_takes",
          when: "before",
          time: "07:30",
          channel: null,
          title: "El artículo de hoy se publicó sin tomas de LinkedIn",
          articleTitle: "Mi post",
        },
      ],
      dateLabel: "lunes 27",
    });
    expect(html).toContain("se publicó sin tomas de LinkedIn");
    expect(html).toContain("Mi post");
  });
});
