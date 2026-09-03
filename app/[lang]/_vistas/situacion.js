import Image from "next/image";
import Navbar from "@/app/components/Navbar";
import PrimaryButton from "@/app/components/PrimaryButton";
import { getDictionary } from "@/app/dictionaries";
import { buildAlternates, langPaths } from "@/app/lib/seo/urls";
import { path, pathsOf } from "@/app/lib/routes.mjs";

// Plantilla única de las cuatro páginas de situación. Cada ruta la instancia
// con su clave, así que hay una sola maqueta que mantener.
//
// De momento monta el hero del Anexo A. Los bloques que faltan ("Te suena
// si…", "Qué hacemos", "Lo hemos hecho antes", "Lo que no hacemos" y el
// cierre) entran en la Fase 3, cuando llegue su texto: la página existe ya
// porque el menú apunta aquí y un enlace del menú a un 404 no es entregable.

export function situacion(clave) {
  async function generateMetadata({ params }) {
    const { lang = "en" } = await params;
    const dict = await getDictionary(lang);
    const t = dict.situaciones[clave];
    const rutas = pathsOf(clave);

    return {
      title: { absolute: t.seoTitle },
      description: t.seoDescription,
      alternates: buildAlternates(lang, langPaths(rutas.es, rutas.en)),
      openGraph: {
        title: t.seoTitle,
        description: t.seoDescription,
        url: `https://www.room714.com${rutas[lang]}`,
        type: "website",
      },
    };
  }

  async function Page({ params }) {
    const { lang } = await params;
    const dict = await getDictionary(lang);
    const t = dict.situaciones[clave];

    return (
      <div className="flex flex-col bg-black">
        <Navbar dict={dict} isDark={true} />

        <main className="flex-1 flex flex-col items-center px-4 md:px-8 py-12 md:py-20">
          <header className="w-full max-w-4xl text-center mb-10 md:mb-14">
            <h1 className="font-title font-black text-3xl md:text-5xl lg:text-6xl text-white leading-tight">
              {t.heroTitle}
            </h1>
            <p className="font-body text-base md:text-lg lg:text-xl text-gray-300 mt-8 max-w-3xl mx-auto leading-relaxed">
              {t.heroDescription}
            </p>
          </header>

          <PrimaryButton
            text={dict.situaciones.cta}
            isRed={true}
            href={path("hablemos", lang)}
            track="cta_click"
            trackPlacement={`situacion_${clave}`}
          />
        </main>

        <section className="w-full bg-black">
          <div className="w-[60%] ml-auto leading-0 flex">
            <Image
              src="/skyline.svg"
              alt="City Skyline"
              width={1920}
              height={400}
              className="w-full h-auto block"
            />
          </div>
        </section>
      </div>
    );
  }

  return { Page, generateMetadata };
}
