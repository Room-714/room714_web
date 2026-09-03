import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
import { Phone } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import PrimaryButton from "@/app/components/PrimaryButton";
import RulesSlider from "@/app/components/RulesSlider";
import ClientLogos from "@/app/components/ClientLogos";
import { getRules } from "@/app/data/Rules";
import { SITE_URL, buildAlternates, langPaths } from "@/app/lib/seo/urls";
import { path, pathsOf } from "@/app/lib/routes.mjs";
import { LINKEDIN_FOUNDER, withUtm } from "@/app/lib/links";
import { CANAL } from "@/app/lib/layout";

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
        {/* Hero. Dos cosas heredadas del diseño anterior:
            - El titular baja de escala. El del Anexo A tiene 48 caracteres y
              el que había ("quiénes somos") catorce; al tamaño original
              ocupaba la pantalla entera.
            - La flecha vuelve a apuntar a algo. Curva hacia abajo y a la
              derecha, y en la maqueta original señalaba al párrafo, que iba
              desplazado a la derecha. Al centrar yo el párrafo, la flecha se
              quedó apuntando al vacío. */}
        <section className={`w-full ${CANAL} py-16 bg-white flex flex-col`}>
          {/* Una frase por línea. El titular son dos frases cortas y
              partirlas por donde caiga el ancho las deja a media idea. */}
          <h1 className="font-body font-extrabold text-3xl md:text-5xl lg:text-7xl leading-tight text-black">
            {t.hero.title
              .split(". ")
              .filter(Boolean)
              .map((frase, i, todas) => (
                <span key={frase} className="block">
                  {i < todas.length - 1 ? `${frase}.` : frase}
                </span>
              ))}
          </h1>

          {/* La flecha arranca debajo del final del titular y baja hacia la
              izquierda del párrafo, que va desplazado a la derecha. */}
          <div className="w-full flex mt-2">
            <div className="hidden md:block md:w-[34%]" />
            <div className="relative w-14 h-20 md:w-20 md:h-28 lg:w-24 lg:h-36 shrink-0">
              <Image
                src="/about/curve-arrow.svg"
                alt=""
                aria-hidden="true"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>

          <p className="font-hand text-lg md:text-2xl lg:text-3xl text-black w-full md:w-[60%] md:ml-auto leading-[1.45]">
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
        <section className={`w-full bg-gray-300 ${CANAL} py-16`}>
          <div className="w-full">
            <h2 className="font-title font-black text-2xl md:text-4xl lg:text-5xl text-black mb-10 leading-tight">
              {t.quien.title}
            </h2>

            <div className="flex flex-col md:flex-row gap-8 lg:gap-12 mb-10">
              {/* Foto: placeholder hasta que haya una de verdad */}
              <Image
                src="/author-placeholder.svg"
                alt={t.quien.nombre}
                width={160}
                height={160}
                className="rounded-full shrink-0 w-32 h-32 lg:w-40 lg:h-40"
              />
              <div>
                <p className="font-title font-bold text-xl md:text-2xl lg:text-3xl text-black mb-1">
                  {t.quien.nombre}
                </p>
                <p className="font-hand text-lg md:text-xl lg:text-2xl text-red-500 mb-6">
                  {t.quien.cargo}
                </p>
                <p className="font-body text-base md:text-lg lg:text-xl text-gray-700 leading-normal mb-6">
                  {t.quien.bio}
                </p>
                <p className="font-hand text-xl md:text-2xl lg:text-3xl text-black mb-6 leading-[1.45]">
                  «{t.quien.cita}»
                </p>
                <p className="font-body text-base md:text-lg text-gray-700 leading-normal mb-6">
                  {t.quien.cierreBio}
                </p>
                <a
                  href={withUtm(LINKEDIN_FOUNDER, {
                    campaign: "web",
                    content: "como-trabajamos",
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-track-placement="como-trabajamos"
                  className="font-hand text-lg md:text-xl text-red-500 hover:underline"
                >
                  LinkedIn →
                </a>
              </div>
            </div>

            <p className="font-body text-base md:text-lg lg:text-xl text-gray-700 leading-normal">
              {t.quien.equipo}
            </p>
          </div>
        </section>

        {/* En qué creemos: los cuatro valores que ya existían, con su
            slider */}
        <section className="w-full bg-red-700 py-16 flex flex-col items-center gap-2">
          <h2 className="font-body text-white font-black text-2xl md:text-4xl text-center px-6">
            {t.rules.title_line1}
          </h2>
          <div className="relative flex mb-4 items-center justify-center">
            <p className="relative z-20 font-hand text-white text-4xl md:text-5xl text-center px-12 leading-[1.45]">
              {t.rules.title_line2}
            </p>
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="relative w-[80%] md:max-w-100 h-20 md:h-32">
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

        {/* Lo que no hacemos */}
        <section className={`w-full bg-black ${CANAL} py-16`}>
          <div className="w-full">
            <h2 className="font-title font-black text-2xl md:text-4xl lg:text-5xl text-white mb-10 leading-tight">
              {t.noHacemos.title}
            </h2>
            <ul className="flex flex-col gap-4">
              {t.noHacemos.items.map((item) => (
                <li key={item} className="flex gap-4">
                  <span
                    className="font-hand text-red-500 text-xl md:text-2xl shrink-0"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                  <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-300 leading-normal">
                    {item}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Sectores: aquí es donde viven ahora los logos de clientes. En la
            portada su sitio lo ocupa el bloque de prueba con los tres casos,
            que dice bastante más que seis logos sin contexto. */}
        <section className="w-full bg-white pt-16 pb-10 flex flex-col items-center text-center">
          <h2 className="font-title font-bold text-red-500 text-2xl md:text-4xl lg:text-5xl px-6 mb-6 leading-tight">
            {t.sectors.title}
          </h2>
          <p className="font-body text-base md:text-lg lg:text-xl text-gray-700 px-6 mb-10 leading-normal">
            {t.sectoresLista}
          </p>
          <ClientLogos alts={t.sectors.logos} />
        </section>

        {/* Cierre */}
        <section className="w-full bg-white px-6 pb-16 flex justify-center">
          <PrimaryButton
            text={t.cta}
            isRed={true}
            icon={Phone}
            href={path("hablemos", lang)}
            track="cta_click"
            trackPlacement="como_trabajamos_cierre"
          />
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
