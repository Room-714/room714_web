import Image from "next/image";
import { ChevronDown } from "lucide-react";

export default function ProjectCard({ project, isOpen, onClick, dict }) {
  return (
    <div
      onClick={onClick}
      className={`w-full transition-all duration-500 ease-in-out cursor-pointer rounded-4xl overflow-hidden
        bg-[#F2F2F2] 
        bg-[linear-gradient(to_right,#d1d1d1_1px,transparent_1px),linear-gradient(to_bottom,#d1d1d1_1px,transparent_1px)]
        bg-size-[20px_20px]
        ${isOpen ? "mb-4" : "mb-4 hover:bg-[#ebebeb]"}
      `}
    >
      {/* LÍNEA ROJA DE ACENTO (Superior) */}
      <div
        className={`h-2 w-full bg-red-700 transition-opacity duration-500 ${isOpen ? "opacity-100" : "opacity-0"}`}
      />

      <div className="py-4 px-6">
        {/* CABECERA: Título Horizontal */}
        <div className="flex justify-between items-center">
          <div className="flex justify-start items-start gap-4">
            <span
              className={`font-black font-hand text-lg md:text-2xl lg:text-4xl ${isOpen ? "text-red-500 pt-2" : "text-gray-400"}`}
            >
              {project.id}
            </span>
            <h3
              className={`font-bold font-hand text-lg md:text-2xl lg:text-4xl transition-colors ${isOpen ? "text-black pt-2" : "text-gray-400"}`}
            >
              {project.title}
            </h3>
          </div>

          <div
            className={`transition-transform duration-500 ${isOpen ? "rotate-180" : "rotate-0"}`}
          >
            <ChevronDown
              size={24}
              className={isOpen ? "text-red-500" : "text-gray-400"}
            />
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
                    {dict.projects.subtitle_results}
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
