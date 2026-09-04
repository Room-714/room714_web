import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
import { Phone } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import PrimaryButton from "@/app/components/PrimaryButton";
import RulesSlider from "@/app/components/RulesSlider";
import { getRules } from "@/app/data/Rules";
import { SITE_URL, buildAlternates, langPaths } from "@/app/lib/seo/urls";
import { path, pathsOf } from "@/app/lib/routes.mjs";
import { LINKEDIN_FOUNDER, withUtm } from "@/app/lib/links";
import { AIRE_TRAS_BOTON, CANAL } from "@/app/lib/layout";

export async function generateMetadata({ params }) {
  const { lang = "en" } = await params;
  const dict = await getDictionary(lang);
  const rutas = pathsOf("comoTrabajamos");

  return {
    // `absolute` porque el título del Anexo A ya nombra la marca.
    title: { absolute: dict.about.seo.title },
    description: dict.about.seo.description,
    alternates: buildAlternates(lang, langPaths(rutas.es, rutas.en)),
    openGraph: {
      title: dict.about.seo.title,
      description: dict.about.seo.description,
      url: `${SITE_URL}${rutas[lang]}`,
      type: "website",
    },
  };
}

export default async function ComoTrabajamosPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const t = dict.about;
  const rules = getRules(dict);

  return (
    <div className="bg-white flex flex-col">
      {/* Blanco, no rojo: el rojo asomaba por las esquinas redondeadas de
          las secciones de abajo y dejaba dos piquitos en cada una. */}
      <Navbar dict={dict} isDark={false} />
      <main className="flex flex-col items-center overflow-x-hidden">
        {/* Hero. El titular baja de escala respecto al diseño anterior: el
            del Anexo A tiene 48 caracteres y el que había ("quiénes somos")
            catorce; al tamaño original ocupaba la pantalla entera.

            La flecha que iba entre titular y entradilla ya no está: no
            señalaba a nada en ninguna anchura. El gesto lo dan ahora las dos
            alineaciones, titular a la izquierda y entradilla a la derecha. */}
        <section className={`w-full ${CANAL} py-16 bg-white flex flex-col`}>
          {/* Una frase por línea. El titular son dos frases cortas y
              partirlas por donde caiga el ancho las deja a media idea. */}
          <h1 className="font-body font-extrabold text-3xl md:text-5xl lg:text-7xl leading-tight text-black text-left mb-8">
            {t.hero.title
              .split(". ")
              .filter(Boolean)
              .map((frase, i, todas) => (
                <span key={frase} className="block">
                  {i < todas.length - 1 ? `${frase}.` : frase}
                </span>
              ))}
          </h1>

          <p className="font-hand text-xl md:text-3xl lg:text-4xl text-red-500 text-right w-full md:w-[60%] md:ml-auto leading-[1.45]">
            {t.hero.description}
          </p>
        </section>

        {/* El método */}
        <section className={`w-full bg-white ${CANAL} pb-16`}>
          <div className="w-full">
            <h2 className="font-title font-black text-2xl md:text-4xl lg:text-5xl text-black mb-10 leading-tight">
              {t.metodo.title}
            </h2>
            <div className="flex flex-col gap-6">
              {t.metodo.pasos.map((paso, index) => (
                <div key={paso.title} className="flex gap-4 lg:gap-6">
                  <span className="font-hand text-xl md:text-2xl lg:text-3xl text-red-500 shrink-0 pt-1 leading-[1.45]">
                    {`0${index + 1}`}
                  </span>
                  <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-700 leading-normal">
                    <strong className="font-bold text-black">
                      {paso.title}
                    </strong>{" "}
                    {paso.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quién está detrás */}
        <section
          className={`w-full bg-gray-300 rounded-t-[50px] -mt-10 relative ${CANAL} pt-16 pb-16`}
        >
          <div className="w-full">
            <h2 className="font-title font-black text-2xl md:text-4xl lg:text-5xl text-black mb-10 leading-tight">
              {t.quien.title}
            </h2>

            <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
              <Image
                src="/about/jose-antonio-ces.jpg"
                alt={t.quien.nombre}
                width={320}
                height={320}
                className="rounded-full shrink-0 w-32 h-32 lg:w-40 lg:h-40 object-cover"
              />
              <div>
                <p className="font-title font-bold text-xl md:text-2xl lg:text-3xl text-black mb-1">
                  {t.quien.nombre}
                </p>
                <p className="font-hand text-lg md:text-xl lg:text-2xl text-red-500 mb-6">
                  {t.quien.cargo}
                </p>
                <p className="font-hand text-xl md:text-2xl lg:text-3xl text-black mb-6 leading-[1.45]">
                  «{t.quien.cita}»
                </p>
                <p className="font-body text-base md:text-lg lg:text-xl text-gray-700 leading-normal mb-6">
                  {t.quien.bio}
                </p>
                {/* El mismo botón redondo del footer, aquí a la cuenta
                    personal del fundador y no a la de la empresa. */}
                <a
                  href={withUtm(LINKEDIN_FOUNDER, {
                    campaign: "web",
                    content: "como-trabajamos",
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-track-placement="como-trabajamos"
                  className="inline-block p-2 bg-white rounded-full hover:opacity-70 transition-opacity"
                >
                  <Image
                    src="/linkedin.svg"
                    alt="LinkedIn"
                    width={30}
                    height={30}
                  />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* En qué creemos: los cuatro valores que ya existían, con su
            slider */}
        <section className="w-full bg-red-700 rounded-t-[50px] -mt-10 relative z-10 pt-16 pb-20 flex flex-col items-center gap-2">
          <h2 className="font-body text-white font-black text-3xl md:text-5xl text-center px-6">
            {t.rules.title_line1}
          </h2>
          <div className="relative flex mb-4 items-center justify-center">
            <p className="relative z-20 font-hand text-white text-5xl md:text-6xl text-center px-12 leading-[1.45]">
              {t.rules.title_line2}
            </p>
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="relative w-[80%] md:max-w-100 h-24 md:h-36">
                <Image
                  src="/about/circle.svg"
                  alt="line decoration"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </div>

          <RulesSlider rules={rules} />
        </section>

        {/* Lo que no hacemos. En blanco y redondeada arriba, como la roja:
            las dos son tarjetas apiladas. Cierra la página, así que el botón
            va dentro y ya no hace falta una sección aparte para él. */}
        <section
          className={`w-full bg-white rounded-t-[50px] -mt-10 relative z-20 ${CANAL} pt-16`}
        >
          <div className="w-full">
            <h2 className="font-title font-black text-2xl md:text-4xl lg:text-5xl text-black mb-10 leading-tight">
              {t.noHacemos.title}
            </h2>
            <ul className="flex flex-col gap-5 mb-12">
              {t.noHacemos.items.map((item) => (
                <li key={item} className="flex gap-4">
                  <span
                    className="font-hand text-red-500 text-2xl md:text-3xl shrink-0"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                  <p className="font-body text-xl md:text-2xl lg:text-3xl text-gray-700 leading-normal">
                    {item}
                  </p>
                </li>
              ))}
            </ul>
            <div className={`flex justify-center ${AIRE_TRAS_BOTON}`}>
              <PrimaryButton
                text={t.cta}
                isRed={true}
                icon={Phone}
                href={path("hablemos", lang)}
                track="cta_click"
                trackPlacement="como_trabajamos_cierre"
              />
            </div>
          </div>
        </section>
      </main>

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
    </div>
  );
}
