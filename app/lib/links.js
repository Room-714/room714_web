// Los enlaces que salen del sitio. En un solo sitio porque se usan desde el
// footer, la firma del autor y el JSON-LD, y tienen que coincidir: el
// `sameAs` de schema.org y el href del footer apuntaban a dos URLs distintas
// de la misma empresa (/company/room714 y /company/room-714).

export const LINKEDIN_COMPANY = "https://www.linkedin.com/company/room-714/";
export const LINKEDIN_FOUNDER = "https://www.linkedin.com/in/josecesfranjo/";

/**
 * Añade UTMs a un enlace saliente para poder ver en LinkedIn qué página de la
 * web manda el tráfico. `content` distingue el sitio concreto dentro de la
 * página (footer, firma del artículo, CTA...).
 *
 * Conserva los parámetros que ya trajera la URL y no duplica los utm_ que ya
 * estuvieran puestos.
 */
export function withUtm(url, { campaign, content } = {}) {
  const salida = new URL(url);
  const params = salida.searchParams;

  params.set("utm_source", "room714.com");
  params.set("utm_medium", "referral");
  if (campaign) params.set("utm_campaign", campaign);
  if (content) params.set("utm_content", content);

  return salida.toString();
}
