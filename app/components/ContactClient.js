"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import ContactForm from "@/app/components/ContactForm";
import { path } from "@/app/lib/routes.mjs";
import { CLAVES_SITUACION } from "@/app/data/Situaciones";
import { CANAL } from "@/app/lib/layout";

// El formulario de "Hablemos": tres preguntas, sin calendario.
//
// Sustituye a la lista de nueve intereses con selección múltiple. La primera
// pregunta usa las mismas pastillas, pero de selección ÚNICA: son cuatro
// situaciones excluyentes, y poder marcar las cuatro no le decía nada a
// nadie. Los estilos de los campos, el botón y la pantalla de éxito son los
// que ya había.
export default function ContactClient({ dict }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const lang = params?.lang || "en";
  const t = dict.contact;
  const f = t.formulario;

  // El diagnóstico manda ?situacion=<clave>: llegamos con la primera
  // pregunta ya marcada, que es la mitad del formulario respondida.
  const desdeDiagnostico = searchParams.get("situacion");
  const elegidaEnLaUrl = () => {
    const i = CLAVES_SITUACION.indexOf(desdeDiagnostico);
    return i === -1 ? null : f.q1_opciones[i];
  };

  const [status, setStatus] = useState("idle");
  // El valor inicial se deriva de la URL en lugar de fijarse en un efecto:
  // así la pastilla ya viene marcada en el HTML del servidor y no parpadea.
  // El envío y los campos viven en ContactForm, que se reutiliza en la
  // landing de IA en tu empresa.
  const [producto, setProducto] = useState(elegidaEnLaUrl);

  // El efecto es para cuando se llega por navegación de cliente, donde el
  // componente no se vuelve a montar.
  useEffect(() => {
    const elegida = elegidaEnLaUrl();
    if (elegida) setProducto(elegida);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desdeDiagnostico]);

  return (
    <main className="bg-black text-white relative overflow-hidden flex flex-col">
      <div className={`${CANAL} pt-12 lg:pt-20 pb-0 z-10`}>

        <div className="w-full">
          {status === "success" ? (
            <div className="flex flex-col jusfity-center items-end animate-in fade-in duration-500 lg:mt-24 lg:mb-36">
              <CheckCircle2 size={60} className="text-red-600 mb-8" />
              <h1 className="font-hand text-5xl sm:text-6xl md:text-7xl lg:text-8xl mb-4 text-white leading-[1.45]">
                {t.success.title}
              </h1>
              <p className="font-body text-xl sm:text-2xl md:text-3xl lg:text-4xl text-gray-400 mb-8 max-w-2xl">
                {t.success.description}
              </p>

              <Link
                href={path("home", lang)}
                className="text-white font-title text-sm sm:text-base md:text-lg lg:text-xl"
              >
                {t.success.link}
              </Link>
            </div>
          ) : (
            <div className="pb-12 lg:pb-0">
              {/* Sin relleno inferior en escritorio: ahí el dibujo es el fondo
                  del último bloque y cierra la página pegado al skyline, así
                  que los 96px de lg:pb-24 se veían como una franja negra entre
                  el haz de luz y el skyline. Hasta lg el dibujo va aparte,
                  debajo de este main, y ahí el pb-12 sí hace falta. */}
              {/* Hero, con el mismo par que el índice de Casos: titular en
                  la tipografía del sitio y el rótulo a mano en rojo debajo. */}
              <h1 className="font-body font-black text-4xl md:text-6xl lg:text-7xl mb-4 leading-tight text-left">
                {t.hero.title}
              </h1>
              <p className="font-hand text-red-500 text-3xl md:text-4xl lg:text-5xl mb-8 leading-[1.45] text-right">
                {t.hero.subtitle}
              </p>
              <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-300 mb-12 leading-normal text-right">
                {t.hero.description}
              </p>

              {/* Qué pasa en la sesión */}
              <section className="mb-10">
                <h2 className="font-title font-bold text-xl md:text-2xl uppercase mb-5">
                  {t.sesion.title}
                </h2>
                <ul className="flex flex-col gap-3">
                  {t.sesion.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span
                        className="font-hand text-red-500 text-xl shrink-0"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <p className="font-body text-base md:text-lg text-gray-300 leading-normal">
                        {item}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Qué te llevas y para quién es */}
              {[t.llevas, t.paraQuien].map((bloque) => (
                <section key={bloque.title} className="mb-10">
                  <h2 className="font-title font-bold text-xl md:text-2xl uppercase mb-4">
                    {bloque.title}
                  </h2>
                  <p className="font-body text-base md:text-lg text-gray-300 leading-normal">
                    {bloque.body}
                  </p>
                </section>
              ))}

              {/* El formulario. En escritorio va a la derecha y encima de la
                  figura: el muñeco vive pegado al borde izquierdo del dibujo,
                  así que el formulario no lo tapa.

                  La figura entra aquí como fondo y no como <img> para que el
                  alto del bloque lo mande el formulario, que en pantallas
                  medianas es más alto que el dibujo. El min-h es el alto del
                  propio dibujo a todo el ancho (1668 × 840), así que nunca se
                  encoge ni se descoloca; y el margen negativo deshace el canal
                  para que llegue a los bordes, como llegaba cuando cerraba la
                  página. */}
              <div className="lg:-mx-16 lg:min-h-[51vw] lg:bg-[url('/contact-tablet.svg')] lg:bg-contain lg:bg-bottom lg:bg-no-repeat">
                {/* El pb deja el formulario por encima del haz de luz del
                    dibujo: el blanco cruza justo por donde caían los dos
                    últimos campos y no se leían. */}
                <div className="lg:w-[52%] lg:ml-auto lg:mr-16 lg:pt-10 lg:pb-40">
                  <h2 className="font-hand text-3xl md:text-4xl lg:text-5xl mb-3 leading-[1.45]">
                    {f.title}
                  </h2>
                  <p className="font-body text-base md:text-lg text-gray-400 mb-8">
                    {f.lead}
                  </p>

                  <ContactForm
                    dict={dict}
                    producto={producto}
                    onProducto={setProducto}
                    onEnviado={() => setStatus("success")}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* La ilustración cierra la página a todo el ancho hasta lg. En
          escritorio no se repite aquí: va de fondo detrás del formulario. */}
      <div className="w-full leading-none overflow-hidden lg:hidden">
        <Image
          src="/contact-tablet.svg"
          alt="Contact illustration"
          width={1500}
          height={800}
          className="w-full h-auto block align-bottom"
          priority
        />
      </div>
    </main>
  );
}
