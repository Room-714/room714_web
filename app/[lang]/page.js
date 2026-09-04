// app/page.js
import { getDictionary } from "@/app/dictionaries";
import Link from "next/link";
import { Phone } from "lucide-react";
import ServiceCard from "@/app/components/ServiceCard";
import PrimaryButton from "@/app/components/PrimaryButton";
import Navbar from "@/app/components/Navbar";
import BlogCard from "@/app/components/BlogCard";
import { getSituacionesData } from "@/app/data/Situaciones";
import { getAllPosts, ordenarPorSlugs } from "@/app/lib/blog";
import { PINNED_COUNT, PINNED_SLUGS } from "@/app/data/PinnedPosts";
import { path } from "@/app/lib/routes.mjs";
import { buildAlternates, samePath } from "@/app/lib/seo/urls";
import {
  AIRE_TRAS_BOTON,
  CANAL,
  TARJETA_ROJA,
  TITULAR,
} from "@/app/lib/layout";

export async function generateMetadata({ params }) {
  const { lang = "en" } = await params;
  const dict = await getDictionary(lang);

  return {
    // `absolute` porque el título del Anexo A ya nombra la marca.
    title: { absolute: dict.home.seo.title },
    description: dict.home.seo.description,
    alternates: buildAlternates(lang, samePath("")),
  };
}

