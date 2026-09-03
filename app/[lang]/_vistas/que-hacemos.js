import Image from "next/image";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { getDictionary } from "@/app/dictionaries";
import { getSituacionesData } from "@/app/data/Situaciones";
import { buildAlternates, langPaths } from "@/app/lib/seo/urls";
import { path, pathsOf } from "@/app/lib/routes.mjs";
import { CANAL, SUBTITULAR, TARJETA_ENLACE, TITULAR } from "@/app/lib/layout";

// Índice de "Qué hacemos". El nav es una lista plana de enlaces y no soporta
// submenú, así que esta página hace de submenú.
//
// NO repite el formato de la portada. Allí las cuatro situaciones van en una
// pila de tarjetas grandes con ilustración, que ocupa cuatro pantallas: es un
// argumento que se lee de arriba abajo. Aquí la página es un índice, y lo que
// hace falta es verlas las cuatro de un vistazo y elegir. Así que rejilla de
// dos por dos, sin tarjeta y sin ilustración: número, título, una línea y el
// enlace.
//
// Los iconos que usa la portada (services_01…04.svg) se dibujaron para los
// cinco servicios antiguos; asignarlos a las cuatro situaciones era
// arbitrario, y repetirlos aquí lo era dos veces.

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

      <main className={`${CANAL} pt-8 pb-24`}>
        <header className={` mb-14 lg:mb-20`}>
          <h1 className={`font-title font-black text-white ${TITULAR}`}>
            {dict.situaciones.indice.title}
          </h1>
        </header>

        {/* Superficie de tarjeta clara, la misma que usan las tarjetas de
            caso en el resto del sitio: en negro a pelo esto quedaba
            oscurísimo. Y el hover cambia UNA cosa, el fondo, como las demás
            tarjetas: antes se teñían de rojo el borde, el título y el enlace
            a la vez. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {situaciones.map((situacion) => (
            <Link
              key={situacion.clave}
              href={path(situacion.clave, lang)}
              data-track="situacion_click"
              data-track-placement={`indice_${situacion.clave}`}
              className={`group flex flex-col ${TARJETA_ENLACE}`}
            >
              <div className="h-2 w-full bg-red-700" />
              <div className="px-6 py-8 lg:px-10 lg:py-10 flex flex-col h-full">
                <span className="font-hand font-black text-red-500 text-2xl md:text-3xl block mb-4">
                  {situacion.number}
                </span>
                <h2 className={`font-title font-bold text-black ${SUBTITULAR} mb-4`}>
                  {situacion.title}
                </h2>
                <p className="font-body text-base md:text-lg text-gray-700 leading-relaxed mb-8">
                  {situacion.description}
                </p>
                <span className="font-hand text-red-500 text-lg md:text-xl mt-auto group-hover:underline">
                  {situacion.cta}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>

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
