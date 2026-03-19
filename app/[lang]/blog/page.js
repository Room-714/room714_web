import { getDictionary } from "@/app/dictionaries";
import { getAllPosts } from "@/app/lib/blog";
import Image from "next/image";
import Navbar from "@/app/components/Navbar";
import BlogClient from "@/app/components/BlogClient";
import { CATEGORY_IDS } from "@/app/data/BlogCategories";

const baseUrl = "https://www.room714.com";

export async function generateMetadata({ params }) {
  const { lang = "en" } = await params;
  const titles = {
    en: "Blog — Insights on Digital Product, UX & Technology",
    es: "Blog — Ideas sobre Producto Digital, UX y Tecnología",
  };
  const descriptions = {
    en: "Articles on product strategy, UX design, software development, and digital transformation by Room 714.",
    es: "Artículos sobre estrategia de producto, diseño UX, desarrollo de software y transformación digital de Room 714.",
  };

  return {
    title: titles[lang],
    description: descriptions[lang],
    alternates: {
      canonical: `${baseUrl}/${lang}/blog`,
      languages: {
        "en-US": `${baseUrl}/en/blog`,
        "es-ES": `${baseUrl}/es/blog`,
        "x-default": `${baseUrl}/en/blog`,
      },
    },
    openGraph: {
      title: titles[lang],
      description: descriptions[lang],
      url: `${baseUrl}/${lang}/blog`,
      type: "website",
    },
  };
}

export default async function BlogPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  const categories = CATEGORY_IDS.map((id) => ({
    id: id,
    name: dict.blog.categories[id],
  }));

  const posts = await getAllPosts(lang);

  return (
    <main className="flex flex-col bg-white">
      <Navbar dict={dict} isDark={false} />

      {/* Header del Blog */}
      <header className="w-full my-20 py-20 px-4 flex flex-col justify-between items-between gap-8">
        <div className="flex flex-wrap items-center mx-2 md:mx-4 lg:mx-8 gap-4">
          <div className="relative">
            <h1 className="text-7xl md:text-8xl lg:text-9xl font-black text-black leading-14">
              {dict.blog.our}
            </h1>

            {/* La Cruz con posicionamiento dinámico */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`relative ${dict.blog.headerConfig.crossConfig}`}>
                <Image
                  src="/blog-cross.svg"
                  alt="Cross"
                  width={120}
                  height={150}
                  className="h-auto w-full priority"
                />
              </div>
            </div>

            {/* "your" dinámico */}
            <div
              className={`absolute select-none ${dict.blog.headerConfig.yourPos}`}
            >
              <span className="text-6xl md:text-7xl lg:text-8xl font-hand text-gray-500 -rotate-12 inline-block">
                {dict.blog.your}
              </span>
            </div>
          </div>

          <h1 className="text-7xl md:text-8xl lg:text-9xl font-black text-black leading-14">
            {dict.blog.blog}
          </h1>
        </div>

        {/* Lado Derecho */}
        <div className="w-full flex flex-col items-end mt-30 pr-4">
          <div className="relative text-right">
            <h2 className="font-hand text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-black leading-none">
              {dict.blog.beyond}
            </h2>

            {/* Cuadrado dinámico */}
            <div
              className={`absolute point-events-none ${dict.blog.headerConfig.squarePos} w-27 h-27 sm:w-31 sm:h-31 md:w-40 md:h-40 lg:w-52 lg:h-52`}
            >
              <Image
                src="/blog-square.svg"
                alt="Square"
                width={120}
                height={150}
                className="h-auto w-full priority scale-90"
              />
            </div>
          </div>
        </div>
      </header>

      <BlogClient
        posts={posts}
        categories={categories}
        lang={lang}
        dict={dict.blog}
      />

      {/* 1. Contenedor del Skyline: Proporcional y siempre visible */}
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
