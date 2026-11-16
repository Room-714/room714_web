import Image from "next/image";
import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import PrimaryButton from "@/app/components/PrimaryButton";
import CapturaCampana from "@/app/components/incorporarIa/CapturaCampana";
import DibujoRobots from "@/app/components/incorporarIa/DibujoRobots";
import FormularioLanding from "@/app/components/incorporarIa/FormularioLanding";
import InventarioIA from "@/app/components/incorporarIa/InventarioIA";
import { getDictionary } from "@/app/dictionaries";
import { SITE_URL } from "@/app/lib/seo/urls";
import { socialMeta } from "@/app/lib/seo/social";
import { jsonLdGraph, serviceSchema } from "@/app/lib/seo/schema";
import { path } from "@/app/lib/routes.mjs";
import { CANAL } from "@/app/lib/layout";
import {
  ANCLA_FORMULARIO,
  ANCLA_INVENTARIO,
  INCORPORAR_IA as T,
} from "@/app/data/incorporarIa";

// Landing de campaña «Incorporar la IA en tu empresa».
//
// Solo en castellano: /en/<ruta> redirige a la portada inglesa (guardasSoloEs
// en routes.mjs) y, por si acaso, aquí cualquier otro idioma es un 404.
// Fuera del menú principal; se enlaza desde el footer.
//
// Cinco bloques que alternan fondo como la portada: negro (hero, problema e
// inventario) → blanco (lo que tienes) → negro (cómo) → blanco (formulario,
// que enlaza con el skyline). Tipografías,
// tarjetas, listas y botones son los del resto del sitio.

const CLAVE = "incorporarIa";
const URL_PAGINA = `${SITE_URL}${path(CLAVE, "es")}`;

// La tarjeta clara con cuadrícula de "Lo hemos hecho antes".
const TARJETA = `rounded-4xl bg-[#F2F2F2]
  bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)]
  bg-size-[40px_40px] p-6 lg:p-8`;

const H2 = "font-title font-black text-2xl md:text-4xl lg:text-5xl leading-tight";
const TEXTO = "font-body text-lg md:text-xl lg:text-2xl leading-normal";

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (lang !== "es") notFound();

  return {
    title: { absolute: T.seo.title },
    description: T.seo.description,
    // Canónica a sí misma, sin parámetros, y solo hreflang es: no hay versión
    // inglesa ni x-default para esta página.
    alternates: {
      canonical: URL_PAGINA,
      languages: { es: URL_PAGINA },
    },
    ...socialMeta({
      lang: "es",
      title: T.seo.title,
      description: T.seo.description,
      url: URL_PAGINA,
    }),
  };
}

