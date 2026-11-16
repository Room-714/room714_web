"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Send, RotateCcw } from "lucide-react";
import PrimaryButton from "@/app/components/PrimaryButton";
import { trackEvent } from "@/app/lib/analytics";
import { registrarConversion } from "@/app/lib/conversiones";
import { leerCampana } from "@/app/lib/campana";
import { path } from "@/app/lib/routes.mjs";
import {
  NOTA_RESULTADO,
  PREGUNTAS,
  PUNTOS,
  calcularResultado,
  respuestasVacias,
} from "@/app/lib/inventarioIa";
import { ANCLA_FORMULARIO } from "@/app/data/formacionIa";

// Inventario de IA: cinco preguntas, una por pantalla, resultado y envío por
// email. Componente nuevo (no había nada parecido): las opciones usan las
// pastillas del formulario de Hablemos, los botones son PrimaryButton y el
// contenedor es el de los campos del formulario sobre fondo negro.
//
// Las respuestas viven en el estado de este componente y no salen del
// navegador hasta que se pide el resultado por email.
//
// Accesibilidad: cada pregunta es un fieldset con su legend y con inputs
// nativos (checkbox o radio), así que funciona con teclado y lector de
// pantalla sin ARIA a mano. Al cambiar de pantalla el foco va al titular de
// la pantalla nueva.

const TOTAL = PREGUNTAS.length;
const PASO_RESULTADO = TOTAL;
const PASO_HECHO = TOTAL + 1;

const PASTILLA = `flex items-center gap-3 px-5 py-2 border border-white rounded-full
  text-sm md:text-base lg:text-lg font-bold cursor-pointer transition-all select-none
  hover:bg-white/10
  has-checked:bg-white has-checked:text-black
  has-focus-visible:ring-2 has-focus-visible:ring-red-500 has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-black`;

