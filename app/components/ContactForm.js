"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import PrimaryButton from "@/app/components/PrimaryButton";
import { trackEvent } from "@/app/lib/analytics";
import { registrarConversion } from "@/app/lib/conversiones";
import { leerCampana } from "@/app/lib/campana";
import { FORMACION_IA, ORIGENES } from "@/app/data/formacionIa";

// El formulario de "Hablemos", sacado de ContactClient para poder usarlo
// también en la landing de formación en IA. El marcado y los estilos son los
// de siempre; lo único que cambia con `variante="formacionIa"`:
//
//   - La primera pregunta ("¿Qué producto es?") no aplica a esta landing y
//     se sustituye por "Número de empleados", con las mismas pastillas.
//   - La pregunta de texto libre es "¿Qué te preocupa?".
//   - Se manda el origen de la landing y los parámetros de campaña.
//   - Al enviarse registra la conversión `diagnostico_solicitado`.
export default function ContactForm({
  dict,
  variante = "hablemos",
  // En Hablemos la situación la controla ContactClient, que la puede traer
  // ya marcada desde la URL (?situacion=).
  producto = null,
  onProducto,
  onEnviado,
}) {
  const params = useParams();
  const lang = params?.lang || "en";
  const t = dict.contact;
  const f = t.formulario;
  const esLanding = variante === "formacionIa";
  const empleados = FORMACION_IA.cierre.empleados;

  const [status, setStatus] = useState("idle");
  const [numEmpleados, setNumEmpleados] = useState(null);

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
      interests: !esLanding && producto ? [producto] : [],
      ...(esLanding
        ? {
            origen: formData.get("origen"),
            employees: numEmpleados,
            campana: leerCampana(),
          }
        : {}),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setStatus("success");
        trackEvent("contact_form_submit", {
          lang,
          producto: esLanding ? "formacion_ia" : (producto ?? "sin indicar"),
        });
        if (esLanding) {
          registrarConversion("diagnostico_solicitado", {
            empleados: numEmpleados ?? "sin indicar",
          });
        }
        onEnviado?.();
      } else setStatus("error");
    } catch (error) {
      setStatus("error");
    }
  };

  // La pregunta de pastillas: producto en Hablemos, empleados en la landing.
  const pastillas = esLanding
    ? {
        pregunta: empleados.pregunta,
        opciones: empleados.opciones,
        valor: numEmpleados,
        elegir: setNumEmpleados,
      }
    : {
        pregunta: f.q1,
        opciones: f.q1_opciones,
        valor: producto,
        elegir: (item) => onProducto?.(item),
      };

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
      {esLanding && (
        <input type="hidden" name="origen" value={ORIGENES.landing} />
      )}

      {/* 1. Qué producto es (o, en la landing, cuántos empleados) */}
      <div className="flex flex-col gap-4">
        <p
          id={`${variante}-pastillas`}
          className="font-body font-bold text-sm sm:text-base md:text-lg lg:text-xl uppercase"
        >
          {pastillas.pregunta}
        </p>
        <div
          role="group"
          aria-labelledby={`${variante}-pastillas`}
          className="flex flex-wrap gap-3"
        >
          {pastillas.opciones.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={pastillas.valor === item}
              onClick={() => pastillas.elegir(item)}
              className={`px-6 py-1 border rounded-full text-xs sm:text-sm md:text-base lg:text-lg font-bold transition-all ${
                pastillas.valor === item
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
          htmlFor={`${variante}-message`}
          className="font-body font-bold text-sm sm:text-base md:text-lg lg:text-xl uppercase"
        >
          {esLanding ? FORMACION_IA.cierre.pregunta : f.q2}
        </label>
        <textarea
          id={`${variante}-message`}
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
          htmlFor={`${variante}-name`}
          className="font-body font-bold text-sm sm:text-base md:text-lg lg:text-xl uppercase"
        >
          {f.q3_nombre}
        </label>
        <input
          id={`${variante}-name`}
          name="name"
          required
          type="text"
          autoComplete="name"
          className="w-full bg-[#E5E5E5] text-gray-700 font-bold rounded-full px-6 py-3 outline-none"
        />
      </div>
      <div className="flex flex-col gap-3">
        <label
          htmlFor={`${variante}-company`}
          className="font-body font-bold text-sm sm:text-base md:text-lg lg:text-xl uppercase"
        >
          {f.q3_empresa}
        </label>
        <input
          id={`${variante}-company`}
          name="company"
          type="text"
          autoComplete="organization"
          className="w-full bg-[#E5E5E5] text-gray-700 font-bold rounded-full px-6 py-3 outline-none"
        />
      </div>
      <div className="flex flex-col gap-3">
        <label
          htmlFor={`${variante}-email`}
          className="font-body font-bold text-sm sm:text-base md:text-lg lg:text-xl uppercase"
        >
          {f.q3_email}
        </label>
        <input
          id={`${variante}-email`}
          name="email"
          required
          type="email"
          autoComplete="email"
          className="w-full bg-[#E5E5E5] text-gray-700 font-bold rounded-full px-6 py-3 outline-none"
        />
      </div>

      <div className="flex justify-center lg:justify-end mt-4">
        <PrimaryButton
          text={status === "loading" ? t.buttons.sending : f.enviar}
          isRed={true}
          icon={status === "loading" ? Loader2 : Send}
          type="submit"
          className={
            status === "loading" ? "opacity-70 pointer-events-none" : ""
          }
        />
      </div>
    </form>
  );
}
