import Link from "next/link";
import { ArrowLeft, ArrowDown } from "lucide-react";
import { getDictionary } from "@/app/dictionaries";
import Navbar from "@/app/components/Navbar";
import OfertaChat from "@/app/components/OfertaChat";
import { SITE_URL, buildAlternates, langPaths } from "@/app/lib/seo/urls";
import { socialMeta } from "@/app/lib/seo/social";
import {
  breadcrumbSchema,
  jobPostingSchema,
  jsonLdGraph,
} from "@/app/lib/seo/schema";
import { path, pathsOf } from "@/app/lib/routes.mjs";

// Plantilla de una oferta de empleo: el texto de la oferta y, debajo, el
// chat de candidatura con el puesto ya fijado. Cada ruta (una carpeta por idioma) la
// instancia con su oferta de app/data/ofertas.js.
//
// La página es el enlace que se comparte en LinkedIn, así que el botón de
// arriba lleva directo al formulario: quien llega ya ha leído la oferta allí.
// Lleva JobPosting para Google Empleos; la candidatura se hace aquí mismo
// (directApply), sin email ni mailto.

export function oferta(datos) {
  async function generateMetadata({ params }) {
    const { lang = "es" } = await params;
    const t = datos[lang];
    const rutas = pathsOf(datos.ruta);
    return {
      title: { absolute: t.seo.title },
      description: t.seo.description,
      alternates: buildAlternates(lang, langPaths(rutas.es, rutas.en)),
      ...socialMeta({
        lang,
        title: t.seo.title,
        description: t.seo.description,
        url: `${SITE_URL}${rutas[lang]}`,
      }),
    };
  }

  async function Page({ params }) {
    const { lang } = await params;
    const dict = await getDictionary(lang);
    const t = datos[lang];
    const c = dict.careers;
    const pageUrl = `${SITE_URL}${path(datos.ruta, lang)}`;

    const jsonLd = jsonLdGraph(
      jobPostingSchema({ oferta: datos, lang, url: pageUrl }),
      breadcrumbSchema([
        { name: dict.nav.home, url: `${SITE_URL}${path("home", lang)}` },
        { name: dict.nav.careers, url: `${SITE_URL}${path("empleo", lang)}` },
        { name: t.titulo, url: pageUrl },
      ]),
    );

    return (
      <div className="flex flex-col bg-black min-h-screen">
        <script
          type="application/ld+json"
          // La descripción del JobPosting es HTML: se escapa «<» para que
          // ningún «</script>» pueda cerrar la etiqueta.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <Navbar dict={dict} isDark={true} />

        <main className="flex-1 flex flex-col items-center px-4 md:px-8 pb-12 md:pb-20">
          <div className="w-full max-w-3xl py-6">
            <Link
              href={path("empleo", lang)}
              className="group inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors duration-200 font-title text-xs sm:text-sm uppercase tracking-widest"
            >
              <ArrowLeft
                size={18}
                strokeWidth={3}
                className="transform group-hover:-translate-x-1 transition-transform duration-200"
              />
              <span>{c.oferta.volver}</span>
            </Link>
          </div>

          <article className="w-full max-w-3xl">
            <header className="mb-10 md:mb-12">
              <p className="font-hand text-xl md:text-2xl text-red-500 mb-3">
                {c.abiertas.label}
              </p>
              <h1 className="font-title font-black text-4xl md:text-6xl text-white leading-tight">
                {t.titulo}
              </h1>
              <p className="font-title font-bold text-base md:text-lg text-white mt-4">
                {t.condiciones}
              </p>
              <p className="font-body text-base md:text-lg lg:text-xl text-gray-300 mt-6 leading-relaxed">
                {t.entradilla}
              </p>
              <a
                href="#inscribete"
                className="mt-8 inline-flex items-center gap-2 bg-red-600 text-white font-title font-bold uppercase tracking-wide px-8 py-4 rounded-full hover:bg-red-700 transition-colors"
              >
                <span>{t.cta}</span>
                <ArrowDown size={18} strokeWidth={3} />
              </a>
            </header>

            {t.secciones.map((s) => (
              <section key={s.titulo} className="mb-10 md:mb-12">
                <h2 className="font-title font-black text-2xl md:text-3xl text-white mb-5">
                  {s.titulo}
                </h2>
                {s.enLinea && (
                  <p className="font-body text-base md:text-lg text-gray-300 leading-relaxed">
                    {s.enLinea.join(" · ")}.
                  </p>
                )}
                {s.puntos && (
                  <ul className="space-y-3">
                    {s.puntos.map((texto) => (
                      <li
                        key={texto}
                        className="relative pl-6 font-body text-base md:text-lg text-gray-300 leading-relaxed"
                      >
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-[0.7em] w-2 h-2 rounded-full bg-red-500"
                        />
                        {texto}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </article>

          <section id="inscribete" className="w-full scroll-mt-8 mt-4">
            <header className="w-full max-w-3xl mx-auto mb-8">
              <h2 className="font-title font-black text-3xl md:text-5xl text-white leading-tight">
                {t.postular.titulo}
              </h2>
              <p className="font-body text-base md:text-lg text-gray-300 mt-4 leading-relaxed">
                {t.postular.texto}
              </p>
            </header>

            <OfertaChat dict={dict} lang={lang} position={datos.position} />
          </section>
        </main>
      </div>
    );
  }

  return { Page, generateMetadata };
}
