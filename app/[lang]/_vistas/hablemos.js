import { getDictionary } from "@/app/dictionaries";
import Navbar from "@/app/components/Navbar";
import Image from "next/image";
import ContactClient from "@/app/components/ContactClient";
import { getInterests } from "@/app/data/Interests";
import { SITE_URL, buildAlternates, langPaths } from "@/app/lib/seo/urls";
import { pathsOf } from "@/app/lib/routes.mjs";

const baseUrl = SITE_URL;

export async function generateMetadata({ params }) {
  const { lang = "en" } = await params;
  const rutas = pathsOf("hablemos");
  const titles = {
    en: "Contact Us",
    es: "Contacto",
  };
  const descriptions = {
    en: "Get in touch with Room 714. Tell us about your project and we'll help you find the right solution.",
    es: "Contacta con Room 714. Cuéntanos tu proyecto y te ayudaremos a encontrar la solución adecuada.",
  };

  return {
    title: titles[lang],
    description: descriptions[lang],
    alternates: buildAlternates(lang, langPaths(rutas.es, rutas.en)),
    openGraph: {
      title: titles[lang],
      description: descriptions[lang],
      url: `${baseUrl}${rutas[lang]}`,
      type: "website",
    },
  };
}

export default async function ContactPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const interests = getInterests(dict);

  return (
    <div className="bg-white flex flex-col">
      <Navbar dict={dict} isDark={true} />
      <ContactClient dict={dict} interests={interests} />
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
