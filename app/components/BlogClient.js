"use client";
import { useState } from "react";
import { CATEGORY_IDS, CATEGORY_LABELS } from "@/app/data/BlogCategories";
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
  const allCategories = ["ALL", ...CATEGORY_IDS].map((id) => ({
    id: id,
    // Prioridad: 1. Diccionario JSON, 2. Labels estáticos, 3. El ID puro
    name: dict.categories?.[id] || CATEGORY_LABELS[id]?.[lang] || id,
  }));

  const filteredPosts = posts.filter((post) => {
    if (activeFilterId === "ALL") return true;
    // COMPARACIÓN DIRECTA: El ENUM en la DB es "TECH" y el ID es "TECH". Match perfecto.
    return post.category === activeFilterId;
  });

  const visiblePosts = filteredPosts.slice(0, visibleCount);

  return (
    <div className="w-full bg-gray-300 p-5 pb-20 rounded-t-[50px] -mt-10 relative z-10">
      <nav className="relative w-full mx-auto px-4 md:px-8 mt-10">
        <div className="flex items-center justify-start overflow-x-auto no-scrollbar pb-4">
          {allCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleFilterChange(cat.id)}
              className={`px-6 py-2 rounded-full text-sm sm:text-base md:text-lg lg:text-xl font-hand transition-all whitespace-nowrap shrink-0 ${
                activeFilterId === cat.id
                  ? "text-red-500 font-bold scale-110"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </nav>

      <section className="w-full px-4 md:px-8 mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16 mt-10">
        {visiblePosts.length > 0 ? (
          visiblePosts.map((post) => (
            <BlogCard key={post.id} post={post} lang={lang} />
          ))
        ) : (
          <div className="col-span-full font-title text-center py-20 text-gray-600 text-2xl">
            {dict.no_results || "No se han encontrado artículos"}
          </div>
        )}
      </section>

      {visibleCount < filteredPosts.length && (
        <div className="w-full flex justify-center mt-20">
          <button
            onClick={() => setVisibleCount((prev) => prev + POSTS_PER_PAGE)}
            className="px-10 py-4 bg-black text-white rounded-full font-hand text-lg hover:bg-red-600 transition-all hover:scale-105 shadow-xl"
          >
            {dict.load_more || "Cargar más"}
          </button>
        </div>
      )}
    </div>
  );
}
