"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  acceptCandidate,
  listProspects,
  loadQueue,
  rejectCandidate,
  setProspectStatus,
} from "./actions";

// Los cinco motivos, con el texto que se le enseña a quien decide. El orden
// importa: los tres primeros son los que más se van a usar.
const REASONS = [
  ["role", "El cargo no encaja"],
  ["sector", "El sector no encaja"],
  ["size", "El tamaño no encaja"],
  ["in_house_team", "Ya tienen equipo propio"],
  ["other", "Otro motivo"],
];

const STATUS_LABEL = {
  ACTIVE: "En rotación",
  CLIENT: "Cliente",
  DISCARDED: "Descartado",
};

function CreditHeader({ credits, decididosSesion }) {
  const fecha = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(credits.nextReset));

  return (
    <div className="rounded-xl border p-4 mb-6 bg-white">
      <p className="text-2xl font-black">
        {credits.remaining} de {credits.cap} créditos
      </p>
      <p className="text-sm text-gray-600">
        Renueva el {fecha}, dentro de {credits.daysToReset} días ·{" "}
        {credits.pacePerWorkday.toFixed(1)} al día si te los quieres gastar todos
      </p>
      {/* "En esta sesión" y no "hoy": esta pestaña se abre una vez cada
          mañana, pero si alguien la recarga a media revisión (un F5, volver
          después de comer para terminar la cola) un contador que dijera "hoy"
          mentiría a cero aunque ya hubiera diez decisiones tomadas. "Sesión"
          es la única frase que es siempre verdad, se recargue cuando se
          recargue. Cuenta también los descartes, no solo los "sí": la
          cabecera habla de "decisiones", y un "no" es una decisión tan real
          como un "sí". */}
      <p className="text-sm text-gray-600">
        En esta sesión llevas {decididosSesion} decisiones.
      </p>
      {credits.exhausted && (
        <p className="mt-2 text-sm font-bold text-red-700">
          Sin créditos en este ciclo. Puedes seguir descartando, que es gratis.
        </p>
      )}
    </div>
  );
}

