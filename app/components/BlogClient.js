"use client";
import { useState, useEffect } from "react";
import { CATEGORY_IDS } from "@/app/data/BlogCategories";
import BlogCard from "@/app/components/BlogCard";

export default function BlogClient({ posts, dict, lang }) {
  const [activeFilterId, setActiveFilterId] = useState("all");

  const POSTS_PER_PAGE = 6;
  const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE);

  const handleFilterChange = (id) => {
    setActiveFilterId(id);
    setVisibleCount(POSTS_PER_PAGE);
  };

  const categories = CATEGORY_IDS.map((id) => ({
    id: id,
    name: id === "all" ? dict.all || "All" : dict.categories?.[id] || id,
  }));

  const activeCategoryObj = categories.find((cat) => cat.id === activeFilterId);

  const filteredPosts = posts.filter((post) => {
    if (activeFilterId === "all") return true;
    return post.category === activeCategoryObj?.name;
  });

  const visiblePosts = filteredPosts.slice(0, visibleCount);

  return (
    <div className="w-full bg-gray-300 p-5 pb-20 rounded-t-[50px] -mt-10 relative z-10">
      <nav className="relative w-full max-w-7xl mx-auto px-4 md:px-8 mt-10">
        <div className="flex items-center justify-start overflow-x-auto no-scrollbar pb-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleFilterChange(cat.id)} // Usamos la nueva función
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

      {/* Grid de Posts - Usamos 'visiblePosts' en lugar de 'filteredPosts' */}
      <section className="max-w-7xl px-4 md:px-8 mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16 mt-10">
        {visiblePosts.length > 0 ? (
          visiblePosts.map((post) => (
            <BlogCard key={post.id} post={post} lang={lang} />
          ))
        ) : (
          <div className="col-span-full font-title text-center py-20 text-gray-600 text-2xl">
            {dict.no_results}
          </div>
        )}
      </section>

      {/* --- BOTÓN CARGAR MÁS --- */}
      {visibleCount < filteredPosts.length && (
        <div className="w-full flex justify-center mt-20">
          <button
            onClick={() => setVisibleCount((prev) => prev + POSTS_PER_PAGE)}
            className="px-10 py-4 bg-black text-white rounded-full font-hand text-lg hover:bg-red-600 transition-all hover:scale-105 shadow-xl"
          >
            {dict.load_more}
          </button>
        </div>
      )}
    </div>
  );
}
