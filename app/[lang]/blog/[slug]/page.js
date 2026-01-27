import Image from "next/image";
import { notFound } from "next/navigation";
import BlogCard from "@/app/components/BlogCard";
import { getDictionary } from "@/app/dictionaries";
import Navbar from "@/app/components/Navbar";
import ShareButton from "@/app/components/ShareButton";
import { getPostBySlug, getAllPosts } from "@/app/lib/blog";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export async function generateMetadata({ params }) {
  const { slug, lang } = await params;
  const post = await getPostBySlug(slug, lang);

  if (!post) return { title: "Post not found" };

  const { title, content, image, alternateSlugs } = post;

  const description = content?.replace(/<[^>]*>/g, "").slice(0, 160);

  const imageUrl = image.startsWith("http")
    ? image
    : `https://www.room714.com${image.startsWith("/") ? "" : "/"}${image}`;
  const pageUrl = `https://www.room714.com/${lang}/blog/${slug}`;

  return {
    title: `${title} | Room 714`,
    description: description,
    openGraph: {
      title: title,
      description: description,
      url: pageUrl,
      siteName: "Room 714",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      locale: lang === "es" ? "es_ES" : "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: description,
      images: [imageUrl],
    },
    alternates: {
      languages: {
        "es-ES": `https://room714.com/es/blog/${post.alternateSlugs.es}`,
        "en-US": `https://room714.com/en/blog/${post.alternateSlugs.en}`,
      },
    },
  };
}

export default async function PostPage({ params }) {
  const { slug, lang } = await params;
  const dict = await getDictionary(lang);

  // 1. Buscamos el post (la función ya nos da el idioma correcto)
  const post = await getPostBySlug(slug, lang);
  if (!post) notFound();

  // 2. Desestructuramos directamente (sin prefijos es_ o en_)
  const {
    title,
    content,
    category,
    tags = [],
    date,
    image,
    alternateSlugs,
  } = post;

  const alternatePaths = {
    es: `/es/blog/${alternateSlugs.es}`,
    en: `/en/blog/${alternateSlugs.en}`,
  };

  // 3. Artículos relacionados
  const allPosts = await getAllPosts(lang); // Esperamos a que lleguen los datos

  const latestArticles = allPosts
    .filter((p) => p.id !== post.id) // Ahora sí, allPosts es un Array
    .slice(0, 6);

  return (
    <main className="flex flex-col bg-white">
      <Navbar dict={dict} isDark={false} alternatePaths={alternatePaths} />

      {/* Botón de volver con corrección de capa */}
      <div className="relative z-10 w-full px-8 sm:px-10 md:px-14 lg:px-22 py-6 flex justify-start">
        <Link
          href={`/${lang}/blog`}
          className="group inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors duration-200 font-title text-xs sm:text-sm uppercase tracking-widest cursor-pointer"
        >
          <ArrowLeft
            size={18}
            strokeWidth={3}
            className="transform group-hover:-translate-x-1 transition-transform duration-200"
          />
          <span>{dict.blog.back}</span>
        </Link>
      </div>

      {/* Contenedor principal del Hero - Quitamos items-start y usamos items-stretch */}
      <div className="flex flex-col w-full items-stretch md:flex-row-reverse px-2 sm:px-4 md:px-8 lg:px-16">
        {/* 1. La Imagen */}
        <div className="w-full md:w-1/2 lg:w-2/5 px-6 mb-8 md:mb-0">
          <div className="relative w-full aspect-4/3 sm:aspect-video md:aspect-square rounded-4xl overflow-hidden shadow-2xl">
            <Image
              src={post.image}
              alt={title}
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>

        {/* 2. Los Títulos y Tags */}
        {/* Usamos flex-col y justify-between para empujar las secciones a los extremos */}
        <div className="w-full md:w-1/2 lg:w-3/5 px-6 flex flex-col justify-between">
          {/* Grupo Superior: Categoría, Título y Fecha */}
          <div className="pt-2">
            {" "}
            {/* Un pequeño padding para alinear visualmente con el borde de la foto */}
            <span className="text-red-500 text-base sm:text-lg md:text-xl lg:text-2xl font-hand">
              {category}
            </span>
            <h1 className="font-title font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-black my-4 leading-tight">
              {title}
            </h1>
            <span className="text-gray-400 text-sm sm:text-base md:text-lg lg:text-xl font-medium">
              {post.date}
            </span>
          </div>

          {/* Grupo Inferior: Tags - Se alinearán con el fondo de la imagen gracias al justify-between */}
          <div className="flex flex-wrap gap-2 mt-8 md:mt-0 md:pb-2">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="text-xs sm:text-sm md:text-base lg:text-lg font-title text-red-500 border border-red-500 px-3 py-1 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
  .prose h2 {
    line-height: 1.625 !important; 
    margin-top: 2.5rem !important;
    margin-bottom: 1.25rem !important;
  }
`,
        }}
      />

      <article className="py-2 px-8 sm:py-4 sm:px-10 md:py-6 md:px-14 lg:py-8 lg:px-22">
        {/* Cuerpo del Artículo (HTML del idioma seleccionado) */}
        <div
          className="prose prose-red max-w-none 
             font-body text-black leading-relaxed
             text-lg sm:text-xl lg:text-2xl 
             prose-headings:text-black prose-headings:font-title prose-headings:font-black
             prose-h1:text-4xl sm:prose-h1:text-5xl lg:prose-h1:text-6xl
             prose-h2:text-3xl sm:prose-h2:text-4xl
             prose-strong:text-black prose-strong:font-bold
             prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: content }}
        />

        <ShareButton title={title} lang={lang} dict={dict.blog} />
      </article>

      {/* Footer de artículos recientes con Diccionario */}
      <section className="mt-20 bg-gray-300 px-6 sm:px-8 md:px-10 lg:px-16 py-10 sm:py-14 md:py-16 lg:py-18 rounded-t-[50px]">
        <div>
          <h2 className="font-title font-black px-4 sm:px-6 md:px-8 lg:px-10 text-xl sm:text-2xl md:text-3xl lg:text-4xl pb-6 md:pb-10 text-black">
            {/* Usamos la clave del diccionario para el título */}
            {dict.blog.latest_articles}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {latestArticles.slice(0, 6).map((article, index) => (
              <div
                key={article.id}
                className={`
            {/* Lógica de visibilidad por breakpoint */}
            ${index >= 3 ? "hidden md:block" : ""} 
            ${index >= 4 ? "md:hidden lg:block" : ""}
          `}
              >
                <BlogCard post={article} lang={lang} />
              </div>
            ))}
          </div>
        </div>
      </section>

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
