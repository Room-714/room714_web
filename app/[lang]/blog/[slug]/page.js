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
    : `https://room714.com${image}`;
  const pageUrl = `https://www.room714.com/${lang}/blog/${slug}`;

  return {
    title: `${title} | Room 714`,
    description: description,
    openGraph: {
      title: title,
      description: description,
      url: pageUrl,
      siteName: "Room 714",
      images: [{ url: imageUrl, width: 1200, height: 630 }],
      locale: lang === "es" ? "es_ES" : "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: description,
      images: [imageUrl],
    },
    // 3. ESTO ES NUEVO: Le dice a Google que existen versiones en otros idiomas
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
    .slice(0, 3);

  return (
    <main className="flex flex-col bg-white">
      <Navbar dict={dict} isDark={false} alternatePaths={alternatePaths} />

      {/* Botón de volver con corrección de capa */}
      <div className="relative z-10 w-full max-w-9xl mx-auto px-8 sm:px-10 md:px-14 lg:px-22 pt-12 -mb-8 flex justify-start">
        <Link
          href={`/${lang}/blog`}
          className="group inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors duration-200 font-title font-bold text-xs sm:text-sm uppercase tracking-widest cursor-pointer"
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
      <div className="flex flex-col w-full items-stretch md:flex-row-reverse max-w-9xl mx-auto md:py-12 px-2 sm:px-4 md:px-8 lg:px-16">
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
            <span className="text-red-500 text-base sm:text-lg md:text-xl font-hand">
              {category}
            </span>
            <h1 className="font-title font-black text-xl sm:text-2xl md:text-3xl lg:text-4xl text-black my-4 leading-tight">
              {title}
            </h1>
            <span className="text-gray-400 text-sm sm:text-base font-medium">
              {post.date}
            </span>
          </div>

          {/* Grupo Inferior: Tags - Se alinearán con el fondo de la imagen gracias al justify-between */}
          <div className="flex flex-wrap gap-2 mt-8 md:mt-0 md:pb-2">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="text-xs sm:text-sm font-title text-red-500 border border-red-500 px-3 py-1 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <article className="max-w-9xl mx-auto py-2 px-8 sm:py-4 sm:px-10 md:py-6 md:px-14 lg:py-8 lg:px-22">
        {/* Cuerpo del Artículo (HTML del idioma seleccionado) */}
        <div
          className="prose prose-red max-w-none 
             prose-base sm:prose-lg md:prose-xl lg:prose-2xl
             font-body text-black leading-relaxed
             prose-strong:text-black prose-strong:font-bold
             prose-headings:font-title prose-headings:font-black
             prose-img:rounded-xl" // Opcional: redondea las imágenes del post
          dangerouslySetInnerHTML={{ __html: content }}
        />

        <ShareButton title={title} lang={lang} dict={dict.blog} />
      </article>

      {/* Footer de artículos recientes */}
      <section className="mt-20 bg-gray-300 px-6 py-20 rounded-t-[50px]">
        <div className="max-w-9xl mx-auto">
          <h2 className="font-title font-black px-4 text-3xl mb-12 text-black">
            {lang === "es" ? "Últimos artículos" : "Latest articles"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {latestArticles.map((article) => (
              <BlogCard key={article.id} post={article} lang={lang} />
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
