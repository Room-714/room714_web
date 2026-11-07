"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Paperclip, FileText } from "lucide-react";
import { path } from "@/app/lib/routes.mjs";

// Candidatura a una oferta en forma de conversación. Tres preguntas abiertas
// y el CV. Las preguntas no delatan qué se criba ("¿dónde resides?", no
// "¿resides en España?"), y el final es el mismo para todos: la criba la hace
// el servidor (app/api/careers/oferta) sin que el candidato lo note.

const PREGUNTAS = ["residencia", "formacion", "experiencia"];
const MAX_CV_BYTES = 5 * 1024 * 1024;
const MAX_RESPUESTA = 600;
const PAUSA_ESCRIBIENDO = 650; // ms que "escribe" el bot antes de cada mensaje

export default function OfertaChat({ dict, lang, position }) {
  const t = dict.careers.oferta.chat;

  // Cada mensaje: { de: "bot" | "yo", texto?, archivo?, tipo? }
  const [mensajes, setMensajes] = useState([]);
  const [escribiendo, setEscribiendo] = useState(true);
  const [fase, setFase] = useState(0); // índice en PREGUNTAS; luego "cv", "consentimiento", "enviando", "fin"
  const [respuestas, setRespuestas] = useState({});
  const [borrador, setBorrador] = useState("");
  const [cv, setCv] = useState(null);

  const finalRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const yaEmpezado = useRef(false);
  const enviando = useRef(false);

  const hablaBot = (...textos) => {
    setEscribiendo(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        setMensajes((m) => [...m, ...textos.map((texto) => ({ de: "bot", ...texto }))]);
        setEscribiendo(false);
        resolve();
      }, PAUSA_ESCRIBIENDO);
    });
  };

  useEffect(() => {
    if (yaEmpezado.current) return;
    yaEmpezado.current = true;
    hablaBot({ texto: t.saludo }, { texto: t.preguntas.residencia });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seguir la conversación, pero solo dentro del chat: que la página no salte.
  useEffect(() => {
    const el = finalRef.current;
    if (el?.parentElement) {
      el.parentElement.scrollTo({ top: el.parentElement.scrollHeight, behavior: "smooth" });
    }
  }, [mensajes, escribiendo]);

  useEffect(() => {
    if (!escribiendo && typeof fase === "number") inputRef.current?.focus({ preventScroll: true });
  }, [escribiendo, fase]);

  const responder = async (e) => {
    e?.preventDefault();
    const texto = borrador.trim();
    if (!texto || escribiendo || typeof fase !== "number") return;

    const clave = PREGUNTAS[fase];
    setRespuestas((r) => ({ ...r, [clave]: texto }));
    setMensajes((m) => [...m, { de: "yo", texto }]);
    setBorrador("");

    const siguiente = fase + 1;
    if (siguiente < PREGUNTAS.length) {
      setFase(siguiente);
      await hablaBot({ texto: t.preguntas[PREGUNTAS[siguiente]] });
    } else {
      setFase("cv");
      await hablaBot({ texto: t.cv.pide });
    }
  };

  const adjuntar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      await hablaBot({ texto: t.errores.noPdf });
      return;
    }
    if (file.size > MAX_CV_BYTES) {
      await hablaBot({ texto: t.errores.grande });
      return;
    }
    setCv(file);
    setMensajes((m) => [...m, { de: "yo", archivo: file.name }]);
    setFase("consentimiento");
    await hablaBot({ tipo: "consentimiento" });
  };

  const enviar = async () => {
    if (!cv || fase !== "consentimiento" || enviando.current) return;
    enviando.current = true;
    setFase("enviando");
    setMensajes((m) => [...m, { de: "yo", texto: t.consentimiento.acepto }]);
    try {
      const fd = new FormData();
      fd.append("position", position);
      for (const clave of PREGUNTAS) fd.append(clave, respuestas[clave]);
      fd.append("acceptedPrivacy", "true");
      fd.append("cv", cv);
      const res = await fetch("/api/careers/oferta", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFase("fin");
      await hablaBot({ texto: t.fin.gracias }, { tipo: "fin" });
    } catch (err) {
      console.error(err);
      enviando.current = false;
      setFase("consentimiento");
      await hablaBot({ texto: t.errores.envio }, { tipo: "consentimiento" });
    }
  };

  const pregunta = typeof fase === "number";

  return (
    <div className="bg-white rounded-3xl max-w-3xl mx-auto overflow-hidden flex flex-col">
      <div
        className="h-[28rem] md:h-[32rem] overflow-y-auto px-4 md:px-8 py-6 md:py-8 space-y-3"
        role="log"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {mensajes.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${m.de === "yo" ? "justify-end" : "justify-start"}`}
            >
              <Burbuja m={m} t={t} lang={lang} onAcepto={enviar} activo={fase === "consentimiento" && i === mensajes.length - 1} />
            </motion.div>
          ))}
        </AnimatePresence>
        {(escribiendo || fase === "enviando") && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1" aria-label={t.escribiendo}>
              {[0, 1, 2].map((n) => (
                <motion.span
                  key={n}
                  className="w-2 h-2 rounded-full bg-gray-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: n * 0.15 }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={finalRef} />
      </div>

      {/* Barra inferior: escribir mientras hay pregunta; adjuntar en el paso del CV. */}
      {pregunta && (
        <form onSubmit={responder} className="border-t border-gray-100 p-3 md:p-4 flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={borrador}
            maxLength={MAX_RESPUESTA}
            disabled={escribiendo}
            onChange={(e) => setBorrador(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) responder(e);
            }}
            placeholder={t.placeholder}
            aria-label={t.placeholder}
            className="flex-1 resize-none rounded-2xl bg-gray-100 px-4 py-3 font-body text-base text-black placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-red-500 max-h-40"
          />
          <button
            type="submit"
            disabled={!borrador.trim() || escribiendo}
            aria-label={t.enviar}
            className="flex-none w-12 h-12 rounded-full bg-black text-white flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-30"
          >
            <ArrowUp size={20} strokeWidth={3} />
          </button>
        </form>
      )}
      {(fase === "cv" || fase === "consentimiento") && !escribiendo && (
        <div className="border-t border-gray-100 p-3 md:p-4">
          <input ref={fileRef} type="file" accept="application/pdf" onChange={adjuntar} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 hover:border-black px-4 py-3 font-title font-bold text-black transition-colors"
          >
            <Paperclip size={18} />
            {cv ? t.cv.cambiar : t.cv.adjuntar}
          </button>
        </div>
      )}
    </div>
  );
}

function Burbuja({ m, t, lang, onAcepto, activo }) {
  const base = "max-w-[85%] md:max-w-[75%] px-4 py-3 font-body text-base leading-relaxed";
  const bot = `${base} bg-gray-100 text-black rounded-2xl rounded-bl-md`;

  if (m.de === "yo") {
    return (
      <div className={`${base} bg-black text-white rounded-2xl rounded-br-md`}>
        {m.archivo ? (
          <span className="inline-flex items-center gap-2 break-all">
            <FileText size={18} className="flex-none" />
            {m.archivo}
          </span>
        ) : (
          <span className="whitespace-pre-wrap break-words">{m.texto}</span>
        )}
      </div>
    );
  }

  if (m.tipo === "consentimiento") {
    return (
      <div className={bot}>
        <p>
          {t.consentimiento.antes}{" "}
          <Link href={path("privacidad", lang)} target="_blank" className="text-red-600 underline">
            {t.consentimiento.enlace}
          </Link>
          {t.consentimiento.despues}
        </p>
        {activo && (
          <button
            type="button"
            onClick={onAcepto}
            className="mt-3 inline-flex items-center gap-2 bg-red-600 text-white font-title font-bold uppercase tracking-wide text-sm px-5 py-2.5 rounded-full hover:bg-red-700 transition-colors"
          >
            {t.consentimiento.acepto}
          </button>
        )}
      </div>
    );
  }

  if (m.tipo === "fin") {
    return (
      <div className={bot}>
        <p>{t.fin.blog}</p>
        <Link
          href={path("blog", lang)}
          className="mt-3 inline-block bg-black text-white font-title font-bold uppercase tracking-wide text-sm px-5 py-2.5 rounded-full hover:bg-red-600 transition-colors"
        >
          {t.fin.cta}
        </Link>
      </div>
    );
  }

  return <div className={bot}>{m.texto}</div>;
}
