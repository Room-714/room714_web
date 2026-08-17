import { describe, expect, it } from "vitest";
import { buildProspectingTasks, orderProspectQueue } from "./prospecting";

const SITE = "https://www.room714.com";

// Sin `kind` a propósito en el fixture: así se comprueba que lo ausente cuenta
// como comprador, que es el valor por defecto de la columna.
const prospect = (id, overrides = {}) => ({
  id,
  name: `Prospecto ${id}`,
  company: "Empresa SA",
  role: "Director General",
  linkedinUrl: `https://www.linkedin.com/in/prospecto-${id}`,
  interest: "Rediseño UX/UI",
  lastEngagedAt: null,
  ...overrides,
});

const soloCompradores = { buyer: 2, reference: 0 };

describe("buildProspectingTasks", () => {
  it("da un hueco a cada público: un comprador y una referencia", () => {
    const tasks = buildProspectingTasks({
      prospects: [
        prospect(1),
        prospect(2),
        prospect(3, { kind: "reference", name: "Referente" }),
      ],
      siteUrl: SITE,
    });
    const comentarios = tasks.filter((t) => t.kind === "prospect_comment");
    expect(comentarios).toHaveLength(2);
    expect(comentarios.map((t) => t.prospectKind)).toEqual([
      "buyer",
      "reference",
    ]);
    // Solo UN comprador, aunque hubiera tres en cola: el otro hueco es de la
    // referencia y no se lo puede quedar.
    expect(comentarios[0].prospectName).toBe("Prospecto 1");
    expect(comentarios[1].prospectName).toBe("Referente");
  });

  it("el hueco de un público vacío se rellena buscando de ESE público", () => {
    const tasks = buildProspectingTasks({
      prospects: [prospect(1)], // solo comprador
      siteUrl: SITE,
      dayOfMonth: 14,
    });
    expect(tasks).toHaveLength(2);
    expect(tasks[0].kind).toBe("prospect_comment");
    expect(tasks[0].prospectKind).toBe("buyer");
    // El hueco libre es de referencia, así que busca referencias, no un
    // segundo comprador.
    expect(tasks[1].kind).toBe("prospect_discover");
    expect(tasks[1].prospectKind).toBe("reference");
    expect(tasks[1].searchUrl).toContain("linkedin.com/search/results/content");
    expect(tasks[1].adminUrl).toBe(`${SITE}/admin/prospects?kind=reference`);
  });

  it("con lista vacía busca de los dos públicos, con temas distintos", () => {
    const tasks = buildProspectingTasks({
      prospects: [],
      siteUrl: SITE,
      dayOfMonth: 3,
    });
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => t.kind === "prospect_discover")).toBe(true);
    expect(tasks.map((t) => t.prospectKind)).toEqual(["buyer", "reference"]);
    // Dos búsquedas el mismo día no deben repetir tema.
    expect(tasks[0].keyword).not.toBe(tasks[1].keyword);
  });

  it("cada público lleva su propia instrucción de tono", () => {
    const tasks = buildProspectingTasks({ prospects: [], siteUrl: SITE });
    const comprador = tasks.find((t) => t.prospectKind === "buyer");
    const referencia = tasks.find((t) => t.prospectKind === "reference");
    expect(comprador.commentHint).toContain("cliente potencial");
    expect(referencia.commentHint).toContain("audiencia");
  });

  it("usa el feed de posts si el prospecto es una página de empresa", () => {
    const tasks = buildProspectingTasks({
      prospects: [
        prospect(1, { linkedinUrl: "https://www.linkedin.com/company/acme/" }),
      ],
      siteUrl: SITE,
      tasksPerKind: { buyer: 1, reference: 0 },
    });
    expect(tasks[0].activityUrl).toBe(
      "https://www.linkedin.com/company/acme/posts/",
    );
    expect(tasks[0].draftUrl).toBe(`${SITE}/admin/prospects?prospectId=1`);
  });

  it("el ángulo menciona el artículo más reciente si existe", () => {
    const tasks = buildProspectingTasks({
      prospects: [prospect(1)],
      latestPost: { title: "Diseñar con IA sin perder el criterio" },
      siteUrl: SITE,
      tasksPerKind: { buyer: 1, reference: 0 },
    });
    expect(tasks[0].angle).toContain("Diseñar con IA sin perder el criterio");
  });

  it("dos búsquedas de días consecutivos usan keywords distintas", () => {
    const [a] = buildProspectingTasks({
      prospects: [],
      siteUrl: SITE,
      dayOfMonth: 3,
      tasksPerKind: { buyer: 1, reference: 0 },
    });
    const [b] = buildProspectingTasks({
      prospects: [],
      siteUrl: SITE,
      dayOfMonth: 4,
      tasksPerKind: { buyer: 1, reference: 0 },
    });
    expect(a.keyword).not.toBe(b.keyword);
  });

  it("un cupo a cero no genera nada de ese público", () => {
    const tasks = buildProspectingTasks({
      prospects: [],
      siteUrl: SITE,
      tasksPerKind: { buyer: 1, reference: 0 },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].prospectKind).toBe("buyer");
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
      tasksPerKind: soloCompradores,
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
    const nuncaAtendido = prospect(2, {
      lastEngagedAt: null,
      lastTouchedAt: null,
    });
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

  it("las colas de los dos públicos son independientes", () => {
    // Un comprador atendido hoy no debe empujar a la referencia fuera de su
    // hueco, ni al contrario.
    const tasks = buildProspectingTasks({
      prospects: [
        prospect(1, { lastTouchedAt: HOY }),
        prospect(2, { kind: "reference", lastTouchedAt: null }),
      ],
      siteUrl: SITE,
    });
    const comentarios = tasks.filter((t) => t.kind === "prospect_comment");
    expect(comentarios.map((t) => t.prospectKind)).toEqual([
      "buyer",
      "reference",
    ]);
  });
});
