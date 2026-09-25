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
    // Posicionamiento: seo/posicionamiento.md. Si cambia allí, cambia aquí.
    description:
      lang === "es"
        ? "Empresa especialista en producto digital (ideación, diseño y desarrollo de software) con foco en la experiencia de cliente. Hacemos el producto que usan tus clientes y el que usa tu equipo."
        : "A digital product company specialising in ideation, design and software development, with a focus on customer experience. We build the product your customers use and the one your team uses.",
    knowsAbout: KNOWS_ABOUT[lang] ?? KNOWS_ABOUT.en,
  };
}

const KNOWS_ABOUT = {
  es: [
    "Producto digital",
    "Ideación y discovery de producto digital",
    "Diseño de producto digital",
    "Experiencia de cliente",
    "Diseño UX",
    "Desarrollo de software",
    "Modernización de software interno",
    "IA aplicada al producto digital",
  ],
  en: [
    "Digital product",
    "Digital product ideation and discovery",
    "Digital product design",
    "Customer experience",
    "UX design",
    "Software development",
    "Internal software modernisation",
    "AI applied to digital products",
  ],
};

// Nombre y tipo de servicio de cada página de servicio (las claves de
// ROUTES). Van aquí y no en el diccionario porque no se pintan: solo los lee
// el JSON-LD.
const SERVICES = {
  productoClientes: {
    es: "Diseño de producto digital y experiencia de cliente",
    en: "Digital product design and customer experience",
  },
  productoEquipo: {
    es: "Modernización de software interno",
    en: "Internal software modernisation",
  },
  iaProducto: {
    es: "IA aplicada al producto digital, de piloto a producción",
    en: "AI in the digital product, from pilot to production",
  },
  empezarDeCero: {
    es: "Desarrollo de producto digital desde la idea",
    en: "Digital product development from the idea",
  },
};

/**
 * Una página de servicio. El proveedor es la organización, referenciada por
 * @id; la descripción es la misma meta description de la página, para que
 * Google no lea dos versiones del mismo servicio.
 */
export function serviceSchema({ clave, lang, url, description }) {
  const name = SERVICES[clave]?.[lang];
  if (!name) return null;
  return {
    "@type": "Service",
    "@id": `${url}#service`,
    name,
    serviceType: name,
    description,
    url,
    provider: { "@id": ORGANIZATION_ID },
  };
}

/** El fundador, que es quien firma los artículos y atiende el diagnóstico. */
export function founderSchema() {
  return {
    "@type": "Person",
    "@id": FOUNDER_ID,
    name: "José Antonio Ces Franjo",
    jobTitle: "Fundador y CEO",
    url: `${SITE_URL}/es/como-trabajamos`,
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
