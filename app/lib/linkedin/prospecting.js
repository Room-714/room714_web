import {
  BUYER_PROFILE,
  REFERENCE_PROFILE,
  TASKS_PER_KIND,
  activityFeedUrl,
  contentSearchUrl,
} from "@/app/data/ProspectingProfile";

// Un hueco para cada público. El comprador puede comprar; la referencia da
// alcance. Son estrategias distintas y avanzan en paralelo, así que no compiten
// por el mismo hueco: si no hay compradores en cola, ese hueco se rellena
// buscando compradores, no doblando referencias.
const KIND_CONFIG = {
  buyer: {
    profile: BUYER_PROFILE,
    label: "cliente potencial",
    labelPlural: "clientes potenciales",
    // A un comprador se le demuestra criterio, no se le halaga.
    commentHint:
      "Es un cliente potencial: demuestra criterio con un dato o un caso propio. Nada de vender ni de mencionar Room714.",
  },
  reference: {
    profile: REFERENCE_PROFILE,
    label: "referencia",
    labelPlural: "referencias que publiquen a menudo",
    // A una referencia se le aporta ante su audiencia: ese es el alcance.
    commentHint:
      "Es una referencia con audiencia: el comentario tiene que aportar a SUS lectores. Si aporta, su gente te lee.",
  },
};

// Construye las tareas de prospección del día a partir de datos ya
// consultados. Pura a propósito, como buildDailyTasks: sin BD ni red.
//
// Reglas:
// - Rotación por antigüedad: primero los prospectos ACTIVE nunca comentados
//   (lastEngagedAt nulo), luego los que llevan más tiempo sin atención.
//   La consulta de la ruta ya ordena así; aquí solo cortamos a maxTasks.
// - Si la lista no llena el cupo, se rellena con una tarea de descubrimiento:
//   una búsqueda de contenido reciente en LinkedIn con una keyword del ICP
//   (rotada por día del mes para no repetir búsqueda dos días seguidos).
// - `latestPost` (el artículo más reciente del blog) da el ángulo: comentar
//   con la mirada del contenido que estamos publicando esa semana.
// Orden de la cola, en un solo sitio y probado. Primero quien nunca ha
// recibido atención (`lastTouchedAt` nulo), luego quien lleva más tiempo sin
// ella. Desempate por id para que el orden sea estable entre ejecuciones.
//
// Ojo con el campo: es `lastTouchedAt`, no `lastEngagedAt`. Saltar a alguien
// porque no ha publicado nada cuenta como atención, y por eso lo saca de la
// cabeza de la cola. Con `lastEngagedAt` volvería a salir mañana, y pasado, y
// al otro.
export function orderProspectQueue(prospects = []) {
  return [...prospects].sort((a, b) => {
    const ta = a.lastTouchedAt ? new Date(a.lastTouchedAt).getTime() : null;
    const tb = b.lastTouchedAt ? new Date(b.lastTouchedAt).getTime() : null;
    if (ta === null && tb === null) return a.id - b.id;
    if (ta === null) return -1;
    if (tb === null) return 1;
    return ta - tb || a.id - b.id;
  });
}

export function buildProspectingTasks({
  prospects = [],
  latestPost = null,
  siteUrl,
  dayOfMonth = 1,
  tasksPerKind = TASKS_PER_KIND,
}) {
  const angle = latestPost
    ? `Ángulo de la semana: "${latestPost.title}". Si su post toca el tema, enlaza tu comentario con esa idea (sin citar el blog: aporta el argumento, no el enlace).`
    : "Aporta un dato o una experiencia propia; nada de elogios genéricos.";

  const tasks = [];

  for (const [kind, config] of Object.entries(KIND_CONFIG)) {
    const cupo = tasksPerKind[kind] ?? 0;
    if (cupo <= 0) continue;

    // Los de kind desconocido o antiguo cuentan como compradores: es el valor
    // por defecto de la columna.
    const delTipo = prospects.filter(
      (p) => (p.kind || "buyer") === kind,
    );
    const enCola = orderProspectQueue(delTipo).slice(0, cupo);

    for (const prospect of enCola) {
      tasks.push({
        id: `prospect-${prospect.id}`,
        kind: "prospect_comment",
        prospectKind: kind,
        when: "after",
        time: "12:00",
        channel: "personal",
        title: `Comenta un post de ${prospect.name}`,
        prospectName: prospect.name,
        prospectCompany: prospect.company || null,
        prospectRole: prospect.role || null,
        prospectInterest: prospect.interest || null,
        neverEngaged: !prospect.lastEngagedAt,
        angle,
        commentHint: config.commentHint,
        activityUrl: activityFeedUrl(prospect.linkedinUrl),
        draftUrl: `${siteUrl}/admin/prospects?prospectId=${prospect.id}`,
      });
    }

    // Si el cupo de este público no se llena, se busca gente de ESE público:
    // un hueco de comprador vacío no se rellena con una referencia.
    const faltan = cupo - enCola.length;
    if (faltan <= 0) continue;

    const keywords = config.profile.keywords;
    // Se desplaza la rotación por público para que los dos no busquen por el
    // mismo tema el mismo día.
    const offset = kind === "reference" ? 1 : 0;
    const keyword = keywords[(dayOfMonth + offset) % keywords.length];

    tasks.push({
      id: `prospect-discover-${kind}-${dayOfMonth}`,
      kind: "prospect_discover",
      prospectKind: kind,
      when: "after",
      time: "12:00",
      channel: "personal",
      title: `Busca ${faltan === cupo ? config.labelPlural : `una ${config.label} más`} que estén hablando de «${keyword}»`,
      keyword,
      angle,
      commentHint: config.commentHint,
      searchUrl: contentSearchUrl(keyword),
      adminUrl: `${siteUrl}/admin/prospects?kind=${kind}`,
      profileHint: `Buscamos: ${config.profile.roles.slice(0, 3).join(", ")}${
        config.profile.sectors
          ? ` en ${config.profile.sectors.slice(0, 3).join(", ")}…`
          : " que publiquen con asiduidad"
      }`,
    });
  }

  return tasks;
}
