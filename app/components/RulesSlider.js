"use client";
import { useRef, useState } from "react";

export default function RulesSlider({ rules }) {
  const scrollRef = useRef(null);
  // Iniciamos en null o en un ID específico para que el texto aparezca solo al pinchar
  const [activeId, setActiveId] = useState(null);

  const handleScroll = () => {
    // Solo ejecutamos la detección de centro en móviles/tablets
    if (window.innerWidth < 1024 && scrollRef.current) {
      const scrollPosition = scrollRef.current.scrollLeft;
      const containerWidth = scrollRef.current.offsetWidth;
      const center = scrollPosition + containerWidth / 2;

      const cards = scrollRef.current.querySelectorAll(".rule-card");
      let closestId = activeId;
      let minDistance = Infinity;

      cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(center - cardCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestId = rules[index].id;
        }
      });

      if (closestId !== activeId) setActiveId(closestId);
    }
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={`
        w-full no-scrollbar
        flex overflow-x-auto snap-x snap-mandatory gap-6 px-[10%] pb-20 pt-10
        lg:overflow-visible lg:px-24 lg:grid lg:grid-cols-3 lg:gap-10 lg:items-start
      `}
    >
      {rules.map((rule) => {
        const isActive = activeId === rule.id;

        return (
          <div
            key={rule.id}
            onClick={() => setActiveId(isActive ? null : rule.id)} // Si pincha la activa, se cierra
            className={`
              rule-card shrink-0 bg-white rounded-[30px] p-8 cursor-pointer
              transition-all duration-500 ease-in-out self-start
              ${
                isActive
                  ? "shadow-2xl opacity-100 z-10 translate-y-[-5px]"
                  : "shadow-sm opacity-60 hover:opacity-100"
              }
              w-[280px] md:w-[350px] lg:w-full
              snap-center
            `}
          >
            <div className="flex flex-col">
              <span className="text-gray-400 font-body text-xs mb-3 block tracking-widest">
                {rule.id}
              </span>

              <h4 className="font-title text-2xl md:text-3xl text-black leading-tight">
                {rule.title}
              </h4>

              {/* El contenedor del texto crece hacia abajo */}
              <div
                className={`
                  grid transition-all duration-500 ease-in-out
                  ${
                    isActive
                      ? "grid-rows-[1fr] opacity-100 pt-6"
                      : "grid-rows-[0fr] opacity-0 pt-0"
                  }
                `}
              >
                <div className="overflow-hidden">
                  <p className="font-body text-gray-600 text-sm md:text-base leading-relaxed border-t border-gray-100 pt-4">
                    {rule.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
