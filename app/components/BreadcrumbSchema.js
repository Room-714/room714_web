"use client";

import { usePathname } from "next/navigation";

const PAGE_NAMES = {
  en: {
    about: "About Us",
    projects: "Projects",
    contact: "Contact",
    diagnostic: "Diagnostic",
    blog: "Blog",
  },
  es: {
    about: "Nosotros",
    projects: "Proyectos",
    contact: "Contacto",
    diagnostic: "Diagnóstico",
    blog: "Blog",
  },
};

export default function BreadcrumbSchema() {
  const pathname = usePathname();
  const baseUrl = "https://www.room714.com";

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const lang = segments[0];
  const names = PAGE_NAMES[lang] || PAGE_NAMES.en;

  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
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
