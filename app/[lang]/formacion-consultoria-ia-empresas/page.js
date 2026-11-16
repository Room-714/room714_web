import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import Navbar from "@/app/components/Navbar";
import PrimaryButton from "@/app/components/PrimaryButton";
import Cronograma from "@/app/components/formacionIa/Cronograma";
import CapturaCampana from "@/app/components/formacionIa/CapturaCampana";
import FormularioLanding from "@/app/components/formacionIa/FormularioLanding";
import InventarioIA from "@/app/components/formacionIa/InventarioIA";
import { getDictionary } from "@/app/dictionaries";
import { SITE_URL } from "@/app/lib/seo/urls";
import { socialMeta } from "@/app/lib/seo/social";
import { jsonLdGraph, serviceSchema } from "@/app/lib/seo/schema";
import { path } from "@/app/lib/routes.mjs";
import { CANAL } from "@/app/lib/layout";
import {
  ANCLA_FORMULARIO,
  ANCLA_INVENTARIO,
  FORMACION_IA as T,
} from "@/app/data/formacionIa";

// Landing de campaña «Formación y consultoría de IA para empresas».
//
// Solo en castellano: /en/<ruta> redirige a la portada inglesa (guardasSoloEs
// en routes.mjs) y, por si acaso, aquí cualquier otro idioma es un 404.
// Fuera del menú principal; se enlaza desde el footer.
//
// La maqueta copia la de las páginas de situación (_vistas/situacion.js):
// fondo negro, secciones con su h2, tarjetas claras con cuadrícula, listas
// con punto rojo y el cierre redondeado.

const CLAVE = "formacionIa";
const URL_PAGINA = `${SITE_URL}${path(CLAVE, "es")}`;

// La tarjeta clara con cuadrícula de "Lo hemos hecho antes".
const TARJETA = `rounded-4xl bg-[#F2F2F2]
  bg-[linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)]
  bg-size-[40px_40px] p-6 lg:p-8`;

const TEXTO = "font-body text-lg md:text-xl lg:text-2xl text-gray-300 leading-normal";

