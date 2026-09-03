"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Send, CheckCircle2, Loader2 } from "lucide-react";
import PrimaryButton from "@/app/components/PrimaryButton";
import { trackEvent } from "@/app/lib/analytics";
import { LINKEDIN_FOUNDER, withUtm } from "@/app/lib/links";
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
  const [producto, setProducto] = useState(elegidaEnLaUrl);

  // El efecto es para cuando se llega por navegación de cliente, donde el
  // componente no se vuelve a montar.
  useEffect(() => {
    const elegida = elegidaEnLaUrl();
    if (elegida) setProducto(elegida);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desdeDiagnostico]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    const formData = new FormData(e.target);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      company: formData.get("company"),
      message: formData.get("message"),
      // El API espera un array; aquí solo puede haber una situación.
      interests: producto ? [producto] : [],
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setStatus("success");
        trackEvent("contact_form_submit", { lang, producto: producto ?? "sin indicar" });
      } else setStatus("error");
    } catch (error) {
      setStatus("error");
    }
  };

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
            <div className="pb-12 lg:pb-24">
              {/* Hero */}
              <h1 className="font-hand text-4xl md:text-5xl lg:text-7xl mb-8 text-center lg:text-left leading-[1.45]">
                {t.hero.title}
              </h1>
              <p className="font-body text-lg md:text-xl lg:text-2xl text-gray-300 mb-12 leading-relaxed">
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
                      <p className="font-body text-base md:text-lg text-gray-300 leading-relaxed">
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
                  <p className="font-body text-base md:text-lg text-gray-300 leading-relaxed">
                    {bloque.body}
                  </p>
                </section>
              ))}

              {/* Paso opcional: el diagnóstico automático */}
              <p className="font-body text-base md:text-lg text-gray-400 mb-12">
                {t.diagnostico.pregunta}{" "}
                <Link
                  href={path("diagnostico", lang)}
                  className="font-hand text-red-500 hover:underline whitespace-nowrap"
                >
                  {t.diagnostico.enlace}
                </Link>
              </p>

              {/* El formulario */}
              <h2 className="font-hand text-3xl md:text-4xl lg:text-5xl mb-3 leading-[1.45]">
                {f.title}
              </h2>
              <p className="font-body text-base md:text-lg text-gray-400 mb-8">
                {f.lead}
              </p>

              <form
                onSubmit={handleSubmit}
                className="w-full flex flex-col gap-8"
              >
                {/* 1. Qué producto es */}
                <div className="flex flex-col gap-4">
                  <p className="font-body font-bold text-sm sm:text-base md:text-lg lg:text-xl uppercase">
                    {f.q1}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {f.q1_opciones.map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={producto === item}
                        onClick={() => setProducto(item)}
                        className={`px-6 py-1 border rounded-full text-xs sm:text-sm md:text-base lg:text-lg font-bold transition-all ${
                          producto === item
                            ? "bg-white text-black border-white"
                            : "border-white hover:bg-white/10"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Qué no está funcionando */}
                <div className="flex flex-col gap-3">
                  <label
                    htmlFor="message"
                    className="font-body font-bold text-sm sm:text-base md:text-lg lg:text-xl uppercase"
                  >
                    {f.q2}
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    placeholder={f.q2_ayuda}
                    className="w-full bg-[#E5E5E5] text-gray-700 font-bold rounded-3xl px-6 py-4 outline-none placeholder:font-normal placeholder:text-gray-500"
                  />
                </div>

                {/* 3. Quién eres y cómo te contactamos */}
                <div className="flex flex-col gap-3">
                  <label
                    htmlFor="name"
                    className="font-body font-bold text-sm sm:text-base md:text-lg lg:text-xl uppercase"
                  >
                    {f.q3_nombre}
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    type="text"
                    className="w-full bg-[#E5E5E5] text-gray-700 font-bold rounded-full px-6 py-3 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <label
                    htmlFor="company"
                    className="font-body font-bold text-sm sm:text-base md:text-lg lg:text-xl uppercase"
                  >
                    {f.q3_empresa}
                  </label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    className="w-full bg-[#E5E5E5] text-gray-700 font-bold rounded-full px-6 py-3 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <label
                    htmlFor="email"
                    className="font-body font-bold text-sm sm:text-base md:text-lg lg:text-xl uppercase"
                  >
                    {f.q3_email}
                  </label>
                  <input
                    id="email"
                    name="email"
                    required
                    type="email"
                    className="w-full bg-[#E5E5E5] text-gray-700 font-bold rounded-full px-6 py-3 outline-none"
                  />
                </div>

                <div className="flex justify-center lg:justify-end mt-4">
                  <PrimaryButton
                    text={
                      status === "loading" ? t.buttons.sending : f.enviar
                    }
                    isRed={true}
                    icon={status === "loading" ? Loader2 : Send}
                    type="submit"
                    className={
                      status === "loading" ? "opacity-70 pointer-events-none" : ""
                    }
                  />
                </div>
              </form>

              {/* La promesa de respuesta y las otras vías */}
              <div className="mt-8 font-body text-sm md:text-base text-gray-400 leading-relaxed">
                <p>{t.micro.respuesta}</p>
                <p>
                  {t.micro.linkedin}{" "}
                  <Link
                    href={withUtm(LINKEDIN_FOUNDER, {
                      campaign: "web",
                      content: "hablemos",
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-track-placement="hablemos"
                    className="font-hand text-red-500 hover:underline"
                  >
                    LinkedIn →
                  </Link>
                </p>
                <p className="mt-2">{t.micro.lugar}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. ILUSTRACIÓN MÓVIL/TABLET: Siempre presente al final */}
      {/* La ilustración cierra la página a todo el ancho. Antes estaba en
          absoluto detrás del texto, dimensionada para una página corta: con
          las secciones nuevas cruzaba el contenido en diagonal. */}
      <div className="w-full leading-none overflow-hidden">
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
