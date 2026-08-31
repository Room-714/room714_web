"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  acceptCandidate,
  askCandidate,
  deepenCandidate,
  listProspects,
  loadQueue,
  regenerateIntro,
  rejectCandidate,
  setIntroText,
  setProspectStatus,
} from "./actions";
import { lookupLinksFor } from "@/app/lib/prospecting/lookupLinks";
import { SUGERENCIAS } from "@/app/lib/prospecting/prospectChat";

// Los siete motivos, con el texto que se le enseña a quien decide. El orden
// importa: los tres primeros son los que más se van a usar. `revenue` y
// `no_digital_need` son los dos que el cron ya escribía solo (son las puertas
// duras de score.js): ponerlos aquí es lo que permite que una persona tome a
// mano la MISMA decisión que la máquina toma sola, y que el panel de
// aprendizaje —que filtra `stats.reasonCounts` por esta lista— deje de
// esconder esos descartes.
const REASONS = [
  ["role", "El cargo no encaja"],
  ["sector", "El sector no encaja"],
  ["size", "El tamaño no encaja"],
  ["revenue", "La facturación no encaja"],
  ["no_digital_need", "No necesita producto digital"],
  ["in_house_team", "Ya tienen equipo propio"],
  ["other", "Otro motivo"],
];

const REASON_LABEL = Object.fromEntries(REASONS);

// Igual que documenta el enum ProspectStatus en schema.prisma: "ACTIVE // en
// la lista de validados". "En rotación" describía una fase que ya no existe.
const STATUS_LABEL = {
  ACTIVE: "En la lista de validados",
  CLIENT: "Cliente",
  DISCARDED: "Descartado",
};

// Los cuatro criterios del dossier, en el orden en que los evalúa qualify.js.
// Las etiquetas se repiten aquí en vez de importarse de qualify.js a
// propósito: ese módulo arrastra el cliente de Anthropic y los prompts enteros
// al bundle del navegador, y lo único que se necesita son cuatro palabras.
const CRITERIOS = [
  ["revenue", "Facturación"],
  ["digitalNeed", "Necesita producto digital"],
  ["itTeam", "Equipo IT"],
  ["advisory", "Necesidad de orientación"],
];

// Símbolo Y color, nunca solo color: un veredicto que solo se distingue por el
// tono se pierde para quien no distingue rojo y verde, y también para
// cualquiera que mire la pantalla de reojo. El símbolo es el dato; el color
// solo lo acelera.
const VEREDICTO = {
  pass: {
    simbolo: "✓",
    nombre: "Cumple",
    clase: "border-green-600 bg-green-50 text-green-700",
  },
  unclear: {
    simbolo: "?",
    nombre: "Sin confirmar",
    clase: "border-amber-600 bg-amber-50 text-amber-700",
  },
  fail: {
    simbolo: "✗",
    nombre: "No cumple",
    clase: "border-red-600 bg-red-50 text-red-700",
  },
};

// Un veredicto ausente o que no reconocemos NO se pinta como "cumple": el
// sesgo va hacia mirar más, igual que hace `factorDe` en score.js.
const VEREDICTO_DESCONOCIDO = {
  simbolo: "?",
  nombre: "Sin veredicto",
  clase: "border-gray-400 bg-gray-50 text-gray-600",
};

// LinkedIn corta las notas de invitación en 300 caracteres (ver introText.js).
const LIMITE_NOTA = 300;

// ─── Formato de las métricas ────────────────────────────────────────────────

// `null` NO es cero. Las tres métricas devuelven null cuando el denominador
// está vacío (metrics.js lo documenta: "Null y no Infinity cuando no hay
// aceptados: en pantalla se pinta '—', que es la verdad"). Pintar un 0 ahí
// convertiría "todavía no se sabe" en "va fatal", que es justo la confusión
// que estas métricas existen para evitar.
function numeroONada(valor, formatear) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";
  return formatear(valor);
}

const veces = (v) => numeroONada(v, (x) => x.toFixed(1));
const porcentaje = (v) => numeroONada(v, (x) => `${Math.round(x * 100)} %`);
const dolares = (v) => numeroONada(v, (x) => `${x.toFixed(2)} $`);

