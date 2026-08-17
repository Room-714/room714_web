"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  deleteProspect,
  listProspects,
  registerEngagement,
  runDiscovery,
  saveProspect,
  setProspectStatus,
  skipProspect,
} from "./actions";

const STATUS_LABEL = {
  ACTIVE: "En rotación",
  PAUSED: "Pausado",
  CLIENT: "Cliente 🎉",
  DISCARDED: "Descartado",
};

const EMPTY_FORM = {
  id: null,
  name: "",
  company: "",
  role: "",
  linkedinUrl: "",
  sector: "",
  interest: "",
  keywords: "",
  notes: "",
  status: "ACTIVE",
};

function daysAgo(date) {
  if (!date) return null;
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  return days === 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} d`;
}

function ProspectsInner() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("prospectId");

  const [prospects, setProspects] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState(null);

  // Redactor
  const [drafting, setDrafting] = useState(null); // prospect seleccionado
  const [postText, setPostText] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [options, setOptions] = useState([]);
  const [busy, setBusy] = useState(false);

  // Origen: lo primero que se hace tras una tanda de Apollo es revisarla en
  // bloque, así que el filtro va arriba y no escondido.
  const [sourceFilter, setSourceFilter] = useState("all");

  const load = useCallback(async () => {
    const res = await listProspects();
    if (res?.success) setProspects(res.prospects || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Si venimos del briefing con ?prospectId=, abrimos el redactor directamente.
  useEffect(() => {
    if (!preselectedId || drafting || prospects.length === 0) return;
    const p = prospects.find((x) => x.id === Number(preselectedId));
    if (p) setDrafting(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedId, prospects]);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await saveProspect(form);
    setBusy(false);
    if (!res.success) return flash(`⚠️ ${res.error}`);
    setForm(EMPTY_FORM);
    setShowForm(false);
    flash("Prospecto guardado");
    load();
  };

  const handleDraft = async () => {
    if (postText.trim().length < 40) {
      return flash("⚠️ Pega el texto del post (mínimo 40 caracteres)");
    }
    setBusy(true);
    setOptions([]);
    try {
      const res = await fetch("/api/admin/prospects/draft-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: drafting?.id || null,
          postText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setOptions(data.options || []);
    } catch (err) {
      flash(`⚠️ ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleUsed = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* portapapeles no disponible: el registro sigue */
    }
    if (drafting) {
      const res = await registerEngagement({
        prospectId: drafting.id,
        comment: text,
        postUrl,
        postExcerpt: postText,
      });
      if (!res.success) return flash(`⚠️ ${res.error}`);
    }
    flash("Copiado y registrado. Pégalo en LinkedIn 👌");
    setDrafting(null);
    setPostText("");
    setPostUrl("");
    setOptions([]);
    load();
  };

  // Sin nada que comentar. Lo saca de la cabeza de la cola sin registrar un
  // comentario que no existe.
  const handleSkip = async () => {
    if (!drafting) return;
    setBusy(true);
    const res = await skipProspect(drafting.id, "sin actividad reciente");
    setBusy(false);
    if (!res.success) return flash(`⚠️ ${res.error}`);
    flash(res.message);
    setDrafting(null);
    setPostText("");
    setPostUrl("");
    setOptions([]);
    load();
  };

  const handleDelete = async (p) => {
    // Borrado real e irreversible: se lleva por delante su historial de
    // comentarios. Por eso confirma con el nombre delante.
    if (
      !window.confirm(
        `¿Borrar a ${p.name} definitivamente?\n\nSe eliminan también sus ${p.engagements?.length || 0} comentario(s) registrados. Esto no se puede deshacer.`,
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await deleteProspect(p.id);
    setBusy(false);
    if (!res.success) return flash(`⚠️ ${res.error}`);
    flash(`${p.name} borrado`);
    load();
  };

  const handleDiscover = async () => {
    // Esto cuesta dinero: 1 crédito por persona enriquecida, de 75 al mes.
    // Sin confirmación, dos clics distraídos son un tercio del presupuesto.
    if (
      !window.confirm(
        "Buscar prospectos gasta créditos de Apollo: hasta 10 en esta ejecución (1 por persona).\n\n¿Continuar?",
      )
    ) {
      return;
    }
    setBusy(true);
    flash("Buscando en Apollo...");
    const res = await runDiscovery();
    setBusy(false);
    if (!res.success) return flash(`⚠️ ${res.error}`);
    const r = res.result || {};
    flash(
      r.skipped
        ? `Sin cambios: ${r.reason}`
        : `${r.imported ?? 0} importados de ${r.enriched ?? 0} enriquecidos (${r.creditsSpent ?? 0} créditos). Quedan ${r.budgetLeft ?? "?"} este mes.`,
    );
    load();
  };

  const visibleProspects =
    sourceFilter === "all"
      ? prospects
      : prospects.filter((p) => (p.source || "manual") === sourceFilter);

  return (
    <main className="min-h-screen bg-gray-100 text-black p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-3xl font-black">Prospectos LinkedIn</h1>
        <div className="flex gap-4 items-center">
          <button
            onClick={handleDiscover}
            disabled={busy}
            className="border-2 border-black text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50"
          >
            {busy ? "Buscando..." : "Buscar prospectos ahora"}
          </button>
          <button
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowForm((v) => !v);
            }}
            className="bg-black text-white text-sm font-bold px-4 py-2 rounded-xl"
          >
            {showForm ? "Cerrar" : "+ Añadir prospecto"}
          </button>
          <Link href="/admin" className="text-sm font-bold underline">
            ← Volver al admin
          </Link>
        </div>
      </div>

      {notice && (
        <div className="mb-4 bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm font-bold">
          {notice}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-3xl border border-gray-200 p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {[
            ["name", "Nombre *", "Ana García"],
            ["company", "Empresa", "Acme SL"],
            ["role", "Cargo", "CPO"],
            ["linkedinUrl", "URL LinkedIn *", "https://www.linkedin.com/in/..."],
            ["sector", "Sector", "SaaS / fintech / retail..."],
            ["interest", "Servicio que encaja", "Rediseño UX/UI"],
            ["keywords", "Temas (coma)", "UX, churn, IA en producto"],
          ].map(([key, label, placeholder]) => (
            <label key={key} className="text-sm font-bold">
              {label}
              <input
                className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 font-normal"
                value={form[key]}
                placeholder={placeholder}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="text-sm font-bold md:col-span-2">
            Notas
            <textarea
              className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 font-normal"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <button
            disabled={busy}
            className="bg-black text-white font-bold px-6 py-2 rounded-xl md:col-span-2 disabled:opacity-50"
          >
            Guardar
          </button>
        </form>
      )}

      {/* Redactor de comentarios */}
      {drafting && (
        <div className="bg-white rounded-3xl border-2 border-black p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-black">
              Comentario para {drafting.name}
            </h2>
            <button
              onClick={() => {
                setDrafting(null);
                setOptions([]);
              }}
              className="text-sm underline"
            >
              cerrar
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            Pega el texto del post de {drafting.name} y te propongo dos
            comentarios con tu voz. Nada se publica solo: eliges, copias y
            pegas tú en LinkedIn.
          </p>
          <textarea
            className="w-full border border-gray-300 rounded-xl px-3 py-2 mb-3"
            rows={5}
            placeholder="Texto del post del prospecto..."
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
          />
          <input
            className="w-full border border-gray-300 rounded-xl px-3 py-2 mb-3 text-sm"
            placeholder="URL del post (opcional, para el historial)"
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
          />
          <div className="flex gap-3 items-center flex-wrap">
            <button
              onClick={handleDraft}
              disabled={busy}
              className="bg-black text-white font-bold px-6 py-2 rounded-xl disabled:opacity-50"
            >
              {busy ? "Redactando..." : "Proponme dos comentarios"}
            </button>
            <button
              onClick={handleSkip}
              disabled={busy}
              className="border border-gray-400 text-gray-700 font-bold px-6 py-2 rounded-xl disabled:opacity-50"
            >
              No ha publicado nada — saltar
            </button>
          </div>

          {options.length > 0 && (
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              {options.map((opt, i) => (
                <div
                  key={i}
                  className="border border-gray-300 rounded-2xl p-4 flex flex-col"
                >
                  <span className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                    {opt.approach}
                  </span>
                  <p className="text-sm whitespace-pre-wrap flex-1">{opt.text}</p>
                  <button
                    onClick={() => handleUsed(opt.text)}
                    className="mt-3 bg-black text-white text-sm font-bold px-4 py-2 rounded-xl"
                  >
                    Copiar y marcar como comentado
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      {prospects.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 border border-gray-200 text-center text-gray-500">
          Aún no hay prospectos. Añade el primero: el briefing diario empezará
          a incluirlo en la rotación de comentarios.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          <div className="flex items-center gap-2 p-4 text-sm">
            <span className="text-gray-500 font-bold mr-1">Origen:</span>
            {[
              ["all", "Todos"],
              ["apollo", "Apollo"],
              ["manual", "Manual"],
            ].map(([value, label]) => {
              const count =
                value === "all"
                  ? prospects.length
                  : prospects.filter((p) => (p.source || "manual") === value)
                      .length;
              return (
                <button
                  key={value}
                  onClick={() => setSourceFilter(value)}
                  className={`px-3 py-1 rounded-full font-bold ${
                    sourceFilter === value
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
          {visibleProspects.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 p-5 flex-wrap"
            >
              <div className="min-w-0">
                <p className="font-black">
                  {p.name}
                  <span
                    className={`ml-2 align-middle text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                      p.source === "apollo"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.source === "apollo" ? "Apollo" : "Manual"}
                  </span>
                  {p.company ? (
                    <span className="font-normal text-gray-500">
                      {" "}
                      · {p.role ? `${p.role}, ` : ""}
                      {p.company}
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-gray-500">
                  {STATUS_LABEL[p.status]}
                  {" · "}
                  {p.lastEngagedAt
                    ? `último comentario ${daysAgo(p.lastEngagedAt)}`
                    : "sin comentar aún"}
                  {p.engagements?.length
                    ? ` · ${p.engagements.length}+ registrados`
                    : ""}
                </p>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <a
                  href={p.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline"
                >
                  LinkedIn ↗
                </a>
                <button
                  onClick={() => {
                    setDrafting(p);
                    setOptions([]);
                    setPostText("");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="bg-black text-white text-sm font-bold px-4 py-2 rounded-xl"
                >
                  Comentar
                </button>
                <select
                  value={p.status}
                  onChange={async (e) => {
                    await setProspectStatus(p.id, e.target.value);
                    load();
                  }}
                  className="text-sm border border-gray-300 rounded-xl px-2 py-2 bg-white"
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={busy}
                  title="Borrar definitivamente"
                  className="text-sm font-bold text-red-600 px-2 py-2 rounded-xl hover:bg-red-50 disabled:opacity-50"
                >
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function ProspectsPage() {
  return (
    <Suspense fallback={null}>
      <ProspectsInner />
    </Suspense>
  );
}
