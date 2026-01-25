import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
import { Phone } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import PrimaryButton from "@/app/components/PrimaryButton";
import ProjectsList from "@/app/components/ProjectList";
import { getProjectsData } from "@/app/data/Projects";

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const titles = {
    es: "Proyectos | Room 714",
    en: "Projects | Room 714",
  };
  const descriptions = {
    es: "Descubre cómo transformamos la complejidad en éxito a través de nuestros casos de estudio.",
    en: "Discover how we transform complexity into success through our case studies.",
  };

  return {
    title: titles[lang],
    description: descriptions[lang],
  };
}

export default async function ProjectsPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const projects = getProjectsData(dict);

  // 1. Extraemos los casos de estudio del diccionario
  // Usamos Object.keys para filtrar solo las claves que empiezan por 'case_study_'
  const projectKeys = Object.keys(dict.projects).filter((key) =>
    key.startsWith("case_study_"),
  );

  // 2. Construimos el JSON-LD dinámicamente
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: dict.projects.title_1 + " " + dict.projects.title_2,
    description: dict.projects.description,
    itemListElement: projectKeys.map((key, index) => {
      const project = dict.projects[key];
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "CreativeWork",
          name: project.title,
          description: `${project.challenge} ${project.outcome}`, // Combinamos para dar contexto a la IA
          author: {
            "@type": "Organization",
            name: "Room 714",
          },
        },
      };
    }),
  };

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
              <span className="block font-hand text-6xl md:text-8xl text-white leading-none">
                {dict.projects.title_2}
              </span>

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
            className="w-full h-auto block"
            priority
          />
        </div>
      </section>
    </>
  );
}
