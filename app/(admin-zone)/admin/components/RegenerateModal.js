"use client";
import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles, X } from "lucide-react";

const STATE = {
  LOADING_IDEAS: "loading_ideas",
  SHOWING_IDEAS: "showing_ideas",
  REGENERATING: "regenerating",
  ERROR: "error",
};

export default function RegenerateModal({ postId, onClose, onRegenerated }) {
  const [state, setState] = useState(STATE.LOADING_IDEAS);
  const [ideas, setIdeas] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [meta, setMeta] = useState({ category: "", currentTitle: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/regenerate-ideas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
          credentials: "include",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        setIdeas(data.ideas || []);
        setMeta({ category: data.category, currentTitle: data.currentTitle });
        setState(STATE.SHOWING_IDEAS);
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err.message || "Error desconocido");
        setState(STATE.ERROR);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const handleSelect = async () => {
    if (selectedIdx === null) return;
    const chosenIdea = ideas[selectedIdx];
    setState(STATE.REGENERATING);
    try {
      const res = await fetch("/api/admin/regenerate-from-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, chosenIdea }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      onRegenerated(data);
    } catch (err) {
      setErrorMsg(err.message || "Error regenerando");
      setState(STATE.ERROR);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-200 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-4xl p-8 max-w-2xl w-full shadow-2xl relative">
        <button
          onClick={onClose}
          disabled={state === STATE.REGENERATING}
          className="absolute top-4 right-4 text-gray-400 hover:text-black disabled:opacity-30"
          aria-label="Cerrar"
        >
          <X className="w-6 h-6" />
        </button>

        {state === STATE.LOADING_IDEAS && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
            <p className="font-black uppercase text-sm tracking-widest">
              Generando ideas alternativas…
            </p>
            <p className="text-xs text-gray-400">
              Buscando ángulos en Medium + criterio editorial Room 714
            </p>
          </div>
        )}

        {state === STATE.SHOWING_IDEAS && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-black flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-red-500" />
                Elige un ángulo alternativo
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Categoría {meta.category} · Reemplazará: <em>"{meta.currentTitle}"</em>
              </p>
            </div>

            <div className="space-y-3">
              {ideas.map((idea, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
                    selectedIdx === idx
                      ? "border-black bg-black text-white"
                      : "border-gray-200 hover:border-gray-400 bg-white"
                  }`}
                >
                  <p className="font-black text-lg leading-tight mb-2">
                    {idea.title}
                  </p>
                  <p
                    className={`text-sm leading-relaxed ${
                      selectedIdx === idx ? "text-gray-200" : "text-gray-600"
                    }`}
                  >
                    {idea.hook}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-4 font-black uppercase tracking-widest text-sm text-gray-400 hover:text-black"
              >
                Cancelar
              </button>
              <button
                onClick={handleSelect}
                disabled={selectedIdx === null}
                className="flex-1 py-4 bg-red-500 text-white font-black uppercase tracking-widest text-sm rounded-2xl hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                <RefreshCw className="inline w-4 h-4 mr-2" />
                Regenerar
              </button>
            </div>
          </>
        )}

        {state === STATE.REGENERATING && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
            <p className="font-black uppercase text-sm tracking-widest">
              Regenerando post completo…
            </p>
            <p className="text-xs text-gray-400 text-center">
              Generando contenido ES+EN y nueva imagen. ~30 segundos.
            </p>
          </div>
        )}

        {state === STATE.ERROR && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <p className="font-black text-red-500 uppercase text-sm tracking-widest">
              Error
            </p>
            <p className="text-sm text-gray-600 text-center max-w-md break-words">
              {errorMsg}
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-3 bg-black text-white font-black uppercase tracking-widest text-sm rounded-xl"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
