"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import PrimaryButton from "@/app/components/PrimaryButton";
import { CATEGORY_IDS, CATEGORY_LABELS } from "@/app/data/BlogCategories";
import { getSlugFromCategory } from "@/app/lib/categoryRoutes";
import BlogCard from "@/app/components/BlogCard";

export default function BlogClient({ posts, dict, lang }) {
  // Ahora el estado inicial coincide con nuestra nueva constante "ALL"
  const [activeFilterId, setActiveFilterId] = useState("ALL");

  const POSTS_PER_PAGE = 6;
  const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE);

  const handleFilterChange = (id) => {
    setActiveFilterId(id);
    setVisibleCount(POSTS_PER_PAGE);
  };

  // Construimos las categorías mezclando "ALL" con los IDs del ENUM
  const allCategories = ["ALL", ...CATEGORY_IDS].map((id) => {
    const slug = id === "ALL" ? null : getSlugFromCategory(lang, id);
    return {
      id: id,
      // Prioridad: 1. Diccionario JSON, 2. Labels estáticos, 3. El ID puro
      name: dict.categories?.[id] || CATEGORY_LABELS[id]?.[lang] || id,
      // Enlace real a la ruta de categoría. Existe para que Google la rastree:
      // hasta ahora esas ocho rutas solo vivían en el sitemap y ningún enlace
      // del sitio apuntaba a ellas. El clic se intercepta más abajo, así que el
      // usuario sigue viendo el filtrado instantáneo de siempre.
      href: slug ? `/${lang}/blog/category/${slug}` : `/${lang}/blog`,
    };
  });

  const filteredPosts = posts.filter((post) => {
    if (activeFilterId === "ALL") return true;
    // COMPARACIÓN DIRECTA: El ENUM en la DB es "TECH" y el ID es "TECH". Match perfecto.
    return post.category === activeFilterId;
  });

  return (
    <div className="w-full bg-gray-300 p-5 pb-20 rounded-t-[50px] -mt-10 relative z-10">
      <nav className="relative w-full mx-auto px-4 md:px-8 mt-10">
        <div className="flex items-center justify-start overflow-x-auto no-scrollbar pb-4">
          {allCategories.map((cat) => (
            <Link
              key={cat.id}
              href={cat.href}
              onClick={(e) => {
                // Con modificadores (ctrl/cmd/shift, o botón central) dejamos
                // que el navegador abra la ruta de categoría de verdad.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                handleFilterChange(cat.id);
              }}
              className={`px-6 py-2 rounded-full text-sm sm:text-base md:text-lg lg:text-xl font-hand transition-all whitespace-nowrap shrink-0 ${
                activeFilterId === cat.id
                  ? "text-red-500 font-bold scale-110"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </nav>

      <section className="w-full px-4 md:px-8 mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16 mt-10">
        {filteredPosts.length > 0 ? (
          // Renderizamos TODAS las tarjetas para que sus enlaces estén en el
          // HTML y Google los rastree; ocultamos con CSS las que superan
          // visibleCount. "Cargar más" solo revela más, no crea enlaces nuevos.
          filteredPosts.map((post, i) => (
            <div
              key={post.id}
              className={i < visibleCount ? "contents" : "hidden"}
            >
              <BlogCard post={post} lang={lang} />
            </div>
          ))
        ) : (
          <div className="col-span-full font-title text-center py-20 text-gray-600 text-2xl">
            {dict.no_results || "No se han encontrado artículos"}
          </div>
        )}
      </section>

      {visibleCount < filteredPosts.length && (
        <div className="w-full flex justify-center mt-20">
          <PrimaryButton
            text={dict.load_more || "Cargar más"}
            isRed={true}
            icon={ChevronDown}
            onClick={() => setVisibleCount((prev) => prev + POSTS_PER_PAGE)}
          />
        </div>
      )}
    </div>
  );
}