function CandidateCard({ candidato, exhausted, onAccept, onReject }) {
  const [eligiendoMotivo, setEligiendoMotivo] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const criterio = [
    candidato.sectorQuery,
    candidato.sizeQuery ? `${candidato.sizeQuery.replace(",", "-")} empleados` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-xl border p-4 bg-white">
      <p className="text-lg font-bold">{candidato.title || "(sin cargo)"}</p>
      <p className="text-gray-800">{candidato.company || "(sin empresa)"}</p>

      {criterio && (
        <p className="mt-1 text-xs text-gray-500">
          Buscado como: {criterio}.{" "}
          <span className="italic">
            Es el criterio con el que se buscó, no datos comprobados de la empresa:
            la búsqueda de Apollo no devuelve ni sector ni plantilla.
          </span>
        </p>
      )}

      <textarea
        className="mt-3 w-full rounded border p-2 text-sm"
        rows={2}
        placeholder="Nota (opcional): lo que no cabe en los cinco motivos"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {!eligiendoMotivo ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            disabled={busy || exhausted}
            title={exhausted ? "Sin créditos en este ciclo" : undefined}
            className="rounded bg-black px-4 py-2 font-bold text-white disabled:opacity-40"
            onClick={async () => {
              setBusy(true);
              await onAccept(candidato.id, note);
              setBusy(false);
            }}
          >
            Sí · 1 crédito
          </button>
          <button
            disabled={busy}
            className="rounded border px-4 py-2 font-bold"
            onClick={() => setEligiendoMotivo(true)}
          >
            No
          </button>
          {exhausted && (
            <span className="text-xs text-red-700">Sin créditos: solo puedes descartar</span>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="mb-2 text-sm font-bold">¿Por qué no?</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map(([code, label]) => (
              <button
                key={code}
                disabled={busy}
                className="rounded border px-3 py-1 text-sm"
                onClick={async () => {
                  setBusy(true);
                  await onReject(candidato.id, code, note);
                  setBusy(false);
                }}
              >
                {label}
              </button>
            ))}
            <button
              className="px-3 py-1 text-sm underline"
              onClick={() => setEligiendoMotivo(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Lo primero que se quiere hacer tras decir que sí: abrir el perfil. Se
// enseña solo lo aceptado en ESTA sesión porque es justo lo que se acaba de
// decidir y todavía no se ha abierto; lo de sesiones anteriores ya vive en la
// pestaña de validados.
function AceptadosRecientes({ aceptados }) {
  if (aceptados.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border p-4 bg-white">
      <p className="mb-2 text-sm font-bold">
        Aceptados en esta sesión, para abrir ahora:
      </p>
      <ul className="flex flex-col gap-1">
        {aceptados.map((a) => (
          <li key={a.id}>
            <a
              href={a.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline break-all"
            >
              {a.linkedinUrl} ↗
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// El panel de "por qué la búsqueda hace lo que hace". Plegado por defecto:
// es material de auditoría, no algo que haya que mirar en cada decisión.
function LearningPanel({ stats, notes }) {
  // "Cronológico" de verdad, no "como llegó de la BD": el servidor manda las
  // notas más recientes primero (para poder cortar en las últimas 30 sin
  // perder las importantes), pero un panel que explica el aprendizaje se lee
  // mejor como una historia, de la más antigua a la más nueva.
  const notasCronologicas = [...notes].sort(
    (a, b) => new Date(a.decidedAt) - new Date(b.decidedAt),
  );

  const motivos = REASONS.filter(([code]) => stats.reasonCounts[code]);

  return (
    <details className="mb-6 rounded-xl border bg-white p-4">
      <summary className="cursor-pointer font-bold">
        Lo que ha aprendido el filtro
      </summary>

      <div className="mt-4 grid gap-6 text-sm md:grid-cols-2">
        <div>
          <p className="font-bold">
            Cargos excluidos ({stats.excludedTitles.length})
          </p>
          {stats.excludedTitles.length === 0 ? (
            <p className="text-gray-500">Ninguno todavía.</p>
          ) : (
            <ul className="list-disc pl-5">
              {stats.excludedTitles.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="font-bold">
            Tramos de plantilla excluidos ({stats.excludedSizes.length})
          </p>
          {stats.excludedSizes.length === 0 ? (
            <p className="text-gray-500">Ninguno todavía.</p>
          ) : (
            <ul className="list-disc pl-5">
              {stats.excludedSizes.map((s) => (
                <li key={s}>{s.replace(",", "-")} empleados</li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="font-bold">Sectores por tasa de acierto</p>
          {stats.sectorsByHitRate.length === 0 ? (
            <p className="text-gray-500">Aún sin datos.</p>
          ) : (
            <ul className="list-disc pl-5">
              {stats.sectorsByHitRate.map((s) => (
                <li key={s.sector}>
                  {s.sector}: {s.hits}/{s.total} ({Math.round(s.rate * 100)}%)
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="font-bold">Motivos de descarte</p>
          {motivos.length === 0 ? (
            <p className="text-gray-500">Ningún descarte todavía.</p>
          ) : (
            <ul className="list-disc pl-5">
              {motivos.map(([code, label]) => (
                <li key={code}>
                  {label}: {stats.reasonCounts[code]}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-2">
          <p className="font-bold">Notas dejadas al decidir</p>
          {notasCronologicas.length === 0 ? (
            <p className="text-gray-500">Ninguna todavía.</p>
          ) : (
            <ul className="list-disc pl-5">
              {notasCronologicas.map((n, i) => (
                <li key={i}>
                  <span className="text-gray-500">
                    {new Date(n.decidedAt).toLocaleDateString("es-ES")} ·{" "}
                    {n.company || "(sin empresa)"}:
                  </span>{" "}
                  {n.note}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}

// La pestaña de validados: el resultado del sistema, y el único sitio donde
// se corrige el estado de alguien ya aceptado (por ejemplo, a "Cliente"
// cuando firma).
function ValidadosTab() {
  const [prospects, setProspects] = useState(null);

  const load = useCallback(async () => {
    const res = await listProspects();
    if (res.success) setProspects(res.prospects || []);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      await load();
    };
    fetchData();
  }, [load]);

  if (prospects === null) {
    return <p className="p-4 text-gray-600">Cargando…</p>;
  }

  if (prospects.length === 0) {
    return (
      <p className="rounded-xl border bg-white p-6 text-center text-gray-600">
        Todavía no hay nadie validado.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {prospects.map((p) => (
        <div
          key={p.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"
        >
          <div className="min-w-0">
            <p className="font-bold">{p.name}</p>
            <p className="text-sm text-gray-600">
              {[p.role, p.company].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={p.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline"
            >
              LinkedIn ↗
            </a>
            <select
              value={p.status}
              onChange={async (e) => {
                const nuevoEstado = e.target.value;
                // Optimista: se ve el cambio al instante y, si el servidor lo
                // rechazara, la siguiente carga de la pestaña lo corregiría.
                setProspects((prev) =>
                  prev.map((x) =>
                    x.id === p.id ? { ...x, status: nuevoEstado } : x,
                  ),
                );
                await setProspectStatus(p.id, nuevoEstado);
              }}
              className="rounded border px-2 py-1 text-sm bg-white"
            >
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProspectsPage() {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [aceptados, setAceptados] = useState([]); // {id, linkedinUrl}
  // Cuenta sí Y no de esta sesión: ver el comentario dentro de CreditHeader
  // para por qué es "sesión" y por qué cuenta los descartes.
  const [decididosSesion, setDecididosSesion] = useState(0);
  const [vista, setVista] = useState("cola"); // "cola" | "validados"

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const load = useCallback(async () => {
    const res = await loadQueue();
    if (res.success) setData(res);
    else flash(`⚠️ ${res.error}`);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      await load();
    };
    fetchData();
  }, [load]);

  // NOTA sobre `load()` y las tarjetas que NO se deciden: recarga la cola
  // entera, pero cada <CandidateCard> va con `key={c.id}`. Mientras ese id
  // siga en `data.queue` (que es el caso de cualquier candidato pendiente que
  // no acabas de decidir), React reutiliza la misma instancia del componente
  // en vez de desmontarla y crear otra: el `note` y el `eligiendoMotivo` que
  // alguien dejó a medias en OTRA ficha sobreviven a la recarga tal cual.
  // Solo desaparece, con razón, la ficha que se acaba de decidir. Comprobado
  // a propósito antes de dar esto por bueno: es la razón de usar `c.id` como
  // key y no el índice de la lista.
  const handleAccept = async (id, note) => {
    const res = await acceptCandidate({ id, note });
    if (!res.success) return flash(`⚠️ ${res.error}`);
    // Se guarda el enlace para poder abrirlo sin buscarlo: es lo primero que se
    // quiere hacer después de decir que sí.
    setAceptados((prev) => [...prev, { id, linkedinUrl: res.linkedinUrl }]);
    setDecididosSesion((n) => n + 1);
    flash(res.duplicado ? "Ya estaba en la lista" : "Añadido a validados");
    load();
  };

  const handleReject = async (id, reasonCode, note) => {
    const res = await rejectCandidate({ id, reasonCode, note });
    if (!res.success) return flash(`⚠️ ${res.error}`);
    setDecididosSesion((n) => n + 1);
    load();
  };

  if (!data) return <p className="p-6">Cargando…</p>;

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black md:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-black">Prospección: cola diaria</h1>
        <Link href="/admin" className="text-sm font-bold underline">
          ← Volver al admin
        </Link>
      </div>

      {notice && (
        <div className="mb-4 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold">
          {notice}
        </div>
      )}

      <CreditHeader credits={data.credits} decididosSesion={decididosSesion} />
      <AceptadosRecientes aceptados={aceptados} />
      <LearningPanel stats={data.stats} notes={data.notes} />

      <div className="mb-4 flex gap-2">
        {[
          ["cola", `Cola (${data.queue.length})`],
          ["validados", "Validados"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setVista(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold ${
              vista === value ? "bg-black text-white" : "border bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === "cola" ? (
        <>
          <div className="grid gap-4">
            {data.queue.map((c) => (
              <CandidateCard
                key={c.id}
                candidato={c}
                exhausted={data.credits.exhausted}
                onAccept={handleAccept}
                onReject={handleReject}
              />
            ))}
          </div>
          {data.queue.length === 0 && (
            <p className="rounded-xl border bg-white p-6 text-center text-gray-600">
              Cola vacía. La siguiente llega mañana a las 06:00.
            </p>
          )}
        </>
      ) : (
        <ValidadosTab />
      )}
    </main>
  );
}
