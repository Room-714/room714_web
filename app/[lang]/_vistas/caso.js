import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import PrimaryButton from "@/app/components/PrimaryButton";
import { getDictionary } from "@/app/dictionaries";
import { SITE_URL, buildAlternates, langPaths } from "@/app/lib/seo/urls";
import {
  ORGANIZATION_ID,
  breadcrumbSchema,
  jsonLdGraph,
} from "@/app/lib/seo/schema";
import { path, pathsOf } from "@/app/lib/routes.mjs";
import { AIRE_TRAS_BOTON, CANAL } from "@/app/lib/layout";

// Plantilla única de las tres páginas de caso. Cada ruta la instancia con su
// clave, así que la maqueta se mantiene en un solo sitio.
//
// Sigue el patrón del Anexo A: hero → tres cifras → Contexto → Lo que
// parecía → Lo que era → Qué hicimos → Dónde estamos → (Lo que viene) → Lo
// que nos llevamos → cierre.

function Seccion({ titulo, children }) {
  return (
    <section className="mb-9 lg:mb-12">
      <h2 className="font-title font-black text-2xl md:text-3xl lg:text-4xl text-black mb-5 leading-tight">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

export function caso(clave) {
  async function generateMetadata({ params }) {
    const { lang = "en" } = await params;
    const dict = await getDictionary(lang);
    const t = dict.casos[clave];
    const rutas = pathsOf(clave);

    return {
      title: { absolute: t.seoTitle },
      description: t.seoDescription,
      alternates: buildAlternates(lang, langPaths(rutas.es, rutas.en)),
      openGraph: {
        title: t.seoTitle,
        description: t.seoDescription,
        url: `${SITE_URL}${rutas[lang]}`,
        type: "article",
      },
    };
  }

  async function Page({ params }) {
    const { lang } = await params;
    const dict = await getDictionary(lang);
    const t = dict.casos[clave];
    const labels = dict.casos.labels;
    const rutas = pathsOf(clave);
    const pageUrl = `${SITE_URL}${rutas[lang]}`;

    const jsonLd = jsonLdGraph(
      {
        "@type": "CreativeWork",
        name: t.heroTitle,
        headline: t.heroTitle,
        description: t.seoDescription,
        url: pageUrl,
        author: { "@id": ORGANIZATION_ID },
        inLanguage: lang === "es" ? "es-ES" : "en-US",
      },
      breadcrumbSchema([
        { name: dict.nav.home, url: `${SITE_URL}${path("home", lang)}` },
        { name: dict.nav.casos, url: `${SITE_URL}${path("casos", lang)}` },
        { name: t.heroTitle, url: pageUrl },
      ]),
    );

    return (
      <main className="flex flex-col bg-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Navbar dict={dict} isDark={false} />

        {/* Volver, con el mismo patrón que el artículo del blog */}
        <div className={`relative z-10 w-full ${CANAL} py-6 flex justify-start`}>
          <Link
            href={path("casos", lang)}
            className="group inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors duration-200 font-title text-xs sm:text-sm uppercase tracking-widest"
          >
            <ArrowLeft
              size={18}
              strokeWidth={3}
              className="transform group-hover:-translate-x-1 transition-transform duration-200"
            />
            <span>{dict.nav.casos}</span>
          </Link>
        </div>

        <article className={`${CANAL} pb-16`}>
          <div className="w-full">
            {/* Hero */}
            <header className="mb-9 lg:mb-12">
              <h1 className="font-title font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-black leading-tight mb-6">
                {t.heroTitle}
              </h1>
              <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-700 leading-normal">
                {t.heroSubtitle}
              </p>
            </header>

            {/* Tres cifras, con el fondo de cuadrícula de la tarjeta de
                proyecto y su línea roja de acento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
              {t.cifras.map((cifra) => (
                <div
                  key={cifra.etiqueta}
                  className="rounded-4xl overflow-hidden
                    bg-[#F2F2F2]
                    bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)]
                    bg-size-[40px_40px]"
                >
                  <div className="h-2 w-full bg-red-700" />
                  {/* h-full y justify-between: las tres etiquetas apoyan en
                      la misma línea de base aunque las cifras midan distinto.
                      Y la cifra no se parte: "+200 → <20" se rompía en dos
                      líneas y empujaba su etiqueta hacia abajo. */}
                  <div className="px-6 py-8 flex flex-col h-full">
                    <p className="font-hand font-black text-red-500 text-2xl md:text-3xl lg:text-4xl whitespace-nowrap mb-6">
                      {cifra.valor}
                    </p>
                    <p className="font-body text-sm md:text-base text-gray-700 leading-snug mt-auto">
                      {cifra.etiqueta}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Seccion titulo={labels.contexto}>
              <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-800 leading-normal">
                {t.contexto}
              </p>
            </Seccion>

            <Seccion titulo={labels.parecia}>
              <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-800 leading-normal">
                {t.parecia}
              </p>
            </Seccion>

            <Seccion titulo={labels.era}>
              <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-800 leading-normal">
                {t.era}
              </p>
            </Seccion>

            <Seccion titulo={labels.hicimos}>
              <div className="flex flex-col gap-6">
                {t.hicimos.map((paso, index) => (
                  <div key={paso.title} className="flex gap-4 lg:gap-6">
                    <span className="font-hand text-xl md:text-2xl text-red-500 shrink-0 pt-1">
                      {`0${index + 1}`}
                    </span>
                    <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-800 leading-normal">
                      <strong className="font-bold text-black">
                        {paso.title}
                      </strong>{" "}
                      {paso.body}
                    </p>
                  </div>
                ))}
              </div>
            </Seccion>

            <Seccion titulo={labels.donde}>
              <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-800 leading-normal">
                {t.donde}
              </p>
            </Seccion>

            {/* Solo el primer caso tiene "Lo que viene" */}
            {t.viene && (
              <Seccion titulo={labels.viene}>
                <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-800 leading-normal">
                  {t.viene}
                </p>
              </Seccion>
            )}

            <Seccion titulo={labels.llevamos}>
              <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-800 leading-normal">
                {t.llevamos}
              </p>
            </Seccion>
          </div>
        </article>

        {/* Cierre, con el patrón del CTA final de Casos */}
        <section className="relative z-10 w-full bg-gray-300 rounded-t-[50px] px-8 py-20 md:px-20 md:py-28 text-center text-black">
          <h2 className="font-hand text-3xl md:text-4xl lg:text-5xl mb-10 mx-auto max-w-4xl leading-[1.45]">
            {t.cierre}
          </h2>
          <div className={`flex justify-center ${AIRE_TRAS_BOTON}`}>
            <PrimaryButton
              text={labels.cta}
              isRed={true}
              icon={Phone}
              href={path("hablemos", lang)}
              track="cta_click"
              trackPlacement={`caso_${clave}`}
            />
          </div>
        </section>

        <section className="w-full bg-gray-300">
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
      </main>
    );
  }

  return { Page, generateMetadata };
}
