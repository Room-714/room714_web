"use client";

import { usePathname } from "next/navigation";

const PAGE_NAMES = {
  en: {
    home: "Home",
    "what-we-do": "What we do",
    "product-for-your-customers": "Product for your customers",
    "product-for-your-team": "Product for your team",
    "ai-in-the-product": "AI inside the product",
    "starting-from-scratch": "Starting from scratch",
    cases: "Cases",
    "how-we-work": "How we work",
    "lets-talk": "Let's talk",
    diagnostic: "Diagnostic",
    blog: "Ideas",
    careers: "Careers",
    privacy: "Privacy Policy",
    terms: "Terms",
    cookies: "Cookie Policy",
  },
  es: {
    home: "Inicio",
    "que-hacemos": "Qué hacemos",
    "producto-para-tus-clientes": "Producto para tus clientes",
    "producto-para-tu-equipo": "Producto para tu equipo",
    "ia-en-el-producto": "IA dentro del producto",
    "empezar-de-cero": "Empezar de cero",
    casos: "Casos",
    "como-trabajamos": "Cómo trabajamos",
    hablemos: "Hablemos",
    diagnostic: "Diagnóstico",
    blog: "Ideas",
    careers: "Empleo",
    privacy: "Política de Privacidad",
    terms: "Términos",
    cookies: "Política de Cookies",
  },
};

// Rutas cuyo último segmento es un slug: el nombre legible no se puede
// deducir del pathname, así que la miga la emite la propia página, que sí
// tiene el título. Aquí nos apartamos para no duplicar el BreadcrumbList.
function laEmiteLaPagina(segments) {
  const esPostDeBlog = segments.length === 3 && segments[1] === "blog";
  const esCategoria =
    segments.length === 4 && segments[1] === "blog" && segments[2] === "category";
  return esPostDeBlog || esCategoria;
}

export default function BreadcrumbSchema() {
  const pathname = usePathname();
  const baseUrl = "https://www.room714.com";

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  if (laEmiteLaPagina(segments)) return null;

  const lang = segments[0];
  const names = PAGE_NAMES[lang] || PAGE_NAMES.en;

  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: names.home,
      item: `${baseUrl}/${lang}`,
    },
  ];

  let currentPath = `${baseUrl}/${lang}`;
  for (let i = 1; i < segments.length; i++) {
    currentPath += `/${segments[i]}`;
    items.push({
      "@type": "ListItem",
      position: i + 1,
      name: names[segments[i]] || decodeURIComponent(segments[i]),
      item: currentPath,
    });
  }

  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
