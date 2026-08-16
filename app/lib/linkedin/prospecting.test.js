import { describe, expect, it } from "vitest";
import { buildProspectingTasks, orderProspectQueue } from "./prospecting";

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

// ─── La cola no se puede bloquear ───────────────────────────────────────────
// El fallo que esto previene: si la cola ordenara por `lastEngagedAt`, un
// prospecto que nunca publica nada jamás recibiría comentario, seguiría siendo
// el más antiguo y saldría asignado todos los días para siempre.
describe("orderProspectQueue", () => {
  const AYER = new Date("2026-08-15T09:00:00Z");
  const HOY = new Date("2026-08-16T09:00:00Z");
  const SEMANA_PASADA = new Date("2026-08-09T09:00:00Z");

  it("pone primero a quien nunca ha sido atendido", () => {
    const orden = orderProspectQueue([
      prospect(1, { lastTouchedAt: AYER }),
      prospect(2, { lastTouchedAt: null }),
      prospect(3, { lastTouchedAt: SEMANA_PASADA }),
    ]);
    expect(orden.map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it("un prospecto saltado hoy no vuelve a salir mañana si hay otros esperando", () => {
    // Ayer salió el 1 y José lo saltó: no publicó nada, así que no hay
    // comentario registrado, pero sí quedó atendido.
    const saltadoHoy = prospect(1, {
      lastEngagedAt: null,
      lastTouchedAt: HOY,
      skipCount: 1,
    });
    const nuncaAtendido = prospect(2, { lastTouchedAt: null });
    const atendidoHaceUnaSemana = prospect(3, { lastTouchedAt: SEMANA_PASADA });

    const tasks = buildProspectingTasks({
      prospects: [saltadoHoy, nuncaAtendido, atendidoHaceUnaSemana],
      siteUrl: SITE,
    });

    const asignados = tasks
      .filter((t) => t.kind === "prospect_comment")
      .map((t) => t.prospectName);

    expect(asignados).toEqual(["Prospecto 2", "Prospecto 3"]);
    expect(asignados).not.toContain("Prospecto 1");
  });

  it("ordenar por lastEngagedAt habría dejado al saltado en cabeza", () => {
    // Documenta el bug antiguo: los dos siguen con lastEngagedAt nulo, así que
    // ese campo no distingue entre "nunca comentado" y "atendido hoy".
    const saltadoHoy = prospect(1, { lastEngagedAt: null, lastTouchedAt: HOY });
    const nuncaAtendido = prospect(2, { lastEngagedAt: null, lastTouchedAt: null });
    expect(saltadoHoy.lastEngagedAt).toBe(nuncaAtendido.lastEngagedAt);
    expect(orderProspectQueue([saltadoHoy, nuncaAtendido])[0].id).toBe(2);
  });

  it("desempata por id para que el orden sea estable entre ejecuciones", () => {
    const orden = orderProspectQueue([
      prospect(7, { lastTouchedAt: AYER }),
      prospect(3, { lastTouchedAt: AYER }),
      prospect(5, { lastTouchedAt: null }),
      prospect(4, { lastTouchedAt: null }),
    ]);
    expect(orden.map((p) => p.id)).toEqual([4, 5, 3, 7]);
  });

  it("no muta el array que recibe", () => {
    const entrada = [prospect(2, { lastTouchedAt: AYER }), prospect(1)];
    orderProspectQueue(entrada);
    expect(entrada.map((p) => p.id)).toEqual([2, 1]);
  });

  it("acepta fechas serializadas como texto", () => {
    const orden = orderProspectQueue([
      prospect(1, { lastTouchedAt: "2026-08-16T09:00:00.000Z" }),
      prospect(2, { lastTouchedAt: "2026-08-09T09:00:00.000Z" }),
    ]);
    expect(orden.map((p) => p.id)).toEqual([2, 1]);
  });
});
