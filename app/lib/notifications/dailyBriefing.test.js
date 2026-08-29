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
    expect(html).toContain("0 tareas");
  });

  it("escapa el HTML que venga en la sugerencia de una acción cruzada", () => {
    const html = renderBriefingHtml({
      tasks: [
        {
          id: "reshare-1",
          kind: "reshare_company",
          when: "after",
          time: "08:35",
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
          time: "08:35",
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
          time: "08:35",
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
          time: "07:30",
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
          time: "08:35",
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

  // El correo sale a las 08:50: el artículo lleva rato publicado y sus tomas
  // de LinkedIn ya se generaron a partir de él. El texto tiene que decir eso,
  // no invitar a una revisión "antes de que se publique" que ya no aplica.
  it("blog_review dice que el artículo ya está publicado, no que falta por publicarse", () => {
    const html = renderBriefingHtml({
      tasks: [
        {
          id: "blog-77",
          kind: "blog_review",
          when: "after",
          time: "07:30",
          channel: null,
          title: "El artículo de hoy ya está publicado",
          articleTitle: "Mi post",
          articleUrl: "https://www.room714.com/es/blog/mi-post",
          adminUrl: "https://www.room714.com/admin?postId=77",
        },
      ],
      incidents: [],
      dateLabel: "lunes 27",
    });
    expect(html).toContain("ya está publicado");
    expect(html).toContain("Se publicó a las 07:30");
    expect(html).not.toContain("Se publica solo a las");
  });

  // La prospección del día es una sola tarea: revisar la cola de Apollo. Antes
  // había dos (comentar un post, buscar referencias) que en meses no
  // produjeron ni un solo engagement registrado.
  it("prospect_queue lleva el número de pendientes y el enlace al admin", () => {
    const html = renderBriefingHtml({
      tasks: [
        {
          id: "prospect-queue",
          kind: "prospect_queue",
          when: "after",
          time: "09:00",
          channel: null,
          title: "Revisa la cola de prospectos (5 pendientes)",
          adminUrl: "https://www.room714.com/admin/prospects",
        },
      ],
      incidents: [],
      dateLabel: "lunes 27",
    });
    expect(html).toContain("Revisa la cola de prospectos (5 pendientes)");
    expect(html).toContain("https://www.room714.com/admin/prospects");
  });

  it("lista las incidencias de ayer", () => {
    const html = renderBriefingHtml({
      tasks: [],
      incidents: [
        {
          id: "not-published-5",
          kind: "not_published",
          when: "before",
          time: "07:30",
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

  // El botón "Generar en el admin" no llevaba a ningún sitio: no existe una
  // pantalla de admin que dispare la generación de tomas. La recuperación real
  // es relanzar el cron a mano con ?force=1 (arreglo 4).
  it("la incidencia no_takes indica cómo relanzar el cron a mano, sin botón inexistente", () => {
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
    expect(html).toContain("/api/cron/generate-linkedin?force=1");
    expect(html).not.toContain("Generar en el admin");
  });

  // Sin esta incidencia, un fallo en el cron de las 06:00 es indistinguible
  // de un día sin artículo previsto: las tareas de prospección siempre
  // generan algo, así que el correo llegaría con aspecto de día normal.
  it("avisa cuando no se generó el artículo del día", () => {
    const html = renderBriefingHtml({
      tasks: [],
      incidents: [
        {
          id: "no-article",
          kind: "no_article",
          when: "before",
          time: "06:00",
          channel: null,
          title: "Hoy tocaba artículo y no se generó ninguno",
          articleTitle: null,
        },
      ],
      dateLabel: "lunes 27",
    });
    expect(html).toContain("Hoy tocaba artículo y no se generó ninguno");
    expect(html).toContain("cron de las 06:00");
  });
});
