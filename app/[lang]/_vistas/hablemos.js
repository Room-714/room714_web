import { getDictionary } from "@/app/dictionaries";
import Navbar from "@/app/components/Navbar";
import Image from "next/image";
import ContactClient from "@/app/components/ContactClient";
import { SITE_URL, buildAlternates, langPaths } from "@/app/lib/seo/urls";
import { pathsOf } from "@/app/lib/routes.mjs";

const baseUrl = SITE_URL;

export async function generateMetadata({ params }) {
  const { lang = "en" } = await params;
  const rutas = pathsOf("hablemos");
  const dict = await getDictionary(lang);

  return {
    title: { absolute: dict.contact.seo.title },
    description: dict.contact.seo.description,
    alternates: buildAlternates(lang, langPaths(rutas.es, rutas.en)),
    openGraph: {
      title: dict.contact.seo.title,
      description: dict.contact.seo.description,
      url: `${baseUrl}${rutas[lang]}`,
      type: "website",
    },
  };
}

export default async function ContactPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <div className="bg-white flex flex-col">
      <Navbar dict={dict} isDark={true} />
      <ContactClient dict={dict} />
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
