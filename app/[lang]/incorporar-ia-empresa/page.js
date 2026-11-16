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
// negro (hero con el dibujo, el problema en una caja roja y la propuesta) →
// blanco (inventario, que enlaza con el skyline). Un único objetivo: vender
// la colaboración. Tipografías, tarjetas y botones son los del resto del
// sitio.

const CLAVE = "incorporarIa";
const URL_PAGINA = `${SITE_URL}${path(CLAVE, "es")}`;

// La tarjeta clara con cuadrícula de "Lo hemos hecho antes".
const TARJETA = `rounded-4xl bg-[#F2F2F2]
  bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)]
  bg-size-[40px_40px] p-6 lg:p-8`;

const H2 = "font-title font-black text-2xl md:text-4xl lg:text-5xl leading-tight";
const TEXTO = "font-body text-lg md:text-xl lg:text-2xl leading-normal";

/** El texto con una parte en rojo (si la hay). */
function Destacado({ texto, parte }) {
  const i = parte ? texto.indexOf(parte) : -1;
  if (i < 0) return texto;
  return (
    <>
      {texto.slice(0, i)}
      <span className="text-red-600">{parte}</span>
      {texto.slice(i + parte.length)}
    </>
  );
}

/** Dos tarjetas claras con título y texto, en dos columnas. */
function Tarjetas({ bloques }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {bloques.map((b) => (
        <div key={b.titulo} className={TARJETA}>
          <h3 className="font-title font-black text-xl md:text-2xl lg:text-3xl text-black mb-4 leading-tight">
            <Destacado texto={b.titulo} parte={b.destacado} />
          </h3>
          <p className="font-body text-base md:text-lg lg:text-xl text-gray-900 leading-normal">
            {b.texto}
          </p>
        </div>
      ))}
    </div>
  );
}

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

      <main className={`${CANAL} pt-8 pb-16 lg:pb-24`}>
        {/* 1. Hero a dos columnas: el problema y la oferta a la izquierda, el
            dibujo (tus empleados con la IA desbocada) a la derecha. El
            titular es el H1; la búsqueda objetivo va en el title y la
            description. */}
        <header className="grid lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] gap-10 lg:gap-12 items-center">
          <div>
            {/* text-balance reparte las líneas: sin palabras huérfanas */}
            <h1 className="font-title font-black text-4xl md:text-5xl leading-tight text-balance text-white mb-6">
              {T.hero.titular}
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

      {/* 2 y 3, sobre el mismo negro del hero. El problema va en una caja
          roja redondeada para que destaque: el candado abierto a la
          izquierda y el texto alineado a la derecha. Después, la propuesta
          en un solo bloque: los dos ejes y, continuando la frase, el remate
          alineado a la derecha. */}
      <section className={`w-full bg-black text-white ${CANAL} pb-24 lg:pb-28`}>
        <div className="rounded-[50px] bg-red-700 px-6 py-12 md:px-12 md:py-16 lg:px-16 lg:py-20 mb-16 lg:mb-24">
          <div className="grid md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-10 lg:gap-16 items-center">
            <CandadoAbierto className="w-44 md:w-full max-w-xs mx-auto" />
            <div className="text-right">
              <h2 className={`${H2} text-balance mb-8`}>{T.problema.titulo}</h2>
              <p className={`${TEXTO} text-white/90 mb-8`}>
                {T.problema.puntos.join(" ")}
              </p>
              <p className="font-hand text-white text-2xl md:text-3xl lg:text-4xl leading-[1.45] text-balance">
                {T.problema.remate}
              </p>
            </div>
          </div>
        </div>

        <h2 className={`${H2} mb-10 max-w-4xl`}>{T.frentes.titulo}</h2>
        <Tarjetas bloques={T.frentes.bloques} />
        {/* Remate de la frase, manuscrito y alineado a la derecha */}
        <h2 className="font-hand text-white text-3xl md:text-4xl lg:text-5xl leading-[1.45] text-right text-balance mt-10 lg:mt-12 ml-auto max-w-4xl">
          {T.queda.titulo}
        </h2>
      </section>

      {/* 4. Hablemos: inventario de IA, sobre blanco: enlaza con el skyline */}
      <section
        id={ANCLA_FORMULARIO}
        className={`w-full bg-white text-black rounded-t-[50px] -mt-10 relative z-1 scroll-mt-20 ${CANAL} pt-16 pb-20`}
      >
        {/* En móvil: título → cuestionario → ficha, para que «Hablemos»
            lleve directo a las preguntas. En escritorio: título y ficha a la
            izquierda, cuestionario a la derecha. */}
        <div className="grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] gap-x-16 gap-y-10">
          <div>
            <h2 className={`${H2} mb-6`}>{T.cierre.titulo}</h2>
            <p className={`${TEXTO} text-black`}>
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
