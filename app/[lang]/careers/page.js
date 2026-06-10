import { getDictionary } from "@/app/dictionaries";
import Navbar from "@/app/components/Navbar";
import CareersWizard from "@/app/components/CareersWizard";
import Image from "next/image";

const baseUrl = "https://www.room714.com";

export async function generateMetadata({ params }) {
  const { lang = "en" } = await params;
  const titles = {
    en: "Careers — Join Room 714",
    es: "Empleo — Únete a Room 714",
  };
  const descriptions = {
    en: "Send us your CV. We review every profile in product, design, usability and engineering. Quick wizard, AI-assisted screening, honest feedback.",
    es: "Envíanos tu CV. Revisamos cada perfil en producto, diseño, usabilidad y tecnología. Wizard breve, criba asistida por IA, feedback honesto.",
  };

  return {
    title: titles[lang],
    description: descriptions[lang],
    alternates: {
      canonical: `${baseUrl}/${lang}/careers`,
      languages: {
        "en-US": `${baseUrl}/en/careers`,
        "es-ES": `${baseUrl}/es/careers`,
        "x-default": `${baseUrl}/en/careers`,
      },
    },
    openGraph: {
      title: titles[lang],
      description: descriptions[lang],
      url: `${baseUrl}/${lang}/careers`,
      type: "website",
    },
  };
}

export default async function CareersPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const t = dict.careers;

  return (
    <div className="flex flex-col bg-black min-h-screen">
      <Navbar dict={dict} isDark={true} />

      <main className="flex-1 flex flex-col items-center px-4 md:px-8 py-12 md:py-20">
        {/* Hero header */}
        <header className="w-full max-w-4xl text-center mb-10 md:mb-14">
          <h1 className="font-title font-black text-4xl md:text-6xl lg:text-7xl text-white leading-tight">
            {t.hero.title}
          </h1>
          <p className="font-hand text-2xl md:text-4xl text-red-500 mt-3">
            {t.hero.tagline}
          </p>
          <p className="font-body text-base md:text-lg lg:text-xl text-gray-300 mt-6 max-w-2xl mx-auto leading-relaxed">
            {t.hero.lead}
          </p>
        </header>

        {/* Disclaimer */}
        <aside className="w-full max-w-3xl mb-10 bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6">
          <p className="font-hand text-red-500 text-base md:text-lg mb-2">
            {t.disclaimer.label}
          </p>
          <p className="font-body text-sm md:text-base text-gray-200 leading-relaxed">
            {t.disclaimer.body}
          </p>
        </aside>

        {/* Wizard */}
        <div className="w-full">
          <CareersWizard dict={dict} lang={lang} />
        </div>
      </main>

      {/* Skyline */}
      <section className="w-full bg-black">
        <div className="w-[60%] ml-auto leading-0 flex">
          <Image
            src="/skyline.svg"
            alt="City Skyline"
            width={1920}
            height={400}
            className="w-full h-auto block invert opacity-20"
            priority
          />
        </div>
      </section>
    </div>
  );
}
