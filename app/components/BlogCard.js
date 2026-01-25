import Image from "next/image";
import Link from "next/link";

export default function BlogCard({ post, lang = "en", dict }) {
  const currentSlug = post.slug;
  const title = post.title;
  const category = post.category;

  return (
    <Link href={`/${lang}/blog/${currentSlug}`} className="group h-full">
      <div className="bg-white rounded-[50px] p-5 shadow-sm hover:shadow-xl transition-all duration-500 h-full flex flex-col">
        {/* Contenedor de Imagen */}
        <div className="relative h-72 w-full rounded-[35px] overflow-hidden mb-6">
          <Image
            src={post.image}
            alt={title} // Usamos el título traducido para el SEO de la imagen
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-700"
          />
        </div>

        {/* Contenido */}
        <div className="px-2 pb-4 grow">
          <span className="text-red-500 text-sm md:text-base font-hand">
            {category}
          </span>
          <h3 className="text-xl sm:text-xl md:text-2xl font-black text-black mt-2 leading-[1.1] group-hover:text-gray-700 transition-colors">
            {title}
          </h3>

          <p className="text-gray-400 text-right text-xs mt-4 font-body">
            {new Date(post.date).toLocaleDateString(
              lang === "es" ? "es-ES" : "en-US",
              {
                day: "numeric",
                month: "long",
                year: "numeric",
              },
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
