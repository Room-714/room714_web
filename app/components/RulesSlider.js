"use client";
import { useRef, useState } from "react";

export default function RulesSlider({ rules }) {
  const scrollRef = useRef(null);
  const [activeId, setActiveId] = useState(rules[2].id); // 03 activa por defecto

  const handleScroll = () => {
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
        w-full no-scrollbar transition-all duration-300
        flex overflow-x-auto snap-x snap-mandatory gap-6 px-[10%] pb-20 pt-10
        lg:overflow-visible lg:px-24 lg:grid lg:grid-cols-3 lg:gap-10 lg:items-start
      `}
    >
      {rules.map((rule) => {
        const isActive = activeId === rule.id;

        return (
          <div
            key={rule.id}
            onClick={() => setActiveId(rule.id)}
            className={`
              rule-card shrink-0 bg-white rounded-[30px] p-8 cursor-pointer
              transition-all duration-300 ease-in-out
              /* Eliminamos scale-y para evitar deformación de títulos */
              ${
                isActive
                  ? "shadow-2xl opacity-100 z-10"
                  : "opacity-50 lg:opacity-70 hover:opacity-100 shadow-sm"
              }
              w-[280px] md:w-[350px] lg:w-full lg:max-w-[400px]
              snap-center
            `}
          >
            <div className="flex flex-col">
              <span className="text-gray-400 font-body text-sm mb-2 block">
                {rule.id}
              </span>
              <h4
                className={`
                font-title text-2xl md:text-3xl text-black leading-tight transition-all duration-300
                ${isActive ? "mb-6" : "mb-0"}
              `}
              >
                {rule.title}
              </h4>

              {/* Desplegado real mediante altura, no escala visual */}
              <div
                className={`
                  transition-all duration-500 ease-in-out overflow-hidden
                  ${
                    isActive
                      ? "max-h-[500px] opacity-100 mt-2"
                      : "max-h-0 opacity-0 mt-0"
                  }
                `}
              >
                <p className="font-body text-gray-600 text-sm leading-relaxed">
                  {rule.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
