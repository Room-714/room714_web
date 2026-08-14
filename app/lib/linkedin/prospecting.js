import {
  IDEAL_CUSTOMER_PROFILE,
  PROSPECT_TASKS_PER_DAY,
  activityFeedUrl,
  contentSearchUrl,
} from "@/app/data/ProspectingProfile";

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
export function buildProspectingTasks({
  prospects = [],
  latestPost = null,
  siteUrl,
  dayOfMonth = 1,
  maxTasks = PROSPECT_TASKS_PER_DAY,
}) {
  const tasks = [];

  const angle = latestPost
    ? `Ángulo de la semana: "${latestPost.title}". Si su post toca el tema, enlaza tu comentario con esa idea (sin citar el blog: aporta el argumento, no el enlace).`
    : "Aporta un dato o una experiencia propia; nada de elogios genéricos.";

  for (const prospect of prospects.slice(0, maxTasks)) {
    tasks.push({
      id: `prospect-${prospect.id}`,
      kind: "prospect_comment",
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
      activityUrl: activityFeedUrl(prospect.linkedinUrl),
      draftUrl: `${siteUrl}/admin/prospects?prospectId=${prospect.id}`,
    });
  }

  // Relleno con descubrimiento si faltan prospectos en rotación.
  const missing = maxTasks - tasks.length;
  if (missing > 0) {
    const keywords = IDEAL_CUSTOMER_PROFILE.keywords;
    const keyword = keywords[dayOfMonth % keywords.length];
    tasks.push({
      id: `prospect-discover-${dayOfMonth}`,
      kind: "prospect_discover",
      when: "after",
      time: "12:00",
      channel: "personal",
      title: `Busca ${missing === maxTasks ? "clientes potenciales" : "un cliente potencial más"} que estén hablando de «${keyword}»`,
      keyword,
      angle,
      searchUrl: contentSearchUrl(keyword),
      adminUrl: `${siteUrl}/admin/prospects`,
      profileHint: `Buscamos: ${IDEAL_CUSTOMER_PROFILE.roles.slice(0, 3).join(", ")}… en ${IDEAL_CUSTOMER_PROFILE.sectors.slice(0, 3).join(", ")}…`,
    });
  }

  return tasks;
}
