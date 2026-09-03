// app/page.js
import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
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
import { CANAL } from "@/app/lib/layout";

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
    <div className="flex flex-col bg-black">
      {/* Navbar con modo light */}
      <Navbar dict={dict} isDark={false} />

      {/* Hero Section */}
      <section className="bg-white text-center flex flex-col lg:flex-row items-center z-10">
        <div className="flex pb-10 justify-center w-full">
          <div
            className="relative transition-all duration-300
                 w-[90%]
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

        <div className="px-4 md:px-12 flex flex-col justify-center items-center w-full">
          {/* h1 y no p: la portada no tenía ningún encabezado de primer nivel.
              Las clases son las mismas, así que a la vista no cambia nada. */}
          <h1 className={`font-hand font-black text-red-500 text-2xl md:text-3xl lg:text-5xl leading-[1.45] mb-8 lg:mb-16 md:px-4`}>
            {t.hero.title}
          </h1>
          <p className="font-body text-base md:text-xl lg:text-2xl mb-8 lg:mb-16 md:px-4">
            {t.hero.description}
          </p>
          {/* Dos botones: el primario y el secundario que ya existían */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
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
          <p className="font-body text-xs md:text-sm text-gray-500 mt-6 max-w-xl md:px-4">
            {t.hero.micro}
          </p>
        </div>
      </section>

      {/* Contenedor de la flecha con tamaño basado en Tailwind */}
      <section className="py-12 bg-white text-center flex flex-col items-center z-10 w-full">
        <div className="transition-all duration-300">
          <Image
            src="/arrow.svg"
            alt="Arrow pointing down"
            width={120} // El ancho base del SVG
            height={150} // El alto base del SVG
            className="h-auto w-full priority animate-bounce"
          />
        </div>
      </section>

      {/* ¿Cuál es tu caso? Sustituye al bloque de cinco servicios con la misma
          tarjeta numerada; ahora las cuatro llevan a su página. */}
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
          <h2 className="font-title font-bold text-red-500 text-3xl lg:text-5xl mb-8 leading-tight">
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

          {/* Prueba: un párrafo por caso. Sustituye al carrusel de logos, que
              se muda a "Cómo trabajamos". */}
          <h2 className={`font-hand font-bold text-red-500 text-3xl lg:text-5xl leading-[1.45] mb-10`}>
            {t.prueba.title}
          </h2>

          <div className="flex flex-col gap-6 mb-10">
            {casosDePrueba.map((caso) => (
              <Link
                key={caso.clave}
                href={path(caso.clave, lang)}
                data-track="caso_click"
                data-track-placement={`home_prueba_${caso.clave}`}
                className="group block rounded-4xl overflow-hidden
                  bg-[#F2F2F2]
                  bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)]
                  bg-size-[40px_40px]
                  hover:bg-[#F8F8F8] transition-all duration-500 p-6 lg:p-8"
              >
                <p className="font-body text-base md:text-lg lg:text-2xl leading-normal text-gray-900">
                  {caso.texto}{" "}
                  <span className="font-hand text-red-500 whitespace-nowrap group-hover:underline">
                    → {t.prueba.link}
                  </span>
                </p>
              </Link>
            ))}
          </div>

          <p className="font-body text-sm md:text-base text-gray-500 mb-10 max-w-3xl">
            {t.prueba.disclaimer}
          </p>

          <PrimaryButton
            text={t.buttons.all_cases}
            isRed={true}
            href={path("casos", lang)}
            track="cta_click"
            trackPlacement="home_prueba"
          />
        </div>
      </section>

      {/* Cómo trabajamos: el método en cuatro pasos */}
      <section className={`bg-black rounded-t-[50px] -mt-10 ${CANAL} py-16 relative z-50`}>
        <div className="w-full">
          <h2 className="font-title font-black text-3xl md:text-5xl lg:text-6xl text-white mb-12 leading-tight">
            {t.metodo.title}
          </h2>

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

          <p className={`font-hand text-2xl md:text-3xl lg:text-4xl text-white leading-[1.45] mb-10`}>
            {t.metodo.closing}
          </p>

          <PrimaryButton
            text={t.buttons.how_we_work}
            href={path("comoTrabajamos", lang)}
            track="cta_click"
            trackPlacement="home_metodo"
          />
        </div>
      </section>

      {/* Ideas: tres piezas fijadas a mano */}
      {pinnedPosts.length > 0 && (
        <section className="bg-gray-300 rounded-t-[50px] -mt-10 px-4 md:px-8 py-16 relative z-50">
          <div>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
              <h2 className="font-title font-black text-3xl md:text-5xl lg:text-6xl text-black leading-tight">
                {t.latest.title}
              </h2>
              <Link
                href={path("blog", lang)}
                className="font-hand text-xl md:text-2xl text-red-500 hover:text-red-700 transition-colors shrink-0"
              >
                {t.latest.viewAll}
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
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
        <h2 className="font-title font-black text-3xl md:text-5xl mb-8 mx-auto leading-tight">
          {t.cierre.title}
        </h2>
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

      {/* 1. Contenedor del Skyline: Proporcional y siempre visible */}
      <section className="w-full bg-white overflow-hidden">
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
    </div>
  );
}
