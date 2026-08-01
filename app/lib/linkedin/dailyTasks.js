import { slotFor } from "@/app/lib/time/linkedinSchedule";
import { formatMadridTime } from "@/app/lib/time/madrid";

const VOICE_JOSE =
  'Voz José: primera persona, opinión con riesgo, referencia a lo que ves en tus propios proyectos. Sin el "nosotros" corporativo ni tono de nota de prensa.';

// Construye las tareas manuales del día a partir de datos ya consultados.
// Función pura a propósito: es lo que permite probar los seis slots de la
// semana sin base de datos.
//
// Devuelve dos listas separadas porque son cosas distintas: `tasks` es lo que
// hay que hacer hoy, `incidents` es lo que no salió ayer y solo se informa.
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
      tasks.push({
        id: `review-${variant.id}`,
        kind: "review_own",
        when: "before",
        time,
        channel: "personal",
        title: `Revisa el texto que sale a tu nombre a las ${time}`,
        articleTitle: translationEs.title,
        text: variant.text,
        hashtags: variant.hashtags || [],
        voiceHint: VOICE_JOSE,
        articleUrl,
      });

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

  return { tasks, incidents: [] };
}
