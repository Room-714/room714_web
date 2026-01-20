"use client";
import { useRef, useState } from "react";
import Image from "next/image";

export default function RulesSlider({ rules }) {
  const scrollRef = useRef(null);

  // 1. Iniciamos con el ID de la primera regla desplegada por defecto
  const [activeId, setActiveId] = useState(rules[0]?.id || null);

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
    <div className="w-full h-160">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        /* 2. Añadimos perspective-1000 para que el efecto de rotación 3D se vea profundo */
        className="w-full no-scrollbar flex overflow-x-auto snap-x snap-mandatory gap-6 px-[10%] py-10 lg:overflow-visible lg:px-24 lg:grid lg:grid-cols-3 lg:gap-10 lg:items-start [perspective:1000px]"
      >
        {rules.map((rule) => {
          const isActive = activeId === rule.id;

          return (
            <div
              key={rule.id}
              onClick={() => setActiveId(isActive ? null : rule.id)}
              className={`
                rule-card shrink-0 bg-white rounded-[30px] p-8 cursor-pointer
                transition-all duration-700 ease-in-out self-start
                /* 3. Efecto de Giro: rotación en el eje Y y escala */
                ${
                  isActive
                    ? "shadow-2xl z-10 scale-[1.02] [transform:rotateY(0deg)]"
                    : "shadow-sm scale-100 [transform:rotateY(-15deg)] opacity-80"
                }
                w-70 md:w-87.5 lg:w-full
                snap-center
                hover:shadow-lg
              `}
              /* Estilo inline por si Tailwind no reconoce el transform arbitrario */
              style={{ transformStyle: "preserve-3d" }}
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
                    ${isActive ? "w-50 h-50 rotate-0" : "w-24 h-24 md:w-32 md:h-32 -rotate-12 opacity-50"}
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
