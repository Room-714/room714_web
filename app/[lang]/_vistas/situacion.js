import Image from "next/image";
import Link from "next/link";
import { Phone } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import PrimaryButton from "@/app/components/PrimaryButton";
import { getDictionary } from "@/app/dictionaries";
import { SITE_URL, buildAlternates, langPaths } from "@/app/lib/seo/urls";
import { path, pathsOf } from "@/app/lib/routes.mjs";

// Plantilla única de las cuatro páginas de situación. Cada ruta la instancia
// con su clave, así que hay una sola maqueta que mantener.
//
// Patrón del Anexo A: hero → Te suena si… → Qué hacemos → Lo hemos hecho
// antes → (Con qué hemos convivido) → (Lo que no hacemos) → cierre. Las dos
// secciones entre paréntesis solo existen en algunas páginas, y la plantilla
// las omite cuando no hay texto en lugar de dejar un hueco con título.

function Seccion({ titulo, children, className = "" }) {
  return (
    <section className={`mb-14 lg:mb-20 ${className}`}>
      <h2 className="font-title font-black text-2xl md:text-3xl lg:text-4xl text-white mb-6 leading-tight">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function situacion(clave) {
  async function generateMetadata({ params }) {
    const { lang = "en" } = await params;
    const dict = await getDictionary(lang);
    const t = dict.situaciones[clave];
    const rutas = pathsOf(clave);

    return {
      title: { absolute: t.seoTitle },
      description: t.seoDescription,
      alternates: buildAlternates(lang, langPaths(rutas.es, rutas.en)),
      openGraph: {
        title: t.seoTitle,
        description: t.seoDescription,
        url: `${SITE_URL}${rutas[lang]}`,
        type: "website",
      },
    };
  }

  async function Page({ params }) {
    const { lang } = await params;
    const dict = await getDictionary(lang);
    const t = dict.situaciones[clave];
    const labels = dict.situaciones.labels;

    return (
      <div className="flex flex-col bg-black">
        <Navbar dict={dict} isDark={true} />

        <main className="px-8 sm:px-10 md:px-14 lg:px-22 pt-8 pb-20">
          {/* Hero */}
          <header className="max-w-4xl mb-16 lg:mb-24">
            <h1 className="font-title font-black text-3xl md:text-5xl lg:text-6xl text-white leading-tight mb-8">
              {t.heroTitle}
            </h1>
            <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-300 leading-relaxed mb-10">
              {t.heroDescription}
            </p>
            <PrimaryButton
              text={dict.situaciones.cta}
              isRed={true}
              href={path("hablemos", lang)}
              track="cta_click"
              trackPlacement={`situacion_${clave}_hero`}
            />
          </header>

          <div className="max-w-4xl">
            {/* Te suena si… */}
            <Seccion titulo={labels.teSuena}>
              <ul className="flex flex-col gap-4">
                {t.teSuenaSi.map((linea) => (
                  <li key={linea} className="flex gap-4">
                    <span
                      className="font-hand text-red-500 text-xl md:text-2xl shrink-0 leading-tight"
                      aria-hidden="true"
                    >
                      ·
                    </span>
                    <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-300 leading-relaxed">
                      {linea}
                    </p>
                  </li>
                ))}
              </ul>
            </Seccion>

            {/* Qué hacemos */}
            <Seccion titulo={labels.queHacemos}>
              <div className="flex flex-col gap-6">
                {t.queHacemos.map((paso, index) => (
                  <div key={paso.title} className="flex gap-4 lg:gap-6">
                    <span className="font-hand text-xl md:text-2xl text-red-500 shrink-0 pt-1">
                      {`0${index + 1}`}
                    </span>
                    <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-300 leading-relaxed">
                      <strong className="font-bold text-white">
                        {paso.title}
                      </strong>{" "}
                      {paso.body}
                    </p>
                  </div>
                ))}
              </div>
            </Seccion>

            {/* Lo hemos hecho antes */}
            <Seccion titulo={labels.hechoAntes}>
              <div className="flex flex-col gap-4 mb-8">
                {t.hechoAntes.map((caso) => (
                  <Link
                    key={caso.title}
                    href={path(caso.clave, lang)}
                    data-track="caso_click"
                    data-track-placement={`situacion_${clave}_${caso.clave}`}
                    className="group block rounded-4xl overflow-hidden bg-[#F2F2F2]
                      bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)]
                      bg-size-[40px_40px]
                      hover:bg-[#F8F8F8] transition-all duration-500 p-6 lg:p-8"
                  >
                    <p className="font-body text-base md:text-lg lg:text-xl text-gray-900 leading-relaxed">
                      <strong className="font-bold text-black">
                        {caso.title}
                      </strong>{" "}
                      {caso.body}{" "}
                      <span className="font-hand text-red-500 whitespace-nowrap group-hover:underline">
                        → {labels.verCaso}
                      </span>
                    </p>
                  </Link>
                ))}
              </div>
              <p className="font-body text-base md:text-lg text-gray-400 leading-relaxed">
                <strong className="font-bold text-gray-300">
                  {labels.otros}
                </strong>{" "}
                {t.otros}
              </p>
            </Seccion>

            {/* Con qué hemos convivido: solo "Producto para tu equipo" */}
            {t.convivido && (
              <Seccion titulo={labels.convivido}>
                <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-300 leading-relaxed">
                  {t.convivido}
                </p>
              </Seccion>
            )}

            {/* Lo que no hacemos: no está en las cuatro páginas */}
            {t.noHacemos && (
              <Seccion titulo={labels.noHacemos}>
                <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-300 leading-relaxed">
                  {t.noHacemos}
                </p>
              </Seccion>
            )}
          </div>
        </main>

        {/* Cierre, con el patrón del CTA final del resto del sitio */}
        <section className="relative z-10 w-full bg-white rounded-t-[50px] px-6 py-16 lg:px-16 lg:py-20 text-center text-black">
          <h2 className="font-hand text-3xl md:text-5xl lg:text-6xl mb-8 leading-tight">
            {t.cierre.title}
          </h2>
          <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-700 mb-10 max-w-3xl mx-auto leading-relaxed">
            {t.cierre.body}
          </p>
          <div className="flex justify-center">
            <PrimaryButton
              text={dict.situaciones.cta}
              isRed={true}
              icon={Phone}
              href={path("hablemos", lang)}
              track="cta_click"
              trackPlacement={`situacion_${clave}_cierre`}
            />
          </div>
        </section>

        <section className="w-full bg-white">
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

  return { Page, generateMetadata };
}