export default function InventarioIA() {
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState(respuestasVacias);
  const [empezado, setEmpezado] = useState(false);
  const [envio, setEnvio] = useState("idle"); // idle | loading | error
  const titularRef = useRef(null);
  const primerRender = useRef(true);

  // El foco sigue a la pantalla, salvo al cargar la página.
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    titularRef.current?.focus();
  }, [paso]);

  const marcar = (pregunta, opcionId, marcado) => {
    if (!empezado) {
      setEmpezado(true);
      trackEvent("inventario_empezado", {});
    }
    setRespuestas((prev) => {
      const actuales = prev[pregunta.id];
      const nuevas = pregunta.multiple
        ? marcado
          ? [...actuales, opcionId]
          : actuales.filter((id) => id !== opcionId)
        : [opcionId];
      return { ...prev, [pregunta.id]: nuevas };
    });
  };

  const reiniciar = () => {
    setRespuestas(respuestasVacias());
    setEnvio("idle");
    setPaso(0);
  };

  const enviar = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    setEnvio("loading");
    try {
      const res = await fetch("/api/inventario-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          acepta: form.get("acepta") === "on",
          web: form.get("web"),
          respuestas,
          campana: leerCampana(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      registrarConversion("inventario_terminado", {});
      setEnvio("idle");
      setPaso(PASO_HECHO);
    } catch {
      setEnvio("error");
    }
  };

  const contenedor =
    "rounded-4xl border border-white/30 p-6 md:p-8 lg:p-10 text-white";
  const titular =
    "font-title font-black text-xl md:text-2xl lg:text-3xl text-white leading-tight outline-none";

  // --- Confirmación ---------------------------------------------------------
  if (paso === PASO_HECHO) {
    return (
      <div className={contenedor} role="status">
        <p ref={titularRef} tabIndex={-1} className={`${titular} mb-4`}>
          Hecho. Revisa tu correo.
        </p>
        <p className="font-body text-base md:text-lg lg:text-xl text-gray-300 leading-normal mb-8">
          Te hemos enviado el resultado de tu inventario y las dos plantillas.
          Si quieres, lo repasamos contigo en la sesión de diagnóstico.
        </p>
        <PrimaryButton
          text="Reservar sesión de diagnóstico"
          isRed={true}
          href={`#${ANCLA_FORMULARIO}`}
          track="cta_click"
          trackPlacement="formacion_ia_inventario_hecho"
        />
      </div>
    );
  }

  // --- Resultado ------------------------------------------------------------
  if (paso === PASO_RESULTADO) {
    const r = calcularResultado(respuestas);
    const puntos = r.buenaBase ? [PUNTOS.buenaBase] : r.puntos;
    return (
      <div className={contenedor}>
        <p ref={titularRef} tabIndex={-1} className={`${titular} mb-6`}>
          {r.encabezado}
        </p>
        <ul className="flex flex-col gap-3 mb-6">
          {puntos.map((p) => (
            <li key={p} className="flex gap-4">
              <span
                className="font-hand text-red-500 text-xl md:text-2xl shrink-0 leading-tight"
                aria-hidden="true"
              >
                ·
              </span>
              <p className="font-body text-base md:text-lg lg:text-xl text-gray-300 leading-normal">
                {p}
              </p>
            </li>
          ))}
        </ul>
        <p className="font-body text-sm md:text-base text-gray-400 leading-normal mb-8">
          {NOTA_RESULTADO}
        </p>

        <form onSubmit={enviar} className="flex flex-col gap-5 max-w-2xl">
          <div className="flex flex-col gap-3">
            <label
              htmlFor="inventario-email"
              className="font-body font-bold text-sm sm:text-base md:text-lg uppercase"
            >
              Email de empresa
            </label>
            <input
              id="inventario-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full bg-[#E5E5E5] text-gray-700 font-bold rounded-full px-6 py-3 outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            />
          </div>

          {/* Campo trampa para bots: fuera de la vista y del tabulador. */}
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <label htmlFor="inventario-web">No rellenes este campo</label>
            <input id="inventario-web" name="web" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <label className="flex items-start gap-3 font-body text-sm md:text-base text-gray-300 leading-normal cursor-pointer">
            <input
              type="checkbox"
              name="acepta"
              required
              className="mt-1 w-5 h-5 shrink-0 accent-red-600"
            />
            <span>
              He leído y acepto la{" "}
              <Link
                href={path("privacidad", "es")}
                target="_blank"
                className="underline hover:text-red-500"
              >
                política de privacidad
              </Link>
              .
            </span>
          </label>

          {envio === "error" && (
            <p role="alert" className="font-body text-sm md:text-base text-red-400">
              No hemos podido enviarlo. Inténtalo de nuevo en unos minutos.
            </p>
          )}

          <div className="flex flex-wrap gap-4 mt-2">
            <PrimaryButton
              text={envio === "loading" ? "Enviando…" : "Enviarme el resultado y las plantillas"}
              isRed={true}
              type="submit"
              icon={envio === "loading" ? Loader2 : Send}
              disabled={envio === "loading"}
            />
            <PrimaryButton
              text="Volver a empezar"
              icon={RotateCcw}
              onClick={reiniciar}
            />
          </div>
        </form>
      </div>
    );
  }

  // --- Preguntas ------------------------------------------------------------
  const pregunta = PREGUNTAS[paso];
  const marcadas = respuestas[pregunta.id];
  const esUltima = paso === TOTAL - 1;
  const tipoInput = pregunta.multiple ? "checkbox" : "radio";

  return (
    <div className={contenedor}>
      <fieldset>
        <legend className="w-full mb-6">
          <span className="block font-hand text-red-500 text-lg md:text-xl lg:text-2xl leading-[1.45] mb-1">
            {`Pregunta ${paso + 1} de ${TOTAL}`}
          </span>
          <span ref={titularRef} tabIndex={-1} className={`block ${titular}`}>
            {pregunta.texto}
          </span>
          <span className="block font-body text-sm md:text-base text-gray-400 mt-2">
            {pregunta.multiple ? "Varias respuestas" : "Una respuesta"}
          </span>
        </legend>

        <div className="flex flex-wrap gap-3">
          {pregunta.opciones.map((o) => (
            <label key={o.id} className={PASTILLA}>
              <input
                type={tipoInput}
                name={`inventario-${pregunta.id}`}
                value={o.id}
                checked={marcadas.includes(o.id)}
                onChange={(e) => marcar(pregunta, o.id, e.target.checked)}
                className="sr-only"
              />
              {o.texto}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-4 mt-8">
        <PrimaryButton
          text="Anterior"
          icon={ChevronLeft}
          disabled={paso === 0}
          onClick={() => setPaso(paso - 1)}
        />
        <PrimaryButton
          text={esUltima ? "Ver resultado" : "Siguiente"}
          isRed={true}
          icon={ChevronRight}
          disabled={marcadas.length === 0}
          onClick={() => setPaso(paso + 1)}
        />
      </div>
    </div>
  );
}
