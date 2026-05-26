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
      {/* LÍNEA ROJA DE ACENTO (Superior) */}
      <div
        className={`h-2 w-full bg-red-700 transition-opacity duration-500 ${isOpen ? "opacity-100" : "opacity-0"}`}
      />

      <div className="py-4 px-6">
        {/* CABECERA: Título Horizontal */}
        <div className="flex justify-between items-center gap-3">
          <div className="flex justify-start items-start gap-4 min-w-0">
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

          <div className="flex items-center gap-3 flex-none">
            {project.status && dict.projects.status?.[project.status] && (
              <span
                className={`font-hand text-sm md:text-base lg:text-xl px-3 py-0.5 -rotate-2 select-none border-2 border-dashed rounded-md transition-opacity duration-500 ${
                  project.status === "in_progress"
                    ? "text-amber-600 border-amber-500"
                    : "text-green-700 border-green-600"
                } ${isOpen ? "opacity-100" : "opacity-60"}`}
              >
                {dict.projects.status[project.status]}
              </span>
            )}

            <div
              className={`transition-transform duration-500 ${isOpen ? "rotate-180" : "rotate-0"}`}
            >
              <ChevronDown
                size={24}
                className={isOpen ? "text-red-500" : "text-gray-400"}
              />
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