export default async function Home({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const t = dict.home;
  const situaciones = getSituacionesData(dict);
  // Tres piezas fijadas a mano por situación, no las últimas por fecha.
  const pinnedPosts = ordenarPorSlugs(
    await getAllPosts(lang),
    PINNED_SLUGS[lang] ?? [],
    PINNED_COUNT,
  );
  const BLOB_URL =
    "https://tzhsvjcv6h2qp8xy.public.blob.vercel-storage.com/Animacion%20final.mp4";

  // Los tres casos del bloque de prueba, en el orden del Anexo A.
  const casosDePrueba = [
    { clave: "saasAutogestion", texto: t.prueba.casos.saasAutogestion },
    { clave: "activacionCanonico", texto: t.prueba.casos.activacionCanonico },
    { clave: "iaEcommerce", texto: t.prueba.casos.iaEcommerce },
  ];

  const diferencia = [
    t.diferencia.num_1,
    t.diferencia.num_2,
    t.diferencia.num_3,
  ];
  const metodo = [
    t.metodo.num_1,
    t.metodo.num_2,
    t.metodo.num_3,
    t.metodo.num_4,
  ];

  return (
    <div className="flex flex-col bg-black overflow-x-clip">
      {/* Navbar con modo light */}
      <Navbar dict={dict} isDark={false} />

      {/* Hero Section */}
      <section className="bg-white text-center flex flex-col lg:flex-row items-center z-10">
        <div className="flex pb-4 md:pb-10 justify-center w-full">
          <div
            className="relative transition-all duration-300
                 w-[74%] sm:w-[80%] md:w-[70%] lg:w-[90%]
                 max-w-200
                 aspect-square
                 overflow-hidden"
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="w-full h-full object-contain"
            >
              <source src={BLOB_URL} type="video/mp4" />
            </video>
          </div>
        </div>

        {/* En móvil el aire se recorta y el interlineado se aprieta para que
            los dos botones entren en la primera pantalla en cualquier
            dispositivo: eran 8 y 16 de margen entre bloques, más el
            interlineado del titular a mano, y no cabían. */}
        <div className={`px-4 md:px-12 flex flex-col justify-center items-center w-full ${AIRE_TRAS_BOTON}`}>
          <h1 className="font-hand font-black text-red-500 text-2xl md:text-3xl lg:text-5xl leading-[1.35] md:leading-[1.45] mb-5 md:mb-8 lg:mb-12 md:px-4">
            {t.hero.title}
          </h1>
          <p className="font-body text-sm md:text-xl lg:text-2xl leading-normal mb-6 md:mb-8 lg:mb-12 md:px-4">
            {t.hero.description}
          </p>
          {/* Los dos botones del sistema: primario y secundario. En móvil van
              en fila, que es lo que hace que quepan. */}
          <div className="flex flex-row items-center justify-center gap-3 sm:gap-4 flex-wrap">
            <PrimaryButton
              text={t.buttons.tell_us}
              isRed={true}
              href={path("hablemos", lang)}
              track="cta_click"
              trackPlacement="home_hero"
            />
            <PrimaryButton
              text={t.buttons.see_cases}
              href={path("casos", lang)}
              track="cta_click"
              trackPlacement="home_hero_casos"
            />
          </div>
        </div>
      </section>

      {/* Aquí iba /arrow.svg, y ES la raya que se veía entre los botones y
          el bloque siguiente. No es un problema de tamaño: el metadato de
          filtro del propio SVG declara que su tinta mide 13,4 × 212,3 dentro
          de un lienzo de 375 × 293, situada al 48% del ancho. Es un trazo
          vertical de ratio 1:16, no una flecha, así que a cualquier tamaño
          se lee como una raya (a lg:w-56 eran 8 px de ancho por 127 de alto).

          La sección se queda, vacía y blanca: son los 96 px de alto que el
          bloque negro de abajo necesita para morder con su -mt-10 y que sus
          esquinas redondeadas se lean contra el blanco. Quitar la sección
          entera es lo que la vez anterior dejó el bloque negro tapando los
          botones.

          Para poner una flecha de verdad hace falta otro asset. */}
      <section className="py-12 bg-white w-full" aria-hidden="true" />

      {/* ¿Cuál es tu caso? Sustituye al bloque de cinco servicios con la misma
          tarjeta numerada; ahora las cuatro llevan a su página.

          El -mt-10 sube el bloque 40 px sobre la sección de la flecha: es lo
          que hace que sus esquinas redondeadas se lean contra el blanco de
          arriba. */}
      <section className="bg-black rounded-t-[50px] -mt-10 pt-20 pb-8 mb-4 z-20 relative">
        <div className="block w-full mx-auto">
          <div className="md:sticky top-12 mb-16 lg:mb-20 h-12 flex items-center justify-center px-4 md:px-8 lg:px-40">
            <h2 className="text-white z-30 font-title font-bold text-2xl md:text-4xl lg:text-5xl text-center px-2 md:px-8 lg:px-16 leading-tight">
              {t.situaciones.title}
            </h2>
          </div>
          {/* Dynamic mapping of Service Cards */}
          {situaciones.map((situacion, index) => {
            return (
              <div
                key={situacion.clave}
                className="md:sticky w-full"
                style={{
                  top: "140px",
                  marginBottom: "40px",
                  zIndex: 40 + index,
                }}
              >
                <ServiceCard
                  number={situacion.number}
                  image={situacion.image}
                  title={situacion.title}
                  description={situacion.description}
                  cta={situacion.cta}
                  href={path(situacion.clave, lang)}
                  track="situacion_click"
                  trackPlacement={`home_${situacion.clave}`}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Vale, pero ¿qué hacéis exactamente? y la prueba. Los dos en blanco,
          donde antes vivía el bloque de clientes. */}
      <section className={`bg-white rounded-t-[50px] overflow-hidden ${CANAL} py-16 lg:py-16 z-50 relative`}>
        <div className="w-full">
          <h2 className={`font-title font-bold text-red-500 ${TITULAR} mb-8`}>
            {t.diferencia.title}
          </h2>
          <p className="font-body text-xl lg:text-3xl leading-normal text-black mb-12">
            {t.diferencia.lead}
          </p>

          <div className="flex flex-col gap-6 lg:gap-8 mb-20">
            {diferencia.map((entrada, index) => (
              <div key={entrada.title} className="flex gap-4 lg:gap-8">
                <span className="font-hand text-xl md:text-2xl lg:text-3xl text-red-500 shrink-0 pt-1">
                  {`0${index + 1}`}
                </span>
                <div>
                  <h3 className="font-title font-bold text-xl md:text-2xl lg:text-3xl text-black mb-2 uppercase">
                    {entrada.title}
                  </h3>
                  <p className="font-body text-lg md:text-xl lg:text-2xl leading-normal text-gray-700">
                    {entrada.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Rótulo a mano que separa la lista numerada de las tarjetas */}
          <p className={`font-hand text-red-500 ${TITULAR} leading-[1.45] mb-8`}>
            {t.prueba.rotulo}
          </p>

          {/* La prueba: un párrafo por caso, sin titular propio, sin el
              aviso de confidencialidad y sin enlace por caso. El enlace en
              formato texto no está en el sistema de diseño; para ir a los
              casos está el botón de abajo.

              Tres columnas solo en escritorio, que es donde caben verticales.
              En tablet y en móvil van horizontales, a una columna. Sin filete
              rojo, y con la tarjeta de fondo rojo muy claro y cuadrícula
              gris. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 items-stretch">
            {casosDePrueba.map((caso) => (
              <div key={caso.clave} className={TARJETA_ROJA}>
                <div className="p-6 lg:p-10">
                  <p className="font-hand text-lg md:text-xl lg:text-2xl leading-[1.45] text-gray-900">
                    {caso.texto}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className={AIRE_TRAS_BOTON}>
            <PrimaryButton
              text={t.buttons.all_cases}
              isRed={true}
              href={path("casos", lang)}
              track="cta_click"
              trackPlacement="home_prueba"
            />
          </div>
        </div>
      </section>

      {/* Cómo trabajamos: el método en cuatro pasos */}
      <section className={`bg-black rounded-t-[50px] -mt-10 ${CANAL} py-16 relative z-50`}>
        <div className="w-full">
          {/* Mismo tamaño de titular que el bloque anterior: este iba a
              text-6xl y el de "¿qué hacéis?" a text-5xl, y se notaba. */}
          <h2 className={`font-title font-bold text-white ${TITULAR} mb-8`}>
            {t.metodo.title}
          </h2>

          {/* "Quien te atiende es quien hace el trabajo" va ENCIMA de la
              lista, no debajo: es la premisa, no la conclusión. */}
          <p className="font-hand text-2xl md:text-3xl lg:text-4xl text-white leading-[1.45] mb-10">
            {t.metodo.closing}
          </p>

          <div className="flex flex-col gap-6 lg:gap-8 mb-12">
            {metodo.map((paso, index) => (
              <div key={paso.title} className="flex gap-4 lg:gap-8">
                <span className="font-hand text-xl md:text-2xl lg:text-3xl text-red-500 shrink-0 pt-1">
                  {`0${index + 1}`}
                </span>
                <div>
                  <h3 className="font-title font-bold text-xl md:text-2xl lg:text-3xl text-white mb-2 uppercase">
                    {paso.title}
                  </h3>
                  <p className="font-body text-lg md:text-xl lg:text-2xl leading-normal text-gray-300">
                    {paso.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className={AIRE_TRAS_BOTON}>
            <PrimaryButton
              text={t.buttons.how_we_work}
              href={path("comoTrabajamos", lang)}
              track="cta_click"
              trackPlacement="home_metodo"
            />
          </div>
        </div>
      </section>

      {/* Ideas: cuatro piezas fijadas a mano.
          Con bastante aire debajo de las tarjetas, y mayor que el token
          general (AIRE_TRAS_BOTON): la sección siguiente se sube 40 px con su
          -mt-10, así que se los come del padding de abajo. */}
      {pinnedPosts.length > 0 && (
        <section
          className="bg-gray-300 rounded-t-[50px] -mt-10 px-4 md:px-8 pt-16 pb-28 md:pb-36 lg:pb-44 relative z-50"
        >
          <div>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
              <h2 className={`font-title font-bold text-black ${TITULAR}`}>
                {t.latest.title}
              </h2>
              <Link
                href={path("blog", lang)}
                className="font-hand text-xl md:text-2xl text-red-500 hover:text-red-700 transition-colors shrink-0"
              >
                {t.latest.viewAll}
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
              {pinnedPosts.map((post) => (
                <BlogCard
                  key={post.id}
                  post={post}
                  lang={lang}
                  dict={dict.blog}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cierre, con el mismo patrón que el CTA final de Casos */}
      <section className="relative z-50 -mt-10 w-full bg-white rounded-t-[50px] px-6 py-16 lg:px-16 lg:py-16 text-center text-black">
        <h2 className={`font-title font-black ${TITULAR} mb-4`}>
          {t.cierre.title}
        </h2>
        <p className="font-hand text-red-500 text-3xl md:text-4xl lg:text-5xl mb-8 leading-[1.45]">
          {t.cierre.subtitle}
        </p>
        <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-700 mb-10 max-w-3xl mx-auto leading-normal">
          {t.cierre.description}
        </p>
        <div className="flex justify-center">
          <PrimaryButton
            text={t.buttons.tell_us}
            isRed={true}
            icon={Phone}
            href={path("hablemos", lang)}
            track="cta_click"
            trackPlacement="home_cierre"
          />
        </div>
      </section>

    </div>
  );
}
