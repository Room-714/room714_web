import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
import Navbar from "@/app/components/Navbar";
import RulesSlider from "@/app/components/RulesSlider";
import { getRules } from "@/app/data/Rules";

export default async function AboutPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const rules = getRules(dict);

  return (
    <div className="bg-red-700 flex flex-col">
      {/* Este fondo "empujará" hasta el footer */}
      <Navbar dict={dict} isDark={false} />
      <main className="flex flex-col items-center overflow-x-hidden">
        {/* Sección Hero / Intro */}
        <section className="w-full px-2 py-24 bg-white flex flex-col items-center text-center">
          {/* Contenedor principal de los elementos del hero */}
          <div className="w-full flex items-center justify-center gap-1 pr-4">
            <h1 className="font-body font-extrabold text-6xl md:text-7xl lg:text-9xl leading-tight text-black">
              {dict.about.title}
            </h1>
            {/* Contenedor de la imagen/flecha */}
            <div className="relative w-20 h-30 md:w-24 md:h-36 lg:w-32 lg:h-48 mt-4">
              <Image
                src="/about/curve-arrow.svg"
                alt="Room 714 arrow"
                fill
                className="object-contain"
                priority // Añadimos priority al ser parte del Hero
              />
            </div>
          </div>
          {/* El texto del diccionario */}
          <div className="w-[60%] ml-auto">
            <p className="font-hand text-center text-lg md:text-2xl lg:text-4xl leading-tight text-black mt-4 px-2">
              Room <span className="text-red-500">714</span>.{" "}
              {dict.about.hero_text}
            </p>
          </div>
        </section>
        {/* Sección Cita */}
        <section className="px-2 pt-10 pb-20 bg-white flex flex-col items-center text-center w-full">
          <h2 className="font-body font-black text-xl md:text-3xl lg:text-5xl leading-tight">
            {dict.about.quotes_line1}
          </h2>
          <h2 className="font-hand text-2xl md:text-4xl lg:text-6xl leading-tight">
            {dict.about.quotes_line2}
          </h2>
          <div className="relative w-[80%] md:w-[60%] lg:w-[40%] h-6 md:h-8">
            <Image
              src="/about/line.svg"
              alt="line decoration"
              fill
              className="object-contain"
            />
          </div>
        </section>
        {/* Sección Oscura: The Rules */}
        <section className="w-full bg-red-700 mt-4 py-16 flex flex-col items-center gap-2">
          <h3 className="font-body text-white font-black text-2xl md:text-4xl text-center px-6">
            {dict.about.rules.title_line1}
          </h3>
          {/* Contenedor relativo para centrar sus hijos */}
          <div className="relative flex mb-4 items-center justify-center">
            {/* El texto va primero o después, pero con z-index alto */}
            <h3 className="relative z-20 font-hand text-white text-4xl md:text-5xl text-center px-12">
              {dict.about.rules.title_line2}
            </h3>
            {/* El círculo se posiciona absoluto para "flotar" detrás del texto */}
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

          {/* Slider de Tarjetas */}
          <RulesSlider rules={rules} />
        </section>
      </main>
      {/* 1. Contenedor del Skyline: Proporcional y siempre visible */}
      <section className="w-full bg-red-700">
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
