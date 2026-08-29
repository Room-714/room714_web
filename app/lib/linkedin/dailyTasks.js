import { slotFor } from "@/app/lib/time/linkedinSchedule";
import { formatMadridTime } from "@/app/lib/time/madrid";

// Construye las tareas manuales del día a partir de datos ya consultados.
// Función pura a propósito: es lo que permite probar las cinco tomas de la
// semana sin base de datos.
//
// Devuelve dos listas separadas porque son cosas distintas: `tasks` es lo que
// hay que hacer hoy, `incidents` es lo que ha fallado —ayer o hoy— y solo se
// informa, no pide ninguna acción con hora.
export function buildDailyTasks({
  todayVariants = [],
  yesterdayUnsent = [],
  blogPost = null,
  siteUrl,
  firstCommentAutomated = false,
}) {
  const tasks = [];

  for (const variant of todayVariants) {
    const translationEs = variant.post?.translations?.find(
      (t) => t.lang === "es",
    );
    if (!translationEs) continue;

    const articleUrl = `${siteUrl}/es/blog/${translationEs.slug}`;
    const linkUrl = `${siteUrl}/api/go/variant/${variant.id}`;
    const time = formatMadridTime(variant.scheduledFor);
    const slot = slotFor({
      postPublishDate: variant.post.date,
      variant: variant.variant,
    });

    if (slot.canal === "personal") {
      if (!firstCommentAutomated) {
        tasks.push({
          id: `first-comment-${variant.id}`,
          kind: "first_comment",
          when: "after",
          time,
          channel: "personal",
          title: "Publica el enlace al artículo como primer comentario",
          articleTitle: translationEs.title,
          articleUrl,
          linkUrl,
        });
      }
    }

    if (slot.cross === "reshare_company") {
      tasks.push({
        id: `reshare-${variant.id}`,
        kind: "reshare_company",
        when: "after",
        time,
        channel: "empresa",
        title: "Recomparte el post desde la página de Room714",
        articleTitle: translationEs.title,
        suggestion: variant.crossNote || null,
        articleUrl,
        linkUrl,
      });
    }

    if (slot.cross === "comment_personal") {
      tasks.push({
        id: `comment-${variant.id}`,
        kind: "comment_personal",
        when: "after",
        time,
        channel: "personal",
        title: "Comenta desde tu perfil en el post de Room714",
        articleTitle: translationEs.title,
        suggestion: variant.crossNote || null,
        articleUrl,
        linkUrl,
      });
    }
  }

  if (blogPost) {
    const translationEs = blogPost.translations?.find((t) => t.lang === "es");
    if (translationEs) {
      tasks.push({
        id: `blog-${blogPost.id}`,
        kind: "blog_review",
        when: "before",
        time: formatMadridTime(blogPost.date),
        channel: null,
        title: "Artículo nuevo hoy en la web",
        articleTitle: translationEs.title,
        articleUrl: `${siteUrl}/es/blog/${translationEs.slug}`,
        adminUrl: `${siteUrl}/admin?postId=${blogPost.id}`,
      });
    }
  }

  // Ayer quedó algo sin publicar. El motivo no se persiste (el cron de
  // publicación solo lo escribe en consola), así que informamos del hecho.
  const incidents = yesterdayUnsent.map((variant) => {
    const translationEs = variant.post?.translations?.find(
      (t) => t.lang === "es",
    );
    return {
      id: `not-published-${variant.id}`,
      kind: "not_published",
      when: "before",
      time: formatMadridTime(variant.scheduledFor),
      channel: null,
      title: `La derivación ${variant.variant} de ayer no llegó a publicarse`,
      articleTitle: translationEs?.title || `Post ${variant.post?.id ?? "?"}`,
    };
  });

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

  const WHEN_ORDER = { before: 0, after: 1 };
  tasks.sort(
    (a, b) =>
      a.time.localeCompare(b.time) || WHEN_ORDER[a.when] - WHEN_ORDER[b.when],
  );

  return { tasks, incidents };
}
