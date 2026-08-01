import { prisma } from "@/app/lib/prisma";
import { channelForVariant } from "@/app/lib/time/linkedinSchedule";

export const maxDuration = 30;

const PROFILE_FALLBACK = "https://www.linkedin.com/in/";
const COMPANY_FALLBACK = "https://www.linkedin.com/company/";

// Redirección que se resuelve en el momento del clic. El briefing sale a las
// 08:00, cuando el post todavía no existe en LinkedIn; si para cuando se pulsa
// Make ya ha devuelto la URL vía callback, se cae en el post exacto, y si no,
// en el perfil o la página.
//
// Ruta pública a propósito: se pulsa desde un cliente de correo, sin sesión. No
// expone nada, el destino es una URL pública de LinkedIn.
export async function GET(_request, { params }) {
  const { id } = await params;

  // Solo IDs decimales positivos; Number("") o "0x10" colarían valores raros.
  if (!/^\d+$/.test(id)) {
    return redirectTo(process.env.LINKEDIN_COMPANY_URL || COMPANY_FALLBACK);
  }

  const variant = await prisma.linkedInVariant.findUnique({
    where: { id: Number(id) },
    select: {
      variant: true,
      linkedinPostUrl: true,
      post: { select: { date: true } },
    },
  });

  if (variant?.linkedinPostUrl) {
    return redirectTo(variant.linkedinPostUrl);
  }

  const canal = variant
    ? channelForVariant({
        postPublishDate: variant.post.date,
        variant: variant.variant,
      })
    : "empresa";

  return redirectTo(
    canal === "personal"
      ? process.env.LINKEDIN_PROFILE_URL || PROFILE_FALLBACK
      : process.env.LINKEDIN_COMPANY_URL || COMPANY_FALLBACK,
  );
}

// 302 y sin caché: un cliente de correo que precargue el enlace a las 08:00 no
// debe dejar congelado el redirect al perfil de por vida.
function redirectTo(target) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
