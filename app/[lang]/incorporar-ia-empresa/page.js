import Image from "next/image";
import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import PrimaryButton from "@/app/components/PrimaryButton";
import CapturaCampana from "@/app/components/incorporarIa/CapturaCampana";
import DibujoRobots from "@/app/components/incorporarIa/DibujoRobots";
import CandadoAbierto from "@/app/components/incorporarIa/CandadoAbierto";
import InventarioIA from "@/app/components/incorporarIa/InventarioIA";
import { getDictionary } from "@/app/dictionaries";
import { SITE_URL } from "@/app/lib/seo/urls";
import { socialMeta } from "@/app/lib/seo/social";
import { jsonLdGraph, serviceSchema } from "@/app/lib/seo/schema";
import { path } from "@/app/lib/routes.mjs";
import { CANAL } from "@/app/lib/layout";
import { ANCLA_FORMULARIO, INCORPORAR_IA as T } from "@/app/data/incorporarIa";

// Landing de campaña «Incorporar la IA en tu empresa».
//
// Solo en castellano: /en/<ruta> redirige a la portada inglesa (guardasSoloEs
// en routes.mjs) y, por si acaso, aquí cualquier otro idioma es un 404.
// Fuera del menú principal; se enlaza desde el footer.
//
// Bloques redondeados que se solapan y alternan fondo, como la portada:
// negro (hero con el dibujo) → rojo (el problema) → blanco (los dos frentes
// de la colaboración) → negro (lo que te queda) → blanco (formulario, que
// enlaza con el skyline). Un único objetivo: vender la colaboración; el
// inventario de IA está aparcado. Tipografías, tarjetas y botones son los del
// resto del sitio.

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

      <main className={`${CANAL} pt-8 pb-28 lg:pb-32`}>
        {/* 1. Hero a dos columnas: el problema y la oferta a la izquierda, el
            dibujo (tus empleados con la IA desbocada) a la derecha. El
            titular es el H1; la búsqueda objetivo va en el title y la
            description. */}
        <header className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-10 lg:gap-12 items-center">
          <div>
            {/* Una línea por elemento: así no queda una palabra huérfana */}
            <h1 className="font-title font-black text-4xl md:text-5xl lg:text-[2.4rem] leading-tight text-white mb-6">
              {T.hero.titular.map((frase) => (
                <span key={frase} className="block">
                  {frase}
                </span>
              ))}
            </h1>
            <p className="font-hand text-red-500 text-2xl md:text-3xl lg:text-4xl mb-8 leading-[1.45]">
              {T.hero.subtitulo}
            </p>
            <p className={`${TEXTO} text-gray-300 mb-10`}>{T.hero.texto}</p>
            <PrimaryButton
              text={T.hero.cta}
              isRed={true}
              href={aFormulario}
              track="cta_click"
              trackPlacement="incorporar_ia_hero"
            />
          </div>
          <DibujoRobots className="w-full max-w-md mx-auto lg:max-w-none" />
        </header>
      </main>

      {/* 2. El problema, en una banda roja redondeada (el recurso de «En
          qué creemos»): el candado abierto a la izquierda y el texto alineado
          a la derecha. */}
      <section
        className={`w-full bg-red-700 text-white rounded-t-[50px] -mt-10 relative z-1 ${CANAL} pt-16 pb-24 lg:pt-20 lg:pb-28`}
      >
        <div className="grid md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-10 lg:gap-16 items-center">
          <CandadoAbierto className="w-44 md:w-full max-w-xs mx-auto" />
          <div className="text-right">
            <h2 className={`${H2} mb-8`}>{T.problema.titulo}</h2>
            <p className={`${TEXTO} text-white/90 mb-8`}>
              {T.problema.puntos.join(" ")}
            </p>
            <p className="font-hand text-white text-2xl md:text-3xl lg:text-4xl leading-[1.45]">
              {T.problema.remate}
            </p>
          </div>
        </div>
      </section>

      {/* 3. La propuesta: los dos ejes, a la vez */}
      <section
        className={`w-full bg-white text-black rounded-t-[50px] -mt-10 relative z-2 ${CANAL} pt-16 pb-24 lg:pt-20 lg:pb-28`}
      >
        <h2 className={`${H2} mb-10 max-w-4xl`}>{T.frentes.titulo}</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {T.frentes.bloques.map((b) => (
            <div key={b.titulo} className={`${TARJETA} flex flex-col`}>
              <h3 className="font-title font-black text-xl md:text-2xl lg:text-3xl text-black mb-4 leading-tight">
                {b.titulo}
              </h3>
              <p className="font-body text-base md:text-lg lg:text-xl text-gray-900 leading-normal">
                {b.texto}
              </p>
            </div>
          ))}
        </div>
        <PrimaryButton
          text={T.hero.cta}
          isRed={true}
          href={aFormulario}
          track="cta_click"
          trackPlacement="incorporar_ia_frentes"
        />
      </section>

      {/* 4. Lo que te queda */}
      <section
        className={`w-full bg-black text-white rounded-t-[50px] -mt-10 relative z-3 ${CANAL} pt-16 pb-24 lg:pt-20 lg:pb-28`}
      >
        <h2 className={`${H2} mb-10 max-w-4xl`}>{T.queda.titulo}</h2>
        <ul className="grid md:grid-cols-2 gap-x-12">
          {T.queda.puntos.map((p, i) => (
            <li
              key={p}
              className="flex gap-5 items-baseline border-t border-white/20 py-6"
            >
              <span className="font-hand text-red-500 text-xl md:text-2xl leading-[1.45] shrink-0">
                {`0${i + 1}`}
              </span>
              <span className={`${TEXTO} text-gray-200`}>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. Hablemos: inventario de IA, sobre blanco: enlaza con el skyline */}
      <section
        id={ANCLA_FORMULARIO}
        className={`w-full bg-white text-black rounded-t-[50px] -mt-10 relative z-4 scroll-mt-20 ${CANAL} pt-16 pb-20`}
      >
        {/* En móvil: título → cuestionario → ficha, para que «Hablemos»
            lleve directo a las preguntas. En escritorio: título y ficha a la
            izquierda, cuestionario a la derecha. */}
        <div className="grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] gap-x-16 gap-y-10">
          <div>
            <h2 className={`${H2} mb-6`}>{T.cierre.titulo}</h2>
            <p className="font-hand text-red-500 text-2xl md:text-3xl leading-[1.45]">
              {T.cierre.texto}
            </p>
          </div>
          <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <InventarioIA />
          </div>
          {/* Quién está detrás, con la foto de «Nosotros», y Room 714 */}
          <div className="flex flex-col sm:flex-row gap-6 lg:col-start-1">
            <Image
              src="/about/jose-antonio-ces.jpg"
              alt={T.cierre.quien.nombre}
              width={320}
              height={320}
              className="rounded-full shrink-0 w-28 h-28 lg:w-32 lg:h-32 object-cover"
            />
            <div>
              <p className="font-title font-bold text-xl md:text-2xl text-black mb-1">
                {T.cierre.quien.nombre}
              </p>
              <p className="font-hand text-lg md:text-xl text-red-500 mb-3">
                {T.cierre.quien.cargo}
              </p>
              <p className="font-body text-base md:text-lg text-gray-700 leading-normal">
                {T.cierre.quien.bio}
              </p>
              <p className="font-body text-base md:text-lg text-gray-700 leading-normal mt-4">
                {T.cierre.room714}
              </p>
            </div>
          </div>
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
