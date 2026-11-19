"use client";
import { useCallback, useEffect, useState } from "react";
import {
  aprobarLinkedIn,
  borradorPerfilJose,
  marcarLinkedIn,
  obtenerLinkedIn,
  retirarAprobacionLinkedIn,
} from "../linkedinActions";
import { ETIQUETAS, LIMITE_SEMANAL } from "@/app/lib/linkedin/aprobacion";

const COLOR_ESTADO = {
  SOLO_WEB: "bg-gray-100 text-gray-600 border-gray-300",
  PENDIENTE: "bg-amber-50 text-amber-800 border-amber-300",
  APROBADO: "bg-sky-50 text-sky-800 border-sky-300",
  PUBLICADO: "bg-green-50 text-green-800 border-green-300",
};

const fechaMadrid = (iso) =>
  iso
    ? new Date(iso).toLocaleString("es-ES", {
        timeZone: "Europe/Madrid",
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

// Publicación en LinkedIn de un post. Todos los avisos y confirmaciones van
// dentro de la página: nada de alert() ni confirm().
export default function LinkedInPanel({ postId, onCambio }) {
  const [info, setInfo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null); // conflictos del límite semanal
  const [borrador, setBorrador] = useState("");
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    const r = await obtenerLinkedIn(postId);
    if (r.success) setInfo(r);
    else setError(r.error);
  }, [postId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ejecutar = async (accion) => {
    setOcupado(true);
    setError(null);
    try {
      const r = await accion();
      if (r.necesitaConfirmacion) {
        setAviso(r);
        return;
      }
      if (!r.success) {
        setError(r.error);
        return;
      }
      setAviso(null);
      await cargar();
      onCambio?.();
    } finally {
      setOcupado(false);
    }
  };

  const generarBorrador = async () => {
    setGenerando(true);
    setError(null);
    setCopiado(false);
    try {
      const r = await borradorPerfilJose(postId);
      if (r.success) setBorrador(r.texto);
      else setError(r.error);
    } finally {
      setGenerando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(borrador);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setError("No se pudo copiar. Selecciona el texto y cópialo a mano.");
    }
  };

  const estado = info?.estado ?? "SOLO_WEB";
  const marcado = estado !== "SOLO_WEB";
  const publicado = estado === "PUBLICADO";

  return (
    <section
      aria-labelledby="linkedin-titulo"
      className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="linkedin-titulo" className="text-lg pl-4 font-black text-gray-400">
          LinkedIn
        </h3>
        {info && (
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${COLOR_ESTADO[estado]}`}
          >
            {ETIQUETAS[estado]}
          </span>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={marcado}
          disabled={!info || ocupado || publicado}
          onChange={(e) => ejecutar(() => marcarLinkedIn(postId, e.target.checked))}
          className="mt-1 h-5 w-5 accent-black"
        />
        <span>
          <span className="font-bold">
            Publicar en LinkedIn (página de empresa de Room 714)
          </span>
          <span className="block text-xs text-gray-500">
            Desmarcada, el post sale solo en la web. Marcarla no publica nada:
            queda pendiente de tu aprobación. Máximo {LIMITE_SEMANAL} publicación
            por semana.
          </span>
        </span>
      </label>

      {info?.vistaPrevia && marcado && !publicado && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase">
            Texto que se publicará
          </p>
          <p className="whitespace-pre-line">{info.vistaPrevia.texto}</p>
          {info.vistaPrevia.hashtags && (
            <p className="text-sky-700">{info.vistaPrevia.hashtags}</p>
          )}
          <p className="text-xs text-gray-500 break-all">
            Enlace (primer comentario): {info.vistaPrevia.url}
          </p>
        </div>
      )}

      {estado === "PENDIENTE" && !aviso && (
        <button
          type="button"
          onClick={() => ejecutar(() => aprobarLinkedIn(postId))}
          disabled={ocupado}
          className="w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-sky-700 transition-colors disabled:opacity-50"
        >
          Aprobar publicación en LinkedIn
        </button>
      )}

      {aviso && (
        <div
          role="alertdialog"
          aria-labelledby="aviso-semana-titulo"
          className="bg-white border-2 border-amber-500 rounded-xl p-4 text-sm space-y-3"
        >
          <p id="aviso-semana-titulo" className="font-bold">
            Esa semana ya hay {aviso.conflictos.length === 1
              ? "una publicación"
              : `${aviso.conflictos.length} publicaciones`}{" "}
            en la página de empresa (el límite es {LIMITE_SEMANAL}).
          </p>
          <ul className="list-disc pl-5 text-gray-700">
            {aviso.conflictos.map((c) => (
              <li key={`${c.postId}-${c.fecha}`}>
                «{c.titulo}» — {ETIQUETAS[c.estado]?.toLowerCase()},{" "}
                {fechaMadrid(c.fecha)}
              </li>
            ))}
          </ul>
          <p className="text-gray-600">
            Este post saldría el {fechaMadrid(aviso.fechaPrevista)}. ¿Lo apruebas
            igualmente?
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() =>
                ejecutar(() => aprobarLinkedIn(postId, { confirmarSegunda: true }))
              }
              disabled={ocupado}
              className="flex-1 bg-amber-600 text-white font-bold py-2 rounded-xl hover:bg-amber-700 disabled:opacity-50"
            >
              Sí, aprobar igualmente
            </button>
            <button
              type="button"
              onClick={() => setAviso(null)}
              className="flex-1 border-2 border-black font-bold py-2 rounded-xl hover:bg-black hover:text-white"
            >
              No, dejarlo pendiente
            </button>
          </div>
        </div>
      )}

      {estado === "APROBADO" && (
        <div className="text-sm space-y-2">
          <p>
            Aprobado. Saldrá en la página de empresa hacia el{" "}
            <strong>{fechaMadrid(info.fechaPrevista)}</strong> (cuando el post
            esté en la web y pase el envío de las mañanas, L-V de 07:00 a 10:00).
          </p>
          <button
            type="button"
            onClick={() => ejecutar(() => retirarAprobacionLinkedIn(postId))}
            disabled={ocupado}
            className="text-xs font-bold underline text-gray-600 hover:text-red-600 disabled:opacity-50"
          >
            Retirar aprobación
          </button>
        </div>
      )}

      {publicado && (
        <p className="text-sm">
          Publicado en LinkedIn el <strong>{fechaMadrid(info.publicadoAt)}</strong>.
          Desde aquí no se modifica ni se borra.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700 font-bold">
          {error}
        </p>
      )}

      <div className="pt-4 border-t border-gray-200 space-y-3">
        <button
          type="button"
          onClick={generarBorrador}
          disabled={generando}
          className="w-full bg-white border-2 border-black font-bold py-3 rounded-xl hover:bg-black hover:text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {generando ? "Escribiendo borrador…" : "Borrador para el perfil de José"}
        </button>
        {borrador && (
          <div className="space-y-2">
            <textarea
              readOnly
              value={borrador}
              rows={10}
              aria-label="Borrador para el perfil personal de José"
              className="w-full p-3 rounded-xl border-2 border-gray-200 bg-white text-sm"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={copiar}
                className="bg-black text-white font-bold px-4 py-2 rounded-xl hover:bg-sky-700"
              >
                {copiado ? "Copiado ✓" : "Copiar texto"}
              </button>
              <span className="text-xs text-gray-500">
                No se publica nada: cópialo y publícalo tú desde tu perfil.
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
