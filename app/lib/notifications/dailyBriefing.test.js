import { describe, expect, it } from "vitest";
import { renderBriefingHtml } from "./dailyBriefing";

const TASK_REVIEW = {
  id: "review-1",
  kind: "review_own",
  when: "before",
  time: "10:00",
  channel: "personal",
  title: "Revisa el texto que sale a tu nombre a las 10:00",
  articleTitle: "Mi post",
  text: "Primera línea\n\nSegunda línea",
  hashtags: ["#IA", "#UX"],
  voiceHint: "Voz José: primera persona.",
  articleUrl: "https://www.room714.com/es/blog/mi-post",
};

describe("renderBriefingHtml", () => {
  it("incluye el texto íntegro, los hashtags y el recordatorio de voz", () => {
    const html = renderBriefingHtml({
      tasks: [TASK_REVIEW],
      incidents: [],
      dateLabel: "lunes 27",
    });
    expect(html).toContain("Primera línea");
    expect(html).toContain("#IA #UX");
    expect(html).toContain("Voz José");
    expect(html).toContain("lunes 27");
  });

  it("escapa el HTML que venga en el texto de la variante", () => {
    const html = renderBriefingHtml({
      tasks: [{ ...TASK_REVIEW, text: '<script>alert("x")</script>' }],
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
});
