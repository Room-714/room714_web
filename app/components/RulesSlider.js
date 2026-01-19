"use client";
import { useRef, useState } from "react";
import Image from "next/image";

export default function RulesSlider({ rules }) {
  const scrollRef = useRef(null);
  const [activeId, setActiveId] = useState(null);

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
          closestId = rules[index]?.id;
        }
      });

      if (closestId !== activeId) setActiveId(closestId);
    }
  };

  return (
    /* CONTENEDOR PADRE CON ALTO FIJO: 
       Fijamos h-[600px] (o lo que necesites) para que el layout de la página sea estático.
    */
    <div className="w-full h-160">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="w-full no-scrollbar flex overflow-x-auto snap-x snap-mandatory gap-6 px-[10%] py-10 lg:overflow-visible lg:px-24 lg:grid lg:grid-cols-3 lg:gap-10 lg:items-start"
      >
        {rules.map((rule) => {
          const isActive = activeId === rule.id;

          return (
            <div
              key={rule.id}
              onClick={() => setActiveId(isActive ? null : rule.id)}
              className={`
                rule-card shrink-0 bg-white rounded-[30px] p-8 cursor-pointer
                transition-all duration-500 ease-in-out self-start
                ${isActive ? "shadow-2xl z-10 scale-[1.02]" : "shadow-sm scale-100"}
                w-70 md:w-87.5 lg:w-full
                snap-center
              `}
            >
              <div className="flex flex-col">
                <span className="text-gray-500 font-bold font-hand text-sm md:text-base lg:text-lg block">
                  {rule.id}
                </span>

                <h4 className="font-body font-black text-xl md:text-2xl lg:text-3xl text-black leading-tight">
                  {rule.title}
                </h4>

                <div
                  className={`
                    grid transition-all duration-500 ease-in-out
                    ${
                      isActive
                        ? "grid-rows-[1fr] opacity-100 mt-6"
                        : "grid-rows-[0fr] opacity-0 mt-0"
                    }
                  `}
                >
                  <div className="overflow-hidden min-h-0">
                    <p className="font-body text-black text-sm md:text-base lg:text-xl leading-relaxed border-t border-gray-100 pt-4">
                      <span className="font-bold">
                        {rule.description_line1}
                      </span>{" "}
                      {rule.description_line2}
                    </p>
                  </div>
                </div>

                <div
                  className={`
                    transition-all duration-500 ease-in-out mt-6 self-end
                    ${isActive ? "w-30 h-30" : "w-24 h-24 md:w-32 md:h-32"}
                    relative
                  `}
                >
                  <Image
                    src={`/rules-${rule.id}.svg`}
                    alt={`Icono ${rule.title}`}
                    fill
                    className="object-contain transition-all duration-500"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
