import Image from "next/image";
import { ChevronDown } from "lucide-react";

export default function ProjectCard({ project, isOpen, onClick, dict, priority = false }) {
  return (
    <div
      onClick={onClick}
      className={`w-full transition-all duration-700 ease-in-out cursor-pointer rounded-4xl overflow-hidden
  bg-[#F2F2F2] 
  bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)]
  bg-size-[40px_40px]
  ${isOpen ? "mb-4 shadow-sm" : "mb-4 hover:bg-[#F8F8F8] hover:bg-size[45px_45px]"}
`}
    >
      {/* Línea roja de acento, siempre visible: en las tarjetas de los tres
          casos destacados también lo está, y aparecer solo al abrirse hacía
          que las dos mitades del listado no parecieran iguales. */}
      <div className="h-2 w-full bg-red-700" />

      <div className="px-6 py-8 lg:px-10 lg:py-10">
        {/* CABECERA: Título Horizontal.
            Misma tipografía, mismos tamaños y mismos colores que las
            tarjetas de los tres casos destacados: número en font-hand rojo,
            título en font-title negro. Antes iba en font-hand y se ponía en
            gris al cerrarse, así que las dos mitades del listado no parecían
            del mismo sitio. */}
        <div className="flex justify-between items-start gap-3">
          <div className="flex justify-start items-start gap-4 lg:gap-6 min-w-0">
            <span className="font-hand font-black text-red-500 text-2xl md:text-3xl lg:text-4xl shrink-0">
              {project.id}
            </span>
            <h3 className="font-title font-bold text-black text-xl md:text-2xl lg:text-4xl leading-tight">
              {project.title}
            </h3>
          </div>

          <div className="flex items-center gap-3 flex-none">
            <div
              className={`transition-transform duration-500 ${isOpen ? "rotate-180" : "rotate-0"}`}
            >
              <ChevronDown size={24} className="text-red-500" />
            </div>
          </div>
        </div>

        {/* CONTENIDO DESPLEGABLE */}
        <div
          className={`grid transition-all duration-500 ease-in-out ${isOpen ? "grid-rows-[1fr] mt-4 opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col md:flex-row-reverse gap-10">
              {/* IMAGEN */}
              <div className="w-full md:w-1/3 aspect-4/3 relative p-6">
                <Image
                  src={project.image}
                  alt={project.title}
                  fill
                  sizes="(max-width: 768px) 90vw, 33vw"
                  priority={priority}
                  className="object-contain"
                />
              </div>

              {/* TEXTOS */}
              <div className="flex-1 space-y-4 mt-6">
                <div>
                  <p className="font-hand text-xl md:text-2xl lg:text-3xl font-black text-red-500 mb-1">
                    {dict.projects.subtitle_challenge}
                  </p>
                  <p className="text-gray-700 text-base leading-5 md:text-lg md:leading-6 lg:text-2xl lg:leading-8">
                    {project.challenge}
                  </p>
                </div>

                <div>
                  <p className="font-hand text-xl md:text-2xl lg:text-3xl font-black text-red-500 mb-1">
                    {dict.projects.subtitle_solution}
                  </p>
                  <p className="text-gray-900 text-base leading-5 md:text-lg md:leading-6 lg:text-2xl lg:leading-8">
                    {project.idea}
                  </p>
                </div>

                <div>
                  <p className="font-hand text-xl md:text-2xl lg:text-3xl font-black text-red-500 mb-1">
                    {project.status === "in_progress"
                      ? dict.projects.subtitle_results_expected
                      : dict.projects.subtitle_results}
                  </p>
                  <p className="text-gray-900 text-base leading-5 md:text-lg md:leading-6 lg:text-2xl lg:leading-8">
                    {project.outcome}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
