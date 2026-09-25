// Clusters, páginas de destino y búsquedas del posicionamiento, en código.
//
// Es el reflejo de seo/posicionamiento.md (la fuente de verdad, aprobada el
// 2026-09-25): si cambia allí, cambia aquí. Lo usan el generador de posts
// (prompt y validación) y cualquier cosa que tenga que saber a qué página
// enlaza un post o qué búsquedas no puede perseguir.

import { path } from "../routes.mjs";

/**
 * Los tres clusters más la IA transversal. `page` es la clave de ROUTES de
 * la página a la que enlazan los posts del cluster. `postQueries` son las
 * búsquedas complementarias libres para posts (hipótesis del documento,
 * sin volumen validado todavía).
 */
export const CLUSTERS = {
  C1: {
    name: { es: "Ideación y discovery de producto digital", en: "Digital product ideation and discovery" },
    page: "empezarDeCero",
    postQueries: {
      es: ["validar una idea de producto digital", "discovery de producto digital", "definir el MVP de un producto digital"],
      en: ["validate a digital product idea", "digital product discovery", "how to define an MVP"],
    },
  },
  C2: {
    name: { es: "Diseño de producto y experiencia de cliente", en: "Product design and customer experience" },
    page: "productoClientes",
    postQueries: {
      es: ["mejorar la experiencia de cliente digital", "reducir el abandono en el alta", "diseño del área de cliente", "sistema de diseño multimarca"],
      en: ["improve digital customer experience", "reduce sign-up drop-off", "customer portal design", "multi-brand design system"],
    },
  },
  C3: {
    name: { es: "Desarrollo de software de producto", en: "Product software development" },
    page: "productoEquipo",
    postQueries: {
      es: ["desarrollo de back-office a medida", "migrar un sistema heredado sin parar la operación", "arquitectura de producto digital"],
      en: ["custom back-office development", "legacy system migration", "digital product architecture"],
    },
  },
  IA: {
    name: { es: "IA aplicada al producto (ligada a experiencia de cliente)", en: "AI applied to the product (tied to customer experience)" },
    page: "iaProducto",
    postQueries: {
      es: ["IA en la experiencia de cliente", "modelo canónico de datos para IA"],
      en: ["AI in customer experience", "canonical data model for AI"],
    },
  },
};

/**
 * Frase de respaldo con el enlace a la página del cluster, para el post
 * generado que llegue sin él. `[[…]]` marca el anclaje. Genérica a propósito:
 * es la red, no lo normal (el prompt pide un enlace escrito para el post).
 */
export const FALLBACK_LINK_SENTENCE = {
  C1: {
    es: "Si estás en ese punto, así es como [[llevamos una idea a producto en producción]].",
    en: "If that is where you are, this is how [[we take an idea to a product in production]].",
  },
  C2: {
    es: "Es el tipo de problema que resolvemos cuando [[rediseñamos el producto que usan tus clientes]].",
    en: "It is the kind of problem we solve when [[we redesign the product your customers use]].",
  },
  C3: {
    es: "Es el tipo de problema que resolvemos cuando [[modernizamos el software que usa tu equipo]].",
    en: "It is the kind of problem we solve when [[we modernise the software your team uses]].",
  },
  IA: {
    es: "Es el tipo de problema que resolvemos cuando [[llevamos la IA de piloto a producción]] dentro de un producto.",
    en: "It is the kind of problem we solve when [[we take AI from pilot to production]] inside a product.",
  },
};

/** Cluster por defecto de cada categoría del blog (punto de partida, no regla). */
export const CATEGORY_CLUSTER = { PRODUCT: "C1", UX: "C2", DESIGN: "C2", TECH: "C3" };

/**
 * Búsquedas reservadas a una página: ningún post puede perseguirlas (ni en
 * el título, ni en el metaTitle, ni como búsqueda objetivo). Incluye las
 * fijas y las complementarias asignadas a páginas.
 */
export const RESERVED_QUERIES = {
  es: [
    "empresa de producto digital",
    "diseño y desarrollo de producto digital",
    "estudio de producto digital",
    "desarrollo de producto digital",
    "diseño de producto digital",
    "experiencia de cliente producto digital",
    "de idea a producto digital",
    "rediseño de onboarding",
    "modernizar software interno",
    "llevar un piloto de IA a producción",
  ],
  en: [
    "digital product company",
    "digital product design and development",
    "digital product studio",
    "digital product development",
    "digital product design",
    "customer experience digital product",
    "from idea to digital product",
    "onboarding redesign",
    "internal software modernisation",
    "ai pilot to production",
  ],
};

/** Casos publicados (anónimos). `about` sirve para decidir si un post encaja. */
export const CASES = [
  { key: "saasAutogestion", about: { es: "SaaS B2B regulado: autogestión de clientes y reducción de soporte", en: "Regulated B2B SaaS: customer self-service and less support load" } },
  { key: "activacionCanonico", about: { es: "Plataforma B2B2C: activación, sistema de diseño multimarca y modelo canónico para IA", en: "B2B2C platform: activation, multi-brand design system and canonical model for AI" } },
  { key: "iaEcommerce", about: { es: "E-commerce de alimentación: IA sobre la tienda sin tocarla", en: "Online grocery: AI on top of the store without touching it" } },
];

export function clusterForCategory(category) {
  return CATEGORY_CLUSTER[category] ?? "C2";
}

/** URL relativa de la página de un cluster en un idioma: "/es/empezar-de-cero". */
export function clusterHref(cluster, lang) {
  const c = CLUSTERS[cluster];
  return c ? path(c.page, lang) : null;
}

/** URLs relativas de los casos en un idioma. */
export function caseHrefs(lang) {
  return CASES.map((c) => path(c.key, lang));
}

/** Las búsquedas reservadas que aparecen en un texto (sin distinguir mayúsculas). */
export function reservedQueriesIn(text, lang) {
  const t = String(text || "").toLowerCase();
  return (RESERVED_QUERIES[lang] || []).filter((q) => t.includes(q.toLowerCase()));
}
