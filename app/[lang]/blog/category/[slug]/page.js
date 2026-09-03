import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  getCategoryFromSlug,
  getSlugFromCategory,
} from "@/app/lib/categoryRoutes";
import { getPostsByCategory } from "@/app/lib/blog";
import { CATEGORY_LABELS } from "@/app/data/BlogCategories";
import { getDictionary } from "@/app/dictionaries";
import Navbar from "@/app/components/Navbar";
import BlogCard from "@/app/components/BlogCard";
import {
  SITE_URL,
  blogUrl,
  buildAlternates,
  langPaths,
} from "@/app/lib/seo/urls";
import { breadcrumbSchema, jsonLdGraph } from "@/app/lib/seo/schema";

const baseUrl = SITE_URL;

const SEO_DESCRIPTIONS = {
  TECH: {
    es: "Análisis y opiniones sobre tecnología aplicada a producto digital: IA, modelos pequeños (SLM), arquitectura, MCP, RAG y eficiencia computacional. La visión de Room 714.",
    en: "Analysis and opinions on technology applied to digital product: AI, small language models (SLMs), architecture, MCP, RAG, and computational efficiency. Room 714's view.",
  },
  PRODUCT: {
    es: "Estrategia de producto, Jobs-to-be-Done (JTBD), Product-Led Growth, y por qué la mayoría de productos con IA no la necesitan. Análisis crítico desde Room 714.",
    en: "Product strategy, Jobs-to-be-Done (JTBD), Product-Led Growth, and why most AI-enabled products don't actually need AI. Critical analysis from Room 714.",
  },
  UX: {
    es: "Usabilidad, experiencia de usuario y diseño cognitivo: cómo reducir fricción, evitar la fatiga cognitiva y diseñar para humanos. Artículos de Room 714.",
    en: "Usability, user experience and cognitive design: how to reduce friction, avoid cognitive fatigue, and design for humans. Articles by Room 714.",
  },
  DESIGN: {
    es: "Diseño de producto y UI: design systems, diseño emocional, interfaces adaptativas y la frontera entre estética y función. La perspectiva de Room 714.",
    en: "Product and UI design: design systems, emotional design, adaptive interfaces, and the line between aesthetics and function. Room 714's perspective.",
  },
};

export async function generateMetadata({ params }) {
  const { lang, slug } = await params;
  const category = getCategoryFromSlug(lang, slug);
  if (!category) return { title: "Category not found" };

  const label = CATEGORY_LABELS[category][lang];
  const titles = {
    es: `${label} — Blog Room 714`,
    en: `${label} — Room 714 Blog`,
  };
  const description = SEO_DESCRIPTIONS[category]?.[lang] ?? "";

  const slugEs = getSlugFromCategory("es", category);
  const slugEn = getSlugFromCategory("en", category);
  const pageUrl = `${baseUrl}/${lang}/blog/category/${slug}`;

  return {
    // `absolute` porque el título ya nombra la marca: con la plantilla del
    // layout saldría "Tecnología — Blog Room 714 | Room 714".
    title: { absolute: titles[lang] },
    description,
    alternates: buildAlternates(
      lang,
      langPaths(`/es/blog/category/${slugEs}`, `/en/blog/category/${slugEn}`),
    ),
    openGraph: {
      title: titles[lang],
      description,
      url: pageUrl,
      type: "website",
      siteName: "Room 714",
      locale: lang === "es" ? "es_ES" : "en_US",
    },
    twitter: {
      card: "summary",
      title: titles[lang],
      description,
    },
  };
}

export async function generateStaticParams() {
  const { listAllCategoryRoutes } = await import("@/app/lib/categoryRoutes");
  return listAllCategoryRoutes().map((r) => ({ lang: r.lang, slug: r.slug }));
}

export default async function CategoryPage({ params }) {
  const { lang, slug } = await params;
  const category = getCategoryFromSlug(lang, slug);
  if (!category) notFound();

  const dict = await getDictionary(lang);
  const posts = await getPostsByCategory(category, lang);
  const label = CATEGORY_LABELS[category][lang];
  const description = SEO_DESCRIPTIONS[category]?.[lang] ?? "";

  const slugEs = getSlugFromCategory("es", category);
  const slugEn = getSlugFromCategory("en", category);

  const pageUrl = `${baseUrl}/${lang}/blog/category/${slug}`;

  // La miga arrancaba en "Blog", sin la portada. Ahora es la cadena completa
  // y con URL en cada eslabón, que es lo que valida Google.
  const collectionJsonLd = jsonLdGraph(
    {
      "@type": "CollectionPage",
      name: label,
      description,
      url: pageUrl,
      inLanguage: lang === "es" ? "es-ES" : "en-US",
      isPartOf: { "@type": "WebSite", name: "Room 714", url: baseUrl },
      hasPart: posts.map((p) => ({
        "@type": "BlogPosting",
        headline: p.title,
        url: blogUrl(lang, p.slug),
        datePublished: p.date,
        image: p.image,
      })),
    },
    breadcrumbSchema([
      { name: dict.nav.home, url: `${baseUrl}/${lang}` },
      { name: dict.nav.blog, url: `${baseUrl}/${lang}/blog` },
      { name: label, url: pageUrl },
    ]),
  );

  const alternatePaths = {
    es: `/es/blog/category/${slugEs}`,
    en: `/en/blog/category/${slugEn}`,
  };

  return (
    <main className="flex flex-col bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <Navbar dict={dict} isDark={false} alternatePaths={alternatePaths} />

      <div className="relative z-10 w-full px-8 sm:px-10 md:px-14 lg:px-22 py-6 flex justify-start">
        <Link
          href={`/${lang}/blog`}
          className="group inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors duration-200 font-title text-xs sm:text-sm uppercase tracking-widest"
        >
          <ArrowLeft
            size={18}
            strokeWidth={3}
            className="transform group-hover:-translate-x-1 transition-transform duration-200"
          />
          <span>{dict.blog?.back ?? (lang === "es" ? "Volver al blog" : "Back to blog")}</span>
        </Link>
      </div>

      <header className="w-full px-8 sm:px-10 md:px-14 lg:px-22 py-10 sm:py-14">
        <p className="text-red-500 font-hand text-2xl mb-2">
          {lang === "es" ? "Categoría" : "Category"}
        </p>
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-black leading-tight">
          {label}
        </h1>
        <p className="mt-6 text-gray-500 text-lg max-w-3xl leading-relaxed">
          {description}
        </p>
        <p className="mt-4 text-gray-400 text-sm font-mono uppercase tracking-widest">
          {posts.length} {lang === "es" ? "artículos" : "articles"}
        </p>
      </header>

      <section className="px-8 sm:px-10 md:px-14 lg:px-22 pb-20">
        {posts.length === 0 ? (
          <p className="text-gray-500 italic">
            {lang === "es" ? "No hay artículos publicados en esta categoría todavía." : "No published articles in this category yet."}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {posts.map((post) => (
              <BlogCard key={post.id} post={post} lang={lang} dict={dict.blog} />
            ))}
          </div>
        )}
      </section>

      <section className="w-full bg-gray-300">
        <div className="w-[60%] ml-auto leading-0 flex">
          <Image
            src="/skyline.svg"
            alt="City Skyline"
            width={1920}
            height={400}
            className="w-full h-auto block"
            priority
          />
        </div>
      </section>
    </main>
  );
}
