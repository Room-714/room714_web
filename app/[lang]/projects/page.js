import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
import { Phone } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import PrimaryButton from "@/app/components/PrimaryButton";
import ProjectsList from "@/app/components/ProjectList";
import { getProjectsData } from "@/app/data/Projects";

export default async function ProjectsPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const projects = getProjectsData(dict);

  return (
    <>
      <Navbar dict={dict} isDark={true} />

      <main className="min-h-screen bg-black text-white pt-24 mb-20">
        {/* Cabecera de Página */}
        <div className="px-8 lg:px-24 mb-16">
          {/* Primera línea del título */}
          <h1 className="font-body font-black text-6xl md:text-8xl mb-4">
            {dict.projects.title_1}
          </h1>

          {/* Contenedor para mover la segunda línea a la derecha */}
          <div className="flex justify-end pr-[5%] sm:pr-[5%] md:pr-[10%] lg:pr-[10%] mb-8">
            {/* Este div 'inline-flex' hace que el ancho sea solo el del texto */}
            <div className="inline-flex flex-col items-center">
              <h1 className="font-hand text-6xl md:text-8xl text-white leading-none">
                {dict.projects.title_2}
              </h1>

              {/* La línea ahora se ajusta al 100% del ancho del texto de arriba */}
              <div className="w-full h-8 md:h-12 lg:h-16 relative">
                <Image
                  src="/project/double-line.svg"
                  alt="Double line"
                  fill
                  className="object-contain object-top"
                  priority
                />
              </div>
            </div>
          </div>
          <p className="font-title font-black text-3xl lg:text-4xl text-white mb-2">
            CXperiences
          </p>
          <p className="font-body text-2xl lg:text-3xl max-w-2xl text-white">
            {dict.projects.description}
          </p>
        </div>

        {/* Listado de Proyectos */}
        <div className="px-6 lg:px-20 pb-30">
          <ProjectsList projects={projects} dict={dict} />
        </div>
      </main>

      {/* Footer / CTA Final estilo "Tired of talking about metrics?" */}
      <section className="relative z-10 -mt-30 w-full bg-white rounded-t-[50px] p-10 lg:p-16 text-center text-black">
        <h3 className="font-title font-black text-3xl md:text-5xl mb-6">
          {dict.projects.footer_cta.line_1}
        </h3>
        <h3 className="font-hand text-4xl md:text-7xl mb-10">
          {dict.projects.footer_cta.line_2}
        </h3>
        <div className="flex justify-center">
          <PrimaryButton
            text={dict.projects.buttons.view_case_study}
            isRed={true}
            icon={Phone}
            href={`/${lang}/contact`}
          />
        </div>
      </section>

      {/* 1. Contenedor del Skyline: Proporcional y siempre visible */}
      <section className="w-full bg-white">
        <div className="w-[60%] ml-auto leading-0 flex">
          <Image
            src="/skyline.svg"
            alt="City Skyline"
            width={1920}
            height={400}
            className="w-full h-auto block -mb-1 md:-mb-3 lg:-mb-5"
            priority
          />
        </div>
      </section>
    </>
  );
}
