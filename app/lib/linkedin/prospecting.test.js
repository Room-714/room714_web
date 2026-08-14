import { describe, expect, it } from "vitest";
import { buildProspectingTasks } from "./prospecting";

const SITE = "https://www.room714.com";

const prospect = (id, overrides = {}) => ({
  id,
  name: `Prospecto ${id}`,
  company: "Empresa SA",
  role: "CPO",
  linkedinUrl: `https://www.linkedin.com/in/prospecto-${id}`,
  interest: "Rediseño UX/UI",
  lastEngagedAt: null,
  ...overrides,
});

describe("buildProspectingTasks", () => {
  it("genera una tarea de comentario por prospecto, hasta el máximo diario", () => {
    const tasks = buildProspectingTasks({
      prospects: [prospect(1), prospect(2), prospect(3)],
      siteUrl: SITE,
      maxTasks: 2,
    });
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => t.kind === "prospect_comment")).toBe(true);
    expect(tasks[0].activityUrl).toBe(
      "https://www.linkedin.com/in/prospecto-1/recent-activity/all/",
    );
    expect(tasks[0].draftUrl).toBe(`${SITE}/admin/prospects?prospectId=1`);
  });

  it("usa el feed de posts si el prospecto es una página de empresa", () => {
    const tasks = buildProspectingTasks({
      prospects: [
        prospect(1, { linkedinUrl: "https://www.linkedin.com/company/acme/" }),
      ],
      siteUrl: SITE,
      maxTasks: 1,
    });
    expect(tasks[0].activityUrl).toBe(
      "https://www.linkedin.com/company/acme/posts/",
    );
  });

  it("rellena con una tarea de descubrimiento si no hay prospectos suficientes", () => {
    const tasks = buildProspectingTasks({
      prospects: [prospect(1)],
      siteUrl: SITE,
      dayOfMonth: 14,
      maxTasks: 2,
    });
    expect(tasks).toHaveLength(2);
    expect(tasks[1].kind).toBe("prospect_discover");
    expect(tasks[1].searchUrl).toContain("linkedin.com/search/results/content");
  });

  it("con lista vacía devuelve solo descubrimiento", () => {
    const tasks = buildProspectingTasks({
      prospects: [],
      siteUrl: SITE,
      dayOfMonth: 3,
      maxTasks: 2,
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].kind).toBe("prospect_discover");
  });

  it("el ángulo menciona el artículo más reciente si existe", () => {
    const tasks = buildProspectingTasks({
      prospects: [prospect(1)],
      latestPost: { title: "Diseñar con IA sin perder el criterio" },
      siteUrl: SITE,
      maxTasks: 1,
    });
    expect(tasks[0].angle).toContain("Diseñar con IA sin perder el criterio");
  });

  it("dos búsquedas de días consecutivos usan keywords distintas", () => {
    const [a] = buildProspectingTasks({
      prospects: [],
      siteUrl: SITE,
      dayOfMonth: 3,
      maxTasks: 1,
    });
    const [b] = buildProspectingTasks({
      prospects: [],
      siteUrl: SITE,
      dayOfMonth: 4,
      maxTasks: 1,
    });
    expect(a.keyword).not.toBe(b.keyword);
  });
});