function Seccion({ titulo, children, id, className = "" }) {
  return (
    <section
      id={id}
      className={`mb-10 lg:mb-14 ${id ? "scroll-mt-28" : ""} ${className}`}
    >
      <h2 className="font-title font-black text-2xl md:text-3xl lg:text-4xl text-white mb-6 leading-tight">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function ListaConPunto({ puntos, oscuro = true }) {
  return (
    <ul className="flex flex-col gap-4">
      {puntos.map((linea) => (
        <li key={linea} className="flex gap-4">
          <span
            className="font-hand text-red-500 text-xl md:text-2xl shrink-0 leading-tight"
            aria-hidden="true"
          >
            ·
          </span>
          <p
            className={
              oscuro
                ? TEXTO
                : "font-body text-base md:text-lg text-gray-900 leading-normal"
            }
          >
            {linea}
          </p>
        </li>
      ))}
    </ul>
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

export default async function FormacionIaPage({ params }) {
  const { lang } = await params;
  if (lang !== "es") notFound();

  const dict = await getDictionary("es");
  const quien = dict.about.quien;
  // El BreadcrumbList lo emite BreadcrumbSchema desde el layout, y el
  // Organization también; aquí solo va el Service.
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

      <main className={`${CANAL} pt-8 pb-16`}>
        {/* 1. Hero. El H1 es el antetítulo; el titular grande es texto
            destacado, no un segundo H1. */}
        <header className="max-w-4xl mb-12 lg:mb-16">
          <h1 className="font-title font-bold text-base md:text-lg lg:text-xl uppercase text-gray-300 mb-4">
            {T.hero.antetitulo}
          </h1>
          <p className="font-title font-black text-4xl md:text-6xl lg:text-7xl text-white leading-tight mb-4">
            {T.hero.titular}
          </p>
          <p className="font-hand text-red-500 text-2xl md:text-3xl lg:text-4xl mb-8 leading-[1.45]">
            {T.hero.subtitulo}
          </p>
          <p className={`${TEXTO} mb-10`}>{T.hero.texto}</p>
          <div className="flex flex-wrap gap-4">
            <PrimaryButton
              text={T.hero.ctaPrincipal}
              isRed={true}
              href={aFormulario}
              track="cta_click"
              trackPlacement="formacion_ia_hero"
            />
            <PrimaryButton
              text={T.hero.ctaSecundario}
              href={`#${ANCLA_INVENTARIO}`}
              track="cta_click"
              trackPlacement="formacion_ia_hero_inventario"
            />
          </div>
          <p className="font-body text-sm md:text-base text-gray-400 leading-normal mt-6">
            {T.hero.nota}
          </p>
        </header>

        {/* 2. El problema */}
        <Seccion titulo={T.problema.titulo}>
          <ListaConPunto puntos={T.problema.puntos} />
        </Seccion>

        {/* 3. Inventario de IA */}
        <Seccion titulo={T.inventario.titulo} id={ANCLA_INVENTARIO}>
          <p className={`${TEXTO} mb-8`}>{T.inventario.texto}</p>
          <InventarioIA />
          <p className="font-body text-sm md:text-base text-gray-400 leading-normal mt-6">
            {T.inventario.nota}
          </p>
        </Seccion>

        {/* 4. La propuesta */}
        <Seccion titulo={T.propuesta.titulo}>
          <p className="font-hand text-red-500 text-xl md:text-2xl lg:text-3xl mb-6 leading-[1.45]">
            {T.propuesta.nota}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {T.propuesta.tarjetas.map((c) => (
              <div key={c.titulo} className={TARJETA}>
                <h3 className="font-title font-black text-xl md:text-2xl lg:text-3xl text-black mb-4 leading-tight">
                  {c.titulo}
                </h3>
                <p className="font-body text-base md:text-lg lg:text-xl text-gray-900 leading-normal mb-4">
                  <strong className="font-bold text-black">{c.subtitulo}</strong>{" "}
                  {c.texto}
                </p>
                <p className="font-body text-base md:text-lg lg:text-xl text-gray-900 leading-normal">
                  <strong className="font-bold text-black">
                    {T.propuesta.etiquetaResultado}
                  </strong>{" "}
                  {c.resultado}
                </p>
              </div>
            ))}
          </div>
        </Seccion>

        {/* 5. Programa formativo */}
        <Seccion titulo={T.programa.titulo}>
          <ol className="flex flex-col">
            {T.programa.modulos.map((m, i) => (
              <li
                key={m.titulo}
                className="grid md:grid-cols-[12rem_1fr] gap-2 md:gap-8 border-t border-white/20 py-6"
              >
                <div>
                  <p className="font-hand text-red-500 text-xl md:text-2xl leading-[1.45]">
                    {`Módulo ${i + 1}`}
                  </p>
                  <p className="font-body text-sm md:text-base text-gray-400">
                    {T.programa.formato}
                  </p>
                </div>
                <div>
                  <h3 className="font-title font-bold text-lg md:text-xl lg:text-2xl text-white leading-snug mb-2">
                    {m.titulo}
                  </h3>
                  <p className="font-body text-base md:text-lg lg:text-xl text-gray-300 leading-normal mb-3">
                    {m.objetivo}
                  </p>
                  <span className="inline-block px-4 py-1 border border-white rounded-full text-xs sm:text-sm font-bold text-white">
                    {m.tipo}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </Seccion>

        {/* 6. Consultoría */}
        <Seccion titulo={T.consultoria.titulo}>
          <p className={`${TEXTO} mb-8`}>{T.consultoria.texto}</p>

          {/* Parte 1, destacada */}
          <div className={`${TARJETA} mb-10`}>
            <p className="font-hand text-red-500 text-lg md:text-xl lg:text-2xl mb-2 leading-[1.45]">
              {T.consultoria.parte1.etiqueta}
            </p>
            <h3 className="font-title font-black text-xl md:text-2xl lg:text-3xl text-black mb-4 leading-tight">
              {T.consultoria.parte1.titulo}
            </h3>
            <p className="font-body text-base md:text-lg lg:text-xl text-gray-900 leading-normal mb-6">
              {T.consultoria.parte1.texto}
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {T.consultoria.parte1.listas.map((lista) => (
                <div key={lista.titulo}>
                  <h4 className="font-title font-bold text-lg md:text-xl text-black mb-3">
                    {lista.titulo}
                  </h4>
                  <ListaConPunto puntos={lista.puntos} oscuro={false} />
                </div>
              ))}
            </div>
          </div>

          {/* Parte 2 */}
          <p className="font-hand text-red-500 text-lg md:text-xl lg:text-2xl mb-2 leading-[1.45]">
            {T.consultoria.parte2.etiqueta}
          </p>
          <h3 className="font-title font-black text-xl md:text-2xl lg:text-3xl text-white mb-4 leading-tight">
            {T.consultoria.parte2.titulo}
          </h3>
          <p className={`${TEXTO} mb-6`}>{T.consultoria.parte2.texto}</p>
          <ol className="grid md:grid-cols-3 gap-4">
            {T.consultoria.parte2.fases.map((fase, i) => (
              <li key={fase.titulo} className={TARJETA}>
                <p className="font-hand text-red-500 text-lg md:text-xl mb-2 leading-[1.45]">
                  {`Fase ${i + 1}`}
                </p>
                <h4 className="font-title font-black text-lg md:text-xl lg:text-2xl text-black mb-3 leading-tight">
                  {fase.titulo}
                </h4>
                <p className="font-body text-base md:text-lg text-gray-900 leading-normal mb-4">
                  {fase.texto}
                </p>
                <p className="font-body text-base md:text-lg text-gray-900 leading-normal">
                  <strong className="font-bold text-black">
                    {T.consultoria.parte2.etiquetaSalesCon}
                  </strong>{" "}
                  {fase.salesCon}
                </p>
              </li>
            ))}
          </ol>
        </Seccion>

        {/* 7. Lo que te llevas */}
        <Seccion titulo={T.llevas.titulo}>
          <div className="mb-8">
            <ListaConPunto puntos={T.llevas.puntos} />
          </div>
          <aside className={TARJETA} aria-label={T.llevas.normativa.etiqueta}>
            <p className="font-hand text-red-500 text-lg md:text-xl lg:text-2xl mb-2 leading-[1.45]">
              {T.llevas.normativa.etiqueta}
            </p>
            <h3 className="font-title font-black text-xl md:text-2xl lg:text-3xl text-black mb-4 leading-tight">
              {T.llevas.normativa.titulo}
            </h3>
            <p className="font-body text-base md:text-lg lg:text-xl text-gray-900 leading-normal mb-4">
              {T.llevas.normativa.texto}
            </p>
            <p className="font-body text-sm md:text-base text-gray-600 leading-normal">
              {T.llevas.normativa.nota}
            </p>
          </aside>
        </Seccion>

        {/* 8. Un solo programa de tres meses */}
        <Seccion titulo={T.calendario.titulo} className="mb-0 lg:mb-0">
          <p className={`${TEXTO} mb-10`}>{T.calendario.texto}</p>
          <Cronograma
            meses={T.calendario.meses}
            semanas={T.calendario.semanas}
            lineas={T.calendario.lineas}
          />
          <div className="mt-10">
            <PrimaryButton
              text={T.calendario.cta}
              isRed={true}
              href={aFormulario}
              track="cta_click"
              trackPlacement="formacion_ia_calendario"
            />
          </div>
        </Seccion>
      </main>

      {/* 9. Por qué Room 714, con la ficha de "Quién está detrás" */}
      <section
        className={`w-full bg-gray-300 rounded-t-[50px] relative z-10 ${CANAL} pt-16 pb-24`}
      >
        <h2 className="font-title font-black text-2xl md:text-4xl lg:text-5xl text-black mb-6 leading-tight">
          {T.porQue.titulo}
        </h2>
        <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-700 leading-normal mb-6">
          {T.porQue.texto}
        </p>
        <p className="flex flex-wrap gap-x-8 gap-y-2 mb-12">
          {T.porQue.enlaces.map((e) => (
            <Link
              key={e.ruta}
              href={path(e.ruta, "es")}
              className="font-hand text-red-600 text-xl md:text-2xl hover:underline"
            >
              → {e.texto}
            </Link>
          ))}
        </p>

        <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
          <Image
            src="/about/jose-antonio-ces.jpg"
            alt={quien.nombre}
            width={320}
            height={320}
            className="rounded-full shrink-0 w-32 h-32 lg:w-40 lg:h-40 object-cover"
          />
          <div>
            <p className="font-title font-bold text-xl md:text-2xl lg:text-3xl text-black mb-1">
              {quien.nombre}
            </p>
            <p className="font-hand text-lg md:text-xl lg:text-2xl text-red-500 mb-6">
              {quien.cargo}
            </p>
            <p className="font-body text-base md:text-lg lg:text-xl text-gray-700 leading-normal">
              {quien.bio}
            </p>
          </div>
        </div>
      </section>

      {/* 10. Preguntas frecuentes */}
      <section
        className={`w-full bg-white rounded-t-[50px] -mt-10 relative z-20 ${CANAL} pt-16 pb-24`}
      >
        <h2 className="font-title font-black text-2xl md:text-4xl lg:text-5xl text-black mb-8 leading-tight">
          {T.faq.titulo}
        </h2>
        <dl className="flex flex-col">
          {T.faq.preguntas.map((q) => (
            <div key={q.p} className="border-t border-black/15 py-6">
              <dt className="font-title font-bold text-lg md:text-xl lg:text-2xl text-black mb-2">
                {q.p}
              </dt>
              <dd className="font-body text-base md:text-lg lg:text-xl text-gray-700 leading-normal">
                {q.r}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 11. Cierre y formulario */}
      <section
        id={ANCLA_FORMULARIO}
        className={`w-full bg-black text-white rounded-t-[50px] -mt-10 relative z-30 scroll-mt-20 ${CANAL} pt-16 pb-20`}
      >
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          <div>
            <h2 className="font-hand text-3xl md:text-4xl lg:text-5xl mb-6 leading-[1.45]">
              {T.cierre.titulo}
            </h2>
            <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-300 leading-normal mb-6">
              {T.cierre.texto}
            </p>
            <p className="flex gap-3 font-body text-base md:text-lg text-gray-400 leading-normal">
              <Phone size={22} className="text-red-500 shrink-0 mt-1" aria-hidden="true" />
              {T.hero.nota}
            </p>
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
