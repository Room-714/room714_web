import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
import Navbar from "@/app/components/Navbar";
import PrimaryButton from "@/app/components/PrimaryButton";
import { ArrowRight } from "lucide-react";

export default async function ProjectsPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  // Datos de ejemplo basados en tu diseño "The work. No fluff"
  const projects = [
    {
      id: "01",
      title: dict.projects.case_study_01.title,
      challenge: dict.projects.case_study_01.challenge,
      idea: dict.projects.case_study_01.idea,
      outcome: dict.projects.case_study_01.outcome,
      image: "/project-1.jpg",
    },
    {
      id: "03",
      title: dict.projects.case_study_02.title,
      challenge: dict.projects.case_study_02.challenge,
      idea: dict.projects.case_study_02.idea,
      outcome: dict.projects.case_study_02.outcome,
      image: "/project-2.jpg",
    },
    {
      id: "03",
      title: dict.projects.case_study_03.title,
      challenge: dict.projects.case_study_03.challenge,
      idea: dict.projects.case_study_03.idea,
      outcome: dict.projects.case_study_03.outcome,
      image: "/project-3.jpg",
    },
  ];

  return (
    <>
      <Navbar dict={dict} isDark={false} />

      <main className="min-h-screen bg-white text-black pt-24 pb-20">
        {/* Cabecera de Página */}
        <div className="px-6 lg:px-24 mb-16">
          <h1 className="font-hand text-6xl md:text-8xl mb-4">
            {dict.projects.title_1}{" "}
            <span className="block md:inline text-gray-400">
              {dict.projects.title_2}
            </span>
          </h1>
          <p className="font-body text-xl max-w-2xl text-gray-600">
            {dict.projects.description}
          </p>
        </div>

        {/* Listado de Proyectos */}
        <section className="flex flex-col gap-24 px-6 lg:px-24">
          {projects.map((project, index) => (
            <div
              key={project.id}
              className="group grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
            >
              {/* Imagen del Proyecto */}
              <div
                className={`relative aspect-video rounded-[40px] overflow-hidden bg-gray-100 ${
                  index % 2 !== 0 ? "lg:order-2" : ""
                }`}
              >
                <Image
                  src={project.image}
                  alt={project.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>

              {/* Texto del Proyecto */}
              <div className="flex flex-col gap-6">
                <span className="font-body text-gray-400 font-bold">
                  {project.id}
                </span>
                <h2 className="font-title text-4xl md:text-5xl leading-none">
                  {project.title}
                </h2>

                <div className="space-y-4">
                  <p className="font-body text-sm text-gray-500">
                    <strong className="text-black block text-base mb-1">
                      {dict.projects.subtitle_challenge}:
                    </strong>{" "}
                    {project.challenge}
                  </p>
                  <p className="font-body text-sm text-gray-500">
                    <strong className="text-black block text-base mb-1">
                      {dict.projects.subtitle_solution}:
                    </strong>{" "}
                    {project.idea}
                  </p>
                  <p className="font-body text-sm text-gray-500">
                    <strong className="text-black block text-base mb-1">
                      {dict.projects.subtitle_results}:
                    </strong>{" "}
                    {project.outcome}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Footer / CTA Final estilo "Tired of talking about metrics?" */}
        <section className="mt-32 mx-6 lg:mx-24 bg-black rounded-[50px] p-12 lg:p-24 text-center text-white">
          <h3 className="font-title text-4xl md:text-6xl mb-8">
            {dict.projects.footer_cta.line_1}
            <br />
            {dict.projects.footer_cta.line_2}
          </h3>
          <div className="flex justify-center">
            <PrimaryButton
              text={dict.projects.buttons.view_case_study}
              isRed={true}
            />
          </div>
        </section>
      </main>
    </>
  );
}
