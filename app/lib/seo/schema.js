// Los nodos de JSON-LD del sitio, en un solo sitio y con @id estables, para
// que las páginas se refieran a la misma entidad en lugar de repetir una
// descripción ligeramente distinta cada una.

import { SITE_URL } from "./urls";
import { LINKEDIN_COMPANY, LINKEDIN_FOUNDER } from "../links";

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const FOUNDER_ID = `${SITE_URL}/#jose-antonio-ces-franjo`;

/**
 * La organización. Doble tipo a propósito: Organization es lo que consumen
 * los grafos de conocimiento y ProfessionalService es lo que da señal local
 * (y lo que admite priceRange).
 */
export function organizationSchema(lang) {
  return {
    "@type": ["Organization", "ProfessionalService"],
    "@id": ORGANIZATION_ID,
    name: "Room 714",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/logo.svg`,
    },
    image: `${SITE_URL}/og-image.png`,
    priceRange: "$$$",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Madrid",
      addressCountry: "ES",
    },
    sameAs: [LINKEDIN_COMPANY],
    founder: { "@id": FOUNDER_ID },
    description:
      lang === "es"
        ? "Estudio de producto digital: mejoramos y construimos el producto que usan tus clientes y el que usa tu equipo."
        : "Digital product studio: we improve and build the product your customers use and the one your team uses.",
  };
}

/** El fundador, que es quien firma los artículos y atiende el diagnóstico. */
export function founderSchema() {
  return {
    "@type": "Person",
    "@id": FOUNDER_ID,
    name: "José Antonio Ces Franjo",
    jobTitle: "Fundador y CEO",
    url: `${SITE_URL}/es/about`,
    sameAs: [LINKEDIN_FOUNDER],
    worksFor: { "@id": ORGANIZATION_ID },
  };
}

/**
 * Un artículo del blog. BlogPosting es un subtipo de Article, así que cumple
 * lo que piden los validadores y además dice qué clase de Article es.
 *
 * `dateModified` sale del updatedAt real de la fila, no de la fecha de
 * publicación: repetir la misma fecha en los dos campos le dice a Google que
 * el artículo nunca se ha tocado.
 */
export function articleSchema({
  lang,
  url,
  headline,
  description,
  imageUrl,
  datePublished,
  dateModified,
  articleBody,
}) {
  return {
    "@type": "BlogPosting",
    headline,
    description,
    image: imageUrl,
    datePublished,
    dateModified: dateModified || datePublished,
    author: { "@id": FOUNDER_ID },
    publisher: { "@id": ORGANIZATION_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleBody,
    inLanguage: lang === "es" ? "es-ES" : "en-US",
  };
}

/** items: [{ name, url }] en orden, de la portada a la página actual. */
export function breadcrumbSchema(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Envuelve varios nodos en un @graph con un solo @context. Emitir un script
 * por nodo también vale, pero así la organización se declara una vez y el
 * resto la referencia por @id.
 */
export function jsonLdGraph(...nodes) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.filter(Boolean),
  };
}