function Metrica({ nombre, valor, flecha, ayuda }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-gray-500">{nombre}</p>
      <p className="font-mono text-lg font-bold tabular-nums" title={ayuda}>
        {valor} <span className="text-xs font-normal text-gray-400">{flecha}</span>
      </p>
    </div>
  );
}

function CreditHeader({ credits, decididosSesion, metrics, costeDelPeriodo }) {
  const fecha = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(credits.nextReset));

  // Las fichas anteriores a esta fase pueden dejar `metrics` sin llegar (y una
  // carga a medias, sin `muestra`). Nada de esto puede tumbar la cabecera: si
  // no hay números, se dice que no los hay.
  const m = metrics ?? {};
  const muestra = m.muestra ?? {};
  const ventana = m.ventanaDias ?? 7;

  return (
    <div className="mb-6 flex flex-col gap-5 rounded-xl border bg-white p-4 md:flex-row">
      <div className="md:w-1/3">
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

      {/* El borde vertical solo en escritorio: en móvil las dos mitades van
          apiladas y una línea a la izquierda no separaría nada. */}
      <div className="flex flex-col gap-4 md:flex-1 md:border-l md:border-gray-200 md:pl-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              Embudo · últimos {ventana} días
            </p>
            <p className="text-sm">
              <span className="font-mono font-bold tabular-nums">
                {muestra.miradas ?? 0}
              </span>{" "}
              vistas →{" "}
              <span className="font-mono font-bold tabular-nums">
                {muestra.encoladas ?? 0}
              </span>{" "}
              en tu cola
            </p>
          </div>

          {/* "Estimado" delante y no de adorno: el número sale de aiCost.js,
              que multiplica tokens por una tabla de precios nuestra. No es la
              factura de Anthropic y la pantalla no puede dar a entender que lo
              sea. */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-500">
              Gasto estimado · últimos {ventana} días
            </p>
            <p className="font-mono text-sm font-bold tabular-nums">
              {dolares(costeDelPeriodo)}
            </p>
          </div>
        </div>

        <div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Metrica
              nombre="Vistazos por ficha"
              valor={veces(m.vistazosPorFicha)}
              flecha="↓"
              ayuda="Cuántas empresas hay que mirar para llenar un hueco de la cola. Debe bajar."
            />
            <Metrica
              nombre="Tasa de aceptación"
              valor={porcentaje(m.tasaAceptacion)}
              flecha="↑"
              ayuda="De las fichas que llegan a la cola, cuántas acabas aceptando. Debe subir."
            />
            <Metrica
              nombre="Coste por validado"
              valor={dolares(m.costePorValidado)}
              flecha="↓"
              ayuda="Lo que cuesta cada prospecto validado. Debe bajar."
            />
          </div>
          {/* El tamaño de la muestra va pegado a los números a propósito: una
              tasa del 100% con una sola decisión no significa nada, y quien
              mire tiene que poder desconfiar del número sin ir a buscar el
              denominador a otra parte. */}
          <p className="mt-2 text-[11px] text-gray-500">
            Muestra: {muestra.miradas ?? 0} miradas · {muestra.encoladas ?? 0} encoladas ·{" "}
            {muestra.decididas ?? 0} decididas · {muestra.aceptadas ?? 0} aceptadas
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── El dossier de la ficha ─────────────────────────────────────────────────

// Las fuentes llegan como cadenas del modelo: casi siempre URLs, pero no hay
// nada que lo garantice. Una cadena que no es una URL se pinta como texto y no
// como un enlace roto.
function hostDe(fuente) {
  try {
    const u = new URL(fuente);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function Fuentes({ sources }) {
  const lista = Array.isArray(sources) ? sources.filter(Boolean) : [];
  if (lista.length === 0) return null;

  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      {lista.map((s, i) => {
        const host = hostDe(s);
        return host ? (
          <a
            key={`${s}-${i}`}
            href={s}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline"
          >
            {host} ↗
          </a>
        ) : (
          <span key={`${s}-${i}`} className="text-gray-500">
            {s}
          </span>
        );
      })}
    </p>
  );
}

function Criterio({ etiqueta, veredicto }) {
  const pinta = VEREDICTO[veredicto?.verdict] ?? VEREDICTO_DESCONOCIDO;

  // La cifra de facturación es el dato más caro de equivocar de los cuatro, y
  // viene aparte del `value` en prosa. Se enseña cuando la hay.
  const cifra = Number.isFinite(veredicto?.amountEurM)
    ? ` (${veredicto.amountEurM} M€)`
    : "";

  return (
    <div className="flex gap-2">
      <span
        role="img"
        aria-label={`${etiqueta}: ${pinta.nombre}`}
        title={pinta.nombre}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${pinta.clase}`}
      >
        {pinta.simbolo}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-gray-500">{etiqueta}</p>
        <p className="text-sm font-bold">
          {veredicto?.value || "(sin dato)"}
          {cifra}
        </p>
        {veredicto?.evidence && (
          <p className="text-xs text-gray-600">{veredicto.evidence}</p>
        )}
        <Fuentes sources={veredicto?.sources} />
      </div>
    </div>
  );
}

// "Se parece a X, que descartaste". Se filtra a los vecinos que de verdad
// dicen algo: `nearest` no filtra por `kind`, así que puede devolver
// documentos sin empresa o sin decisión, y la frase de la plantilla los
// pintaría como "Se parece a , que descartaste" — que además de vacío es
// falso, porque un `decision` nulo no es un "no".
function SeParece({ neighbors }) {
  const utiles = (Array.isArray(neighbors) ? neighbors : []).filter(
    (v) => v?.company && (v.decision === "yes" || v.decision === "no"),
  );

  // Nada, ni un "sin datos" ni un hueco: con la memoria fría esto es ruido que
  // no ayuda a decidir.
  if (utiles.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-[11px] uppercase tracking-wider text-gray-500">Se parece a</p>
      <ul className="mt-1 flex flex-col gap-0.5 text-sm text-gray-700">
        {utiles.map((v, i) => (
          <li key={`${v.company}-${i}`}>
            Se parece a <span className="font-bold">{v.company}</span>, que{" "}
            {v.decision === "yes" ? "aceptaste" : "descartaste"}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── El chat de la ficha ────────────────────────────────────────────────────

function Burbuja({ mensaje }) {
  const esMio = mensaje.role === "user";
  return (
    <div className={`flex ${esMio ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
          esMio ? "bg-black text-white" : "border bg-white text-black"
        }`}
      >
        {mensaje.content}
      </p>
    </div>
  );
}

function CandidateCard({
  candidato,
  exhausted,
  profundizando,
  onAccept,
  onReject,
  onDeepen,
}) {
  const [eligiendoMotivo, setEligiendoMotivo] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // El hilo vive AQUÍ, en la tarjeta, y no dentro del panel del chat: si
  // viviera en el panel, cerrarlo lo borraría y volver a abrirlo empezaría de
  // cero. Aquí sobrevive a cerrar y abrir, y también a los `load()` que
  // dispara decidir OTRA ficha, porque la key de la tarjeta es `c.id` y React
  // reutiliza la instancia mientras ese id siga en la cola.
  const [chatAbierto, setChatAbierto] = useState(false);
  const [hilo, setHilo] = useState([]); // {role: "user"|"assistant", content}
  const [pregunta, setPregunta] = useState("");
  const [pensando, setPensando] = useState(false);

  const criterio = [
    candidato.sectorQuery,
    candidato.sizeQuery ? `${candidato.sizeQuery.replace(",", "-")} empleados` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const enlaces = lookupLinksFor({
    title: candidato.title,
    company: candidato.company,
  });

  const dossier = candidato.dossier ?? null;
  const veredictos = dossier?.veredictos ?? null;
  const score = Number.isFinite(candidato.score) ? candidato.score : null;
  const aFondo = candidato.depth === "fondo";
  // `depth` es null en las 16 fichas que ya estaban en la cola antes de que
  // existiera la cualificación. "vistazo" ahí sería mentira: nadie las miró.
  const nivel = aFondo ? "a fondo" : candidato.depth === "vistazo" ? "vistazo" : "sin analizar";

  const enviarPregunta = async (texto) => {
    const limpio = String(texto ?? "").trim();
    if (!limpio || pensando) return;

    // El historial que viaja al servidor es el ANTERIOR a esta pregunta: la
    // acción añade la pregunta nueva al final por su cuenta, y mandarla dos
    // veces la duplicaría en el contexto del modelo.
    const historial = hilo;
    setHilo([...historial, { role: "user", content: limpio }]);
    setPregunta("");
    setPensando(true);

    const res = await askCandidate({ id: candidato.id, pregunta: limpio, historial });

    setPensando(false);
    setHilo((prev) => [
      ...prev,
      {
        role: "assistant",
        content: res.success ? res.text : `⚠️ No he podido responder: ${res.error}`,
      },
    ]);
  };

  return (
    <div className="rounded-xl border bg-white p-4">
      {/* ─── Cabecera ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xl font-black">{candidato.company || "(sin empresa)"}</p>
          <p className="text-gray-800">
            {candidato.title || "(sin cargo)"}{" "}
            {/* Lo que compra el crédito, dicho antes de gastarlo: Apollo
                ofusca el apellido en la búsqueda, así que hasta aceptar solo
                hay una inicial y ninguna URL. */}
            <span className="text-xs text-gray-500">
              {candidato.name ? `${candidato.name} — ` : ""}nombre completo y LinkedIn tras
              aceptar
            </span>
          </p>
        </div>

        <div className="w-28 shrink-0 text-right">
          <p className="font-mono text-3xl font-black leading-none tabular-nums">
            {score === null ? "—" : score}
          </p>
          <div className="mt-1 h-1 w-full rounded-full bg-gray-200">
            <div
              className="h-1 rounded-full bg-black"
              style={{ width: `${score === null ? 0 : Math.max(0, Math.min(100, score))}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-gray-500">{nivel}</p>
        </div>
      </div>

      {criterio && (
        <p className="mt-1 text-xs text-gray-500">
          Buscado como: {criterio}.{" "}
          <span className="italic">
            Es el criterio con el que se buscó, no datos comprobados de la empresa:
            la búsqueda de Apollo no devuelve ni sector ni plantilla.
          </span>
        </p>
      )}

      {/* ─── Los cuatro criterios ─────────────────────────────────────── */}
      {veredictos ? (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {CRITERIOS.map(([clave, etiqueta]) => (
            <Criterio key={clave} etiqueta={etiqueta} veredicto={veredictos[clave]} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
          Esta ficha es anterior a la cualificación con IA: no tiene análisis. Puedes
          analizarla a fondo aquí abajo, o decidirla con los enlaces de búsqueda.
        </p>
      )}

      {dossier?.summary && (
        <p className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          {dossier.summary}
        </p>
      )}

      <SeParece neighbors={candidato.neighbors} />

      {/* Investigar antes de pagar. La URL de LinkedIn de la persona no puede
          estar aquí —es justo lo que se compra con el crédito— pero buscarla uno
          mismo es gratis, y sin ninguna forma de mirar, la decisión se toma con
          el cargo y el nombre de la empresa a secas. */}
      {enlaces.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-3 text-xs">
          {enlaces.map((l) => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline"
            >
              {l.label} ↗
            </a>
          ))}
        </p>
      )}

      {/* ─── Zona gratis ──────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* El precio va escrito en el botón a propósito: esta decisión se toma
            decenas de veces al mes y el gasto tiene que verse ANTES de pulsar,
            no en una factura a fin de mes. Desaparece cuando ya se pagó: un
            segundo análisis sobre la misma ficha cuesta otros 0,35 $ y parte
            del mismo material. */}
        {!aFondo && (
          <button
            disabled={profundizando}
            className="rounded border px-4 py-2 text-sm font-bold disabled:opacity-40"
            onClick={() => onDeepen(candidato.id)}
          >
            {profundizando ? "Analizando a fondo… (20-40 s)" : "Analizar a fondo · ~0,35 $"}
          </button>
        )}
        <button
          className="rounded border px-4 py-2 text-sm font-bold"
          onClick={() => setChatAbierto((v) => !v)}
        >
          {chatAbierto ? "Cerrar el chat" : "Preguntar sobre la empresa"}
          {hilo.length > 0 && !chatAbierto ? ` (${hilo.length})` : ""}
        </button>
      </div>

      {chatAbierto && (
        <div className="mt-3 rounded-lg border bg-gray-50 p-3">
          {hilo.length === 0 && !pensando && (
            <p className="text-sm text-gray-500">
              Pregunta lo que te falte para decidir esta ficha.
            </p>
          )}

          <div className="flex flex-col gap-2">
            {hilo.map((m, i) => (
              <Burbuja key={i} mensaje={m} />
            ))}
            {pensando && (
              <div className="flex justify-start">
                <p className="max-w-[85%] rounded-2xl border bg-white px-3 py-2 text-sm italic text-gray-500">
                  Pensando y buscando en la web…
                </p>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={pensando}
                className="rounded-full border bg-white px-3 py-1 text-xs disabled:opacity-40"
                onClick={() => setPregunta(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={pregunta}
              disabled={pensando}
              placeholder="Escribe tu pregunta…"
              className="flex-1 rounded border bg-white p-2 text-sm disabled:opacity-40"
              onChange={(e) => setPregunta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  enviarPregunta(pregunta);
                }
              }}
            />
            <button
              disabled={pensando || !pregunta.trim()}
              className="rounded bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              onClick={() => enviarPregunta(pregunta)}
            >
              Enviar
            </button>
          </div>

          <p className="mt-2 text-[11px] text-gray-500">
            El chat no gasta créditos de Apollo y no se guarda: existe para decidir esta
            ficha.
          </p>
        </div>
      )}

      {/* ─── La línea del crédito ─────────────────────────────────────── */}
      {/* Todo lo de arriba es gratis; todo lo de abajo cuesta un crédito de
          Apollo. Separarlo con una línea es lo que hace que el gasto sea una
          decisión y no un descuido. */}
      <div className="my-4 flex items-center gap-3">
        <hr className="flex-1 border-gray-300" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          a partir de aquí se gasta 1 crédito
        </span>
        <hr className="flex-1 border-gray-300" />
      </div>

      {/* ─── Zona que cuesta ──────────────────────────────────────────── */}
      <textarea
        className="w-full rounded border p-2 text-sm"
        rows={2}
        placeholder="Nota (opcional): lo que no cabe en los siete motivos"
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
    <div className="mb-6 rounded-xl border bg-white p-4">
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
              className="break-all text-sm underline"
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

  // Filtra por REASONS, así que al ampliar la lista a siete motivos este panel
  // recoge solo `revenue` y `no_digital_need`: los descartes que el cron ya
  // escribía y que hasta ahora este recuento se comía en silencio.
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

// ─── La nota de invitación ──────────────────────────────────────────────────

// Se presenta como un BORRADOR, no como un resultado terminado, y la edición
// es en el sitio. No es una preferencia estética: las notas que se reescriben
// a mano son el único material de tono que aprende el sistema para las
// siguientes (`ultimasNotasDeOtros` en actions.js las ordena por `updatedAt`).
// Una nota presentada como un texto acabado para copiar y pegar no la edita
// nadie, y entonces el modelo acaba imitándose a sí mismo en un bucle cerrado
// que ninguna persona corrige nunca.
function NotaDeInvitacion({ prospecto, onNota }) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");
  const [ocupado, setOcupado] = useState(null); // "regenerar" | "guardar" | null
  const [aviso, setAviso] = useState(null);

  const nota = prospecto.introText;

  const generar = async () => {
    setOcupado("regenerar");
    setAviso(null);
    // `regenerateIntro` vale también para la primera: genera y guarda. No hay
    // una acción "generar" aparte porque no haría nada distinto.
    const res = await regenerateIntro(prospecto.id);
    setOcupado(null);
    if (res.success) {
      onNota(res.introText);
      setEditando(false);
    } else {
      setAviso(`⚠️ ${res.error}`);
    }
  };

  const guardar = async () => {
    setOcupado("guardar");
    setAviso(null);
    const res = await setIntroText(prospecto.id, borrador);
    setOcupado(null);
    if (res.success) {
      // Se refleja lo que devuelve el servidor, no lo que había en la caja:
      // `setIntroText` recorta a 300 con la misma función que el generador, y
      // enseñar el texto sin recortar mentiría justo sobre el límite.
      onNota(res.introText);
      setEditando(false);
    } else {
      setAviso(`⚠️ ${res.error}`);
    }
  };

  const copiar = async () => {
    setAviso(null);
    try {
      await navigator.clipboard.writeText(nota);
      setAviso("Copiada");
      setTimeout(() => setAviso(null), 2000);
    } catch {
      setAviso("⚠️ El navegador no ha dejado copiar. Selecciónala y cópiala a mano.");
    }
  };

  if (!nota && !editando) {
    return (
      <div className="mt-3 border-t pt-3">
        <button
          disabled={ocupado === "regenerar"}
          className="rounded border px-3 py-1.5 text-sm font-bold disabled:opacity-40"
          onClick={generar}
        >
          {ocupado === "regenerar" ? "Generando…" : "Generar nota"}
        </button>
        {aviso && <p className="mt-2 text-xs text-gray-600">{aviso}</p>}
      </div>
    );
  }

  const longitud = editando ? borrador.length : (nota?.length ?? 0);
  const pasado = longitud > LIMITE_NOTA;

  return (
    <div className="mt-3 border-t pt-3">
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="mb-1 text-[11px] uppercase tracking-wider text-gray-500">
          Borrador de la nota de invitación
        </p>

        {editando ? (
          <textarea
            className="w-full rounded border bg-white p-2 text-sm"
            rows={4}
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm">{nota}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span
            className={`font-mono text-xs tabular-nums ${
              pasado ? "font-bold text-red-700" : "text-gray-500"
            }`}
          >
            {longitud} / {LIMITE_NOTA}
          </span>

          {editando ? (
            <>
              <button
                disabled={ocupado === "guardar"}
                className="rounded bg-black px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
                onClick={guardar}
              >
                {ocupado === "guardar" ? "Guardando…" : "Guardar"}
              </button>
              <button
                className="text-xs underline"
                onClick={() => {
                  setEditando(false);
                  setAviso(null);
                }}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button className="text-xs underline" onClick={copiar}>
                Copiar
              </button>
              <button
                disabled={ocupado === "regenerar"}
                className="text-xs underline disabled:opacity-40"
                onClick={generar}
              >
                {ocupado === "regenerar" ? "Regenerando…" : "Regenerar"}
              </button>
              <button
                className="text-xs underline"
                onClick={() => {
                  setBorrador(nota ?? "");
                  setEditando(true);
                  setAviso(null);
                }}
              >
                Editar
              </button>
            </>
          )}
        </div>

        {pasado && editando && (
          <p className="mt-1 text-xs text-red-700">
            LinkedIn corta en {LIMITE_NOTA}. Al guardar se recorta por la última frase
            que quepa entera.
          </p>
        )}

        <p className="mt-2 text-[11px] text-gray-500">
          Es un borrador: reescríbelo con tus palabras. Las notas que editas son los
          ejemplos de tono de las siguientes.
        </p>

        {aviso && <p className="mt-1 text-xs text-gray-600">{aviso}</p>}
      </div>
    </div>
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
        <div key={p.id} className="rounded-xl border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
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
                className="rounded border bg-white px-2 py-1 text-sm"
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <NotaDeInvitacion
            prospecto={p}
            onNota={(introText) =>
              setProspects((prev) =>
                prev.map((x) => (x.id === p.id ? { ...x, introText } : x)),
              )
            }
          />
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
  // Los ids con un análisis a fondo EN VUELO. Vive en la página y no en la
  // tarjeta a propósito: `deepenCandidate` tarda entre veinte y cuarenta
  // segundos, y si el estado viviera en la tarjeta, cambiar a la pestaña de
  // validados y volver la desmontaría y la volvería a montar con el botón
  // rehabilitado — con la llamada todavía en el aire. El segundo clic sí
  // cobraría: el guardarraíl del servidor (`depth === "fondo"`) solo cierra
  // después de que la primera llamada haya escrito.
  const [profundizando, setProfundizando] = useState([]);

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
  // alguien dejó a medias en OTRA ficha sobreviven a la recarga tal cual, y
  // desde esta fase también el hilo del chat de esa ficha. Solo desaparece,
  // con razón, la ficha que se acaba de decidir. Comprobado a propósito antes
  // de dar esto por bueno: es la razón de usar `c.id` como key y no el índice
  // de la lista.
  const handleAccept = async (id, note) => {
    const res = await acceptCandidate({ id, note });
    if (res.success) {
      // Se guarda el enlace para poder abrirlo sin buscarlo: es lo primero que
      // se quiere hacer después de decir que sí.
      setAceptados((prev) => [...prev, { id, linkedinUrl: res.linkedinUrl }]);
      setDecididosSesion((n) => n + 1);
      flash(res.duplicado ? "Ya estaba en la lista" : "Añadido a validados");
    } else {
      flash(`⚠️ ${res.error}`);
    }
    // `load()` va SIEMPRE, también cuando falla: no todos los errores de
    // acceptCandidate dejan la fila decidida (el de "sin créditos" no toca
    // nada), pero otros sí — "Apollo no devolvió URL de LinkedIn" marca la
    // fila como "no" con el crédito ya gastado, y sin este `load()` la
    // pantalla se quedaba enseñándola como pendiente con el contador de
    // créditos viejo (el bug que se disparó 26 veces). Distinguir aquí caso
    // por caso qué mensaje de error sí decide y cuál no es frágil: un error
    // nuevo que decida la fila y se nos olvide añadir a esa lista repetiría
    // el mismo bug. Recargar de más solo cuesta una consulta; recargar de
    // menos deja la pantalla mintiendo con dinero ya gastado.
    load();
  };

  const handleReject = async (id, reasonCode, note) => {
    const res = await rejectCandidate({ id, reasonCode, note });
    if (!res.success) return flash(`⚠️ ${res.error}`);
    setDecididosSesion((n) => n + 1);
    load();
  };

  // Los 0,35 $ los autoriza quien pulsa, así que el doble clic no puede
  // convertirse en doble cobro: la guarda de aquí es la única que actúa
  // durante los veinte o cuarenta segundos que la llamada está en vuelo.
  const handleDeepen = async (id) => {
    if (profundizando.includes(id)) return;
    setProfundizando((prev) => (prev.includes(id) ? prev : [...prev, id]));
    try {
      const res = await deepenCandidate(id);
      if (res.success) {
        const antes = Number.isFinite(res.scoreAnterior) ? res.scoreAnterior : "—";
        const puerta = res.pasaLaPuerta
          ? ""
          : ` · ya no pasa el filtro (${REASON_LABEL[res.reasonCode] ?? res.reasonCode})`;
        flash(`Análisis a fondo: score ${antes} → ${res.score}${puerta}`);
      } else {
        flash(`⚠️ ${res.error}`);
      }
      // Como en `handleAccept`: recargar siempre. El análisis a fondo puede
      // haber escrito el dossier y haber fallado después, y la pantalla no
      // puede quedarse enseñando el vistazo viejo por 0,35 $ ya gastados.
      await load();
    } finally {
      setProfundizando((prev) => prev.filter((x) => x !== id));
    }
  };

  if (!data) return <p className="p-6">Cargando…</p>;

  return (
    <main className="mx-auto min-h-screen max-w-5xl bg-gray-100 p-4 text-black md:p-8">
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

      <CreditHeader
        credits={data.credits}
        decididosSesion={decididosSesion}
        metrics={data.metrics}
        costeDelPeriodo={data.costeDelPeriodo}
      />
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
                profundizando={profundizando.includes(c.id)}
                onAccept={handleAccept}
                onReject={handleReject}
                onDeepen={handleDeepen}
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
