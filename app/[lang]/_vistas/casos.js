import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
import { Phone } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import PrimaryButton from "@/app/components/PrimaryButton";
import ProjectsList from "@/app/components/ProjectList";
import ClientLogos from "@/app/components/ClientLogos";
import { getProjectsData } from "@/app/data/Projects";
import { buildAlternates, langPaths } from "@/app/lib/seo/urls";
import { ORGANIZATION_ID, jsonLdGraph } from "@/app/lib/seo/schema";
import { CASOS, path, pathsOf } from "@/app/lib/routes.mjs";
import { AIRE_TRAS_BOTON, CANAL, TARJETA, TITULAR } from "@/app/lib/layout";

export async function generateMetadata({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const rutas = pathsOf("casos");

  return {
    // `absolute` porque el título del Anexo A ya nombra la marca.
    title: { absolute: dict.casos.indice.seoTitle },
    description: dict.casos.indice.seoDescription,
    // Sin esto, Next fusiona los metadatos con los del layout y la página
    // hereda la canónica de la portada: le declara a Google que es una copia
    // de la portada, y Google deja de indexarla.
    alternates: buildAlternates(lang, langPaths(rutas.es, rutas.en)),
  };
}

export default async function CasosPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const t = dict.casos;
  const projects = getProjectsData(dict);

  // Los tres casos con página propia, en el orden del Anexo A.
  const destacados = Object.keys(CASOS).map((clave) => ({
    clave,
    ...t[clave],
  }));

  // JSON-LD: la lista de los tres casos destacados más los proyectos cortos.
  const jsonLd = jsonLdGraph({
    "@type": "ItemList",
    name: t.indice.title,
    description: t.indice.lead,
    itemListElement: [
      ...destacados.map((caso, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "CreativeWork",
          name: caso.heroTitle,
          description: caso.seoDescription,
          url: `https://www.room714.com${path(caso.clave, lang)}`,
          author: { "@id": ORGANIZATION_ID },
        },
      })),
      ...projects.map((project, index) => ({
        "@type": "ListItem",
        position: destacados.length + index + 1,
        item: {
          "@type": "CreativeWork",
          name: project.title,
          description: `${project.challenge} ${project.outcome}`,
          author: { "@id": ORGANIZATION_ID },
        },
      })),
    ],
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar dict={dict} isDark={true} />

      <main className="min-h-screen bg-black text-white pt-16 mb-20">
        {/* Cabecera de Página. El titular va partido en dos: la primera
            mitad en tipografía de titular y la segunda a mano y en rojo, como
            el cierre de la portada. */}
        <div className={`${CANAL} mb-16`}>
          <h1 className="font-body font-black text-4xl md:text-6xl lg:text-7xl mb-4 leading-tight">
            {t.indice.title}
          </h1>
          <p className="font-hand text-red-500 text-3xl md:text-4xl lg:text-5xl mb-8 leading-[1.45]">
            {t.indice.subtitle}
          </p>
          <p className="font-body text-xl lg:text-2xl max-w-3xl text-gray-300 leading-normal mb-6">
            {t.indice.lead}
          </p>
          <p className="font-body text-xl lg:text-2xl max-w-3xl text-gray-300 leading-normal">
            {t.indice.lead2}
          </p>
        </div>

        {/* Los tres casos con página propia.

            La tarjeta ya no es un enlace: lleva dentro el botón primario, y
            un <a> dentro de otro <a> no es HTML válido. La analítica se va con
            el botón, que ya sabe emitirla. */}
        <div className={`${CANAL} mb-24 flex flex-col gap-6`}>
          {destacados.map((caso, index) => (
            <div key={caso.clave} className={TARJETA}>
              <div className="px-6 py-8 lg:px-10 lg:py-10">
                <div className="flex items-start gap-4 lg:gap-6">
                  <span className="font-hand font-black text-red-500 text-2xl md:text-3xl lg:text-4xl shrink-0 leading-[1.45]">
                    {`0${index + 1}`}
                  </span>
                  <div>
                    <h2 className="font-title font-bold text-black text-xl md:text-2xl lg:text-4xl leading-tight mb-4">
                      {caso.heroTitle}
                    </h2>
                    <p className="font-body text-gray-700 text-base md:text-lg lg:text-2xl leading-normal mb-6">
                      {caso.heroSubtitle}
                    </p>
                    <PrimaryButton
                      text={t.labels.verCaso}
                      isRed={true}
                      href={path(caso.clave, lang)}
                      track="caso_click"
                      trackPlacement={`indice_${caso.clave}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Los proyectos anteriores, como listado secundario y con el mismo
            acordeón que ya tenían */}
        <div className={`${CANAL} mb-8`}>
          <h2 className="font-hand text-3xl md:text-5xl text-white leading-[1.45]">
            {t.indice.secondaryTitle}
          </h2>
        </div>
        <div className={`${CANAL} pb-30`}>
          <ProjectsList
            projects={projects}
            dict={dict}
            desde={destacados.length}
          />
        </div>
      </main>

      {/* Cierre, con el mismo bloque que cierra la portada: titular, rótulo
          a mano en rojo y botón. */}
      <section className="relative z-10 -mt-30 w-full bg-white rounded-t-[50px] px-6 py-16 lg:px-16 lg:py-16 text-center text-black">
        <h2 className={`font-title font-black ${TITULAR} mb-4`}>
          {dict.projects.footer_cta.line_1}
        </h2>
        <p className="font-hand text-red-500 text-3xl md:text-4xl lg:text-5xl mb-8 leading-[1.45]">
          {dict.projects.footer_cta.line_2}
        </p>
        <div className={`flex justify-center ${AIRE_TRAS_BOTON}`}>
          <PrimaryButton
            text={t.labels.cta}
            isRed={true}
            icon={Phone}
            href={path("hablemos", lang)}
            track="cta_click"
            trackPlacement="casos_cierre"
          />
        </div>
      </section>

      {/* Los logos de clientes, que vivían en Nosotros. Su sitio es este:
          después de los casos, quién los encargó. Los degradados de los
          laterales del carrusel van a blanco, así que la sección lo es. */}
      <section className="w-full bg-white flex flex-col items-center">
        <ClientLogos alts={t.logos} />
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