export default async function IncorporarIaPage({ params }) {
  const { lang } = await params;
  if (lang !== "es") notFound();

  const dict = await getDictionary("es");
  // El BreadcrumbList y el Organization los emite el layout; aquí va el Service.
  const serviceJsonLd = jsonLdGraph(
    serviceSchema({
      clave: CLAVE,
      lang: "es",
      url: URL_PAGINA,
      description: T.seo.description,
    }),
  );
  const aFormulario = `#${ANCLA_FORMULARIO}`;

  return (
    <div className="flex flex-col bg-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <CapturaCampana />
      {/* El selector de idioma lleva a la portada inglesa: esta página no
          tiene versión en inglés. */}
      <Navbar
        dict={dict}
        isDark={true}
        alternatePaths={{ es: path(CLAVE, "es"), en: path("home", "en") }}
      />

      <main className={`${CANAL} pt-8 pb-24`}>
        {/* 1. Hero. El H1 es el antetítulo (la búsqueda objetivo); el
            titular grande es texto destacado, no un segundo H1. */}
        <header className="max-w-5xl mb-16 lg:mb-24">
          <h1 className="font-title font-bold text-base md:text-lg lg:text-xl uppercase text-gray-300 mb-4">
            {T.hero.antetitulo}
          </h1>
          <p className="font-title font-black text-4xl md:text-6xl lg:text-7xl text-white leading-tight mb-6">
            {T.hero.titular}
          </p>
          <p className="font-hand text-red-500 text-2xl md:text-3xl lg:text-4xl mb-8 leading-[1.45]">
            {T.hero.subtitulo}
          </p>
          <p className={`${TEXTO} text-gray-300 max-w-4xl mb-10`}>
            {T.hero.texto}
          </p>
          <div className="flex flex-wrap gap-4">
            <PrimaryButton
              text={T.hero.ctaPrincipal}
              isRed={true}
              href={aFormulario}
              track="cta_click"
              trackPlacement="incorporar_ia_hero"
            />
            <PrimaryButton
              text={T.hero.ctaSecundario}
              href={`#${ANCLA_INVENTARIO}`}
              track="cta_click"
              trackPlacement="incorporar_ia_hero_inventario"
            />
          </div>
          <p className="font-body text-sm md:text-base text-gray-400 leading-normal mt-6">
            {T.hero.nota}
          </p>
        </header>

        {/* 2. El problema: dibujo a la izquierda, texto alineado a la derecha */}
        <section className="mb-12 lg:mb-16 grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-8 lg:gap-12 items-center">
          <DibujoRobots className="w-full max-w-sm mx-auto lg:max-w-none" />
          <div className="text-right">
            <h2 className={`${H2} text-white mb-8`}>{T.problema.titulo}</h2>
            <ul className="flex flex-col gap-5 mb-8">
              {T.problema.puntos.map((linea) => (
                <li key={linea} className="flex flex-row-reverse gap-4">
                  <span
                    className="font-hand text-red-500 text-xl md:text-2xl shrink-0 leading-tight"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                  <p className={`${TEXTO} text-gray-300`}>{linea}</p>
                </li>
              ))}
            </ul>
            <p className="font-hand text-red-500 text-2xl md:text-3xl lg:text-4xl leading-[1.45]">
              {T.problema.remate}
            </p>
          </div>
        </section>

        {/* El inventario, como comprobación del problema */}
        <section id={ANCLA_INVENTARIO} className="scroll-mt-28">
          <h2 className="font-title font-black text-xl md:text-2xl lg:text-3xl text-white mb-3 leading-tight">
            {T.inventario.titulo}
          </h2>
          <p className="font-body text-base md:text-lg lg:text-xl text-gray-300 leading-normal mb-6 max-w-4xl">
            {T.inventario.texto}
          </p>
          <InventarioIA />
        </section>
      </main>

      {/* 3. Lo que tienes en tres meses */}
      <section
        className={`w-full bg-white text-black rounded-t-[50px] relative z-10 ${CANAL} pt-16 pb-24 lg:pt-20 lg:pb-28`}
      >
        <h2 className={`${H2} mb-10 max-w-4xl`}>{T.resultados.titulo}</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {T.resultados.tarjetas.map((c, i) => (
            <div key={c.titulo} className={TARJETA}>
              <span className="font-hand text-red-500 text-xl md:text-2xl leading-[1.45]">
                {`0${i + 1}`}
              </span>
              <h3 className="font-title font-black text-xl md:text-2xl text-black mt-2 mb-3 leading-tight">
                {c.titulo}
              </h3>
              <p className="font-body text-base md:text-lg text-gray-900 leading-normal">
                {c.texto}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Cómo lo hacemos */}
      <section
        className={`w-full bg-black text-white rounded-t-[50px] -mt-10 relative z-20 ${CANAL} pt-16 pb-24 lg:pt-20 lg:pb-28`}
      >
        <h2 className={`${H2} mb-10 max-w-4xl`}>{T.como.titulo}</h2>
        <ol className="flex flex-col mb-8">
          {T.como.pasos.map((p) => (
            <li
              key={p.titulo}
              className="grid md:grid-cols-[14rem_1fr] gap-1 md:gap-8 border-t border-white/20 py-6"
            >
              <p className="font-hand text-red-500 text-xl md:text-2xl leading-[1.45]">
                {p.cuando}
              </p>
              <p className={`${TEXTO} text-gray-300`}>
                <strong className="font-bold text-white">{p.titulo}</strong>{" "}
                {p.texto}
              </p>
            </li>
          ))}
        </ol>
        <p className="font-body text-base md:text-lg lg:text-xl text-gray-400 leading-normal mb-10">
          {T.como.remate}
        </p>
        <PrimaryButton
          text={T.hero.ctaPrincipal}
          isRed={true}
          href={aFormulario}
          track="cta_click"
          trackPlacement="incorporar_ia_como"
        />
      </section>

      {/* 5. Cierre y formulario, sobre blanco: enlaza con el skyline */}
      <section
        id={ANCLA_FORMULARIO}
        className={`w-full bg-white text-black rounded-t-[50px] -mt-10 relative z-30 scroll-mt-20 ${CANAL} pt-16 pb-20`}
      >
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          <div>
            <h2 className="font-hand text-3xl md:text-4xl lg:text-5xl mb-6 leading-[1.45]">
              {T.cierre.titulo}
            </h2>
            <p className={`${TEXTO} text-gray-700 mb-8`}>{T.cierre.texto}</p>
            <div className="flex items-center gap-4">
              <Image
                src="/about/jose-antonio-ces.jpg"
                alt=""
                width={128}
                height={128}
                className="rounded-full shrink-0 w-16 h-16 object-cover"
              />
              <p className="font-body text-base md:text-lg text-gray-700 leading-normal">
                {T.cierre.firma}
              </p>
            </div>
          </div>
          <FormularioLanding dict={dict} />
        </div>
      </section>

      <section className="w-full bg-white">
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
