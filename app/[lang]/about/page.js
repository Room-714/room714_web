import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
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
          <p className="font-body text-lg md:text-xl leading-relaxed text-gray-800">
            {dict.about.hero_text}
          </p>
        </section>

        {/* Sección Cita */}
        <section className="px-6 py-20 flex flex-col items-center text-center relative max-w-4xl">
          <span className="text-red-600 text-8xl font-serif absolute top-0 left-6">
            “
          </span>
          <h2 className="font-title text-4xl md:text-6xl leading-tight px-4">
            {dict.about.quotes}
          </h2>
          <span className="text-red-600 text-8xl font-serif absolute bottom-0 right-6">
            ”
          </span>
        </section>

        {/* Sección Oscura: The Rules */}
        <section className="w-full bg-[#111111] rounded-t-[50px] pt-16 pb-24 flex flex-col items-center">
          <h3 className="font-title text-white text-3xl md:text-5xl mb-12 text-center px-6">
            {dict.about.rules.title_line1} <br /> {dict.about.rules.title_line2}
          </h3>

          {/* Slider de Tarjetas */}
          <RulesSlider rules={rules} />
        </section>
      </main>
    </>
  );
}
