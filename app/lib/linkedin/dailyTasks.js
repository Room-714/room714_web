import { formatMadridTime } from "@/app/lib/time/madrid";

// Construye el briefing del día a partir de datos ya consultados. Función pura
// para poder probarla sin base de datos.
//
// Desde noviembre de 2026 todo se publica solo (app/lib/linkedin/autopost.js),
// así que aquí ya no hay tareas manuales de LinkedIn (comentar desde el perfil,
// recompartir, primer comentario): solo el aviso del artículo de hoy y las
// incidencias, que informan sin pedir nada.
export function buildDailyTasks({
  blogPost = null,
  siteUrl,
  expectsArticle = false,
}) {
  const tasks = [];

  if (blogPost) {
    const translationEs = blogPost.translations?.find((t) => t.lang === "es");
    if (translationEs) {
      // "after" y no "before": el briefing sale a las 08:50, cuando el
      // artículo lleva ya 80 minutos publicado (07:30) y sus tomas de
      // LinkedIn 20 minutos escritas (08:30). Invitar a revisarlo "antes"
      // llega tarde y además contradice al correo de borrador listo, que ya
      // avisó de que la ventana de edición con efecto en LinkedIn cerró a
      // las 08:30.
      tasks.push({
        id: `blog-${blogPost.id}`,
        kind: "blog_review",
        when: "after",
        time: formatMadridTime(blogPost.date),
        channel: null,
        title: "El artículo de hoy ya está publicado",
        articleTitle: translationEs.title,
        articleUrl: `${siteUrl}/es/blog/${translationEs.slug}`,
        adminUrl: `${siteUrl}/admin?postId=${blogPost.id}`,
      });
    }
  }

  const incidents = [];

  // El artículo salió pero el cron de las 08:30 no llegó a escribir sus tomas.
  // Sin esto, un fallo de generación es indistinguible de un día sin nada que
  // hacer, y el hueco de la semana se descubre el viernes.
  //
  // Solo los AUTO llevan tomas: son los que recoge el cron de las 08:30. Un
  // artículo manual no las tiene ni debe tenerlas, y sin esta condición
  // dispararía la incidencia cada vez que se publica algo a mano.
  if (
    blogPost &&
    blogPost.source === "AUTO" &&
    (blogPost.linkedinVariants?.length ?? 0) === 0
  ) {
    incidents.push({
      id: `no-takes-${blogPost.id}`,
      kind: "no_takes",
      when: "before",
      time: formatMadridTime(blogPost.date),
      channel: null,
      title: "El artículo de hoy se publicó sin tomas de LinkedIn",
      articleTitle:
        blogPost.translations?.find((t) => t.lang === "es")?.title ??
        `Post ${blogPost.id}`,
      adminUrl: `${siteUrl}/admin?postId=${blogPost.id}`,
    });
  }

  // Hoy tocaba artículo y no hay ninguno: la generación de las 06:00 falló y
  // los crones de Vercel no reintentan. Sin esta incidencia el correo llega con
  // aspecto de día normal —las tareas de prospección siempre generan algo— y el
  // hueco de la semana se descubre cuando no llegan las publicaciones.
  if (expectsArticle && !blogPost) {
    incidents.push({
      id: "no-article",
      kind: "no_article",
      when: "before",
      time: "06:00",
      channel: null,
      title: "Hoy tocaba artículo y no se generó ninguno",
      articleTitle: null,
    });
  }

  const WHEN_ORDER = { before: 0, after: 1 };
  tasks.sort(
    (a, b) =>
      a.time.localeCompare(b.time) || WHEN_ORDER[a.when] - WHEN_ORDER[b.when],
  );

  return { tasks, incidents };
}
