import { Resend } from "resend";
import { buildLinkedInVariantsSection } from "@/app/lib/notifications/linkedinManual";

export async function sendDraftReadyEmail({
  post,
  translationEs,
  category,
  linkedinVariants = [],
  postUrl,
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.DRAFT_REVIEW_EMAIL || "joseantonio.cesfranjo@room714.com";

  if (!apiKey) {
    console.warn("RESEND_API_KEY no configurada, saltando email");
    return { success: false, skipped: true };
  }

  const resend = new Resend(apiKey);
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.room714.com";
  const adminUrl = `${baseUrl}/admin?postId=${post.id}`;
  const resolvedPostUrl =
    postUrl || `${baseUrl}/es/blog/${translationEs.slug}`;

  const linkedinSection = buildLinkedInVariantsSection({
    variants: linkedinVariants,
    postUrl: resolvedPostUrl,
  });

  try {
    const { error } = await resend.emails.send({
      from: "Room 714 <onboarding@resend.dev>",
      to: [to],
      subject: `Post de hoy listo: ${translationEs.title}`,
      html: `
<div style="font-family: sans-serif; color: #333; max-width: 640px;">
  <h2 style="border-bottom: 1px solid #eee; padding-bottom: 10px;">Post generado y programado</h2>
  <p>Se ha generado el post de hoy. <strong>Se publicará automáticamente a las 10:00 en la web</strong>, salvo que lo despubliques o lo borres antes. <strong>En LinkedIn se publica a mano</strong> (ver más abajo) mientras la app está en revisión.</p>
  <p><strong>Categoría:</strong> ${category}</p>
  <p><strong>Título:</strong> ${translationEs.title}</p>
  <p><strong>Tags:</strong> ${translationEs.tags.join(", ")}</p>
  <p style="margin-top: 20px;">
    <a href="${adminUrl}" style="background:#000;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
      Revisar / editar / rechazar
    </a>
  </p>
  <p style="margin-top: 30px; font-size: 13px; color: #666;">
    Si no haces nada en las próximas 3h: el post se publica tal cual.<br>
    Si quieres editarlo: entra en el admin, modifica lo que necesites y guarda (sigue marcado como publicado).<br>
    Si quieres rechazarlo: despublícalo o bórralo desde el admin antes de las 10:00.
  </p>
  ${linkedinSection}
</div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error };
    }
    return { success: true };
  } catch (error) {
    console.error("draftReady email error:", error);
    return { success: false, error: error.message };
  }
}
