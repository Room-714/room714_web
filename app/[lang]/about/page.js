import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
import { Quote } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import RulesSlider from "@/app/components/RulesSlider";

export default async function AboutPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  // Datos para las "Rules" (idealmente en tu diccionario)
  const rules = [
    {
      id: "01",
      title: dict.about.rules.rule_1.title,
      description: dict.about.rules.rule_1.description,
    },
    {
      id: "02",
      title: dict.about.rules.rule_2.title,
      description: dict.about.rules.rule_2.description,
    },
    {
      id: "03",
      title: dict.about.rules.rule_3.title,
      description: dict.about.rules.rule_3.description,
    },
  ];

  return (
    <>
      <Navbar dict={dict} isDark={false} />

      <main className="flex flex-col items-center overflow-x-hidden">
        {/* Sección Hero / Intro */}
        <section className="px-6 py-12 flex flex-col items-center text-center max-w-2xl">
          <div className="relative w-48 h-64 mb-8">
            <Image
              src="/about.svg"
              alt="Room 714 Door"
              fill
              className="object-contain"
            />
          </div>
          <p className="font-body text-lg md:text-xl leading-6 text-black">
            {dict.about.hero_text}
          </p>
        </section>

        {/* Sección Cita */}
        <section className="px-6 py-24 flex flex-col items-center text-center relative max-w-4xl mx-auto">
          {/* Icono de apertura */}
          <Quote
            className="text-red-600 absolute top-6 md:top-0 left-0 md:-left-8 rotate-180"
            size={60}
            strokeWidth={1.5}
            fill="currentColor"
          />

          <h2 className="font-title text-4xl md:text-6xl leading-tight px-4 z-10">
            {dict.about.quotes}
          </h2>

          {/* Icono de cierre (rotado 180 grados) */}
          <Quote
            className="text-red-600 absolute bottom-6 md:bottom-0 right-0 md:-right-8"
            size={60}
            strokeWidth={1.5}
            fill="currentColor"
          />
        </section>

        {/* Sección Oscura: The Rules */}
        <section className="w-full min-h-200 bg-black rounded-t-[50px] mt-4 py-16 flex flex-col items-center">
          <h3 className="font-title text-white font-black text-3xl md:text-5xl mb-6 text-center px-6">
            {dict.about.rules.title_line1} <br /> {dict.about.rules.title_line2}
          </h3>

          {/* Slider de Tarjetas */}
          <RulesSlider rules={rules} />
        </section>
      </main>
    </>
  );
}
