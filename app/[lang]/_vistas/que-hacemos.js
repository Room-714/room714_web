import Image from "next/image";
import Navbar from "@/app/components/Navbar";
import ServiceCard from "@/app/components/ServiceCard";
import { getDictionary } from "@/app/dictionaries";
import { getSituacionesData } from "@/app/data/Situaciones";
import { buildAlternates, langPaths } from "@/app/lib/seo/urls";
import { path, pathsOf } from "@/app/lib/routes.mjs";

// Índice de "Qué hacemos". El nav es una lista plana de enlaces y no soporta
// submenú, así que en lugar de rediseñarlo, esta página hace de submenú: las
// cuatro situaciones con la misma tarjeta numerada que la portada.

export async function generateMetadata({ params }) {
  const { lang = "en" } = await params;
  const dict = await getDictionary(lang);
  const rutas = pathsOf("queHacemos");

  return {
    title: { absolute: dict.situaciones.indice.seoTitle },
    description: dict.situaciones.indice.seoDescription,
    alternates: buildAlternates(lang, langPaths(rutas.es, rutas.en)),
  };
}

export default async function QueHacemosPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const situaciones = getSituacionesData(dict);

  return (
    <div className="flex flex-col bg-black">
      <Navbar dict={dict} isDark={true} />

      <section className="bg-black pt-8 pb-16 lg:pb-20">
        <div className="md:sticky top-12 mb-16 lg:mb-20 h-12 flex items-center justify-center px-4 md:px-8 lg:px-40">
          <h1 className="text-white z-30 font-title font-bold text-2xl md:text-4xl lg:text-5xl text-center px-2 md:px-8 lg:px-16 leading-tight">
            {dict.situaciones.indice.title}
          </h1>
        </div>

        {situaciones.map((situacion, index) => (
          <div
            key={situacion.clave}
            className="md:sticky w-full"
            style={{ top: "140px", marginBottom: "40px", zIndex: 40 + index }}
          >
            <ServiceCard
              number={situacion.number}
              image={situacion.image}
              title={situacion.title}
              description={situacion.description}
              cta={situacion.cta}
              href={path(situacion.clave, lang)}
              track="situacion_click"
              trackPlacement={`indice_${situacion.clave}`}
            />
          </div>
        ))}
      </section>

      <section className="w-full bg-black">
        <div className="w-[60%] ml-auto leading-0 flex">
          <Image
            src="/skyline.svg"
            alt="City Skyline"
            width={1920}
            height={400}
            className="w-full h-auto block"
          />
        </div>
      </section>
    </div>
  );
}
