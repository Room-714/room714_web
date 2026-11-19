// Qué se publica en LinkedIn y cuándo. Todo puro: recibe lo que ya leyó la
// única consulta del cron (autopost.js) y la hora, y no toca la base de datos.

import { CATEGORY_CLUSTER } from "@/app/lib/seo/clusters";
import {
  getMadridHour,
  getMadridMinute,
  getMadridWeekday,
  madridAt,
  madridDateString,
} from "@/app/lib/time/madrid";
import { semanaMadrid } from "./aprobacion";

/* ─── Calendario ──────────────────────────────────────────────────────────── */

// 08:30 de Madrid. Página de empresa los viernes; perfil de José martes y jueves.
export const HORA = 8;
export const MINUTO = 30;
export const DIAS = { empresa: ["Fri"], personal: ["Tue", "Thu"] };

// El cron corre cada 5 minutos de 07:00 a 09:55 (Madrid, L-V). La ejecución
// de las 08:30 es la principal y la de las 08:45, el reintento: 15 minutos.
// Ventanas de 5 minutos para que solo una ejecución caiga en cada una.
const VENTANA_PRINCIPAL = [30, 35];
const VENTANA_REINTENTO = [45, 50];

/**
 * El trabajo que toca en `ahora`: { canal, modo } o null.
 * modo: "principal" (08:30) o "reintento" (08:45).
 */
export function franjaLinkedIn(ahora = new Date()) {
  if (getMadridHour(ahora) !== HORA) return null;
  const minuto = getMadridMinute(ahora);
  const dentro = ([a, b]) => minuto >= a && minuto < b;
  const modo = dentro(VENTANA_PRINCIPAL)
    ? "principal"
    : dentro(VENTANA_REINTENTO)
      ? "reintento"
      : null;
  if (!modo) return null;
  const dia = getMadridWeekday(ahora);
  const canal = Object.keys(DIAS).find((c) => DIAS[c].includes(dia));
  return canal ? { canal, modo } : null;
}

/** Próxima ejecución principal del canal (estrictamente después de `ahora`). */
export function proximaEjecucion(canal, ahora = new Date()) {
  for (let i = 0; i < 8; i += 1) {
    const dia = madridDateString(new Date(ahora.getTime() + i * 86_400_000));
    const instante = madridAt(dia, HORA, MINUTO);
    if (instante > ahora && DIAS[canal].includes(getMadridWeekday(instante))) {
      return instante;
    }
  }
  return null;
}

/* ─── Página de empresa: el mejor post de la semana ───────────────────────── */

// C2 (diseño de producto y experiencia de cliente) > C1 (ideación) > C3
// (desarrollo). Un post sin cluster reconocible va el último.
export const PREFERENCIA_CLUSTER = ["C2", "C1", "C3"];

export const clusterDePost = (post) => CATEGORY_CLUSTER[post?.category] ?? null;

const rango = (post) => {
  const i = PREFERENCIA_CLUSTER.indexOf(clusterDePost(post));
  return i === -1 ? PREFERENCIA_CLUSTER.length : i;
};

const masReciente = (a, b) =>
  new Date(b.date) - new Date(a.date) || (b.id ?? 0) - (a.id ?? 0);

/**
 * El post del blog que sale el viernes en la página de empresa: publicado
 * en la semana de Madrid de `ahora` (de lunes a `ahora`), por preferencia de
 * cluster y, si empatan, el más reciente. null si esa semana no hubo posts.
 */
export function mejorPostDeLaSemana(posts, ahora = new Date()) {
  const { inicio } = semanaMadrid(ahora);
  const candidatos = posts.filter((p) => {
    const fecha = new Date(p.date);
    return p.published !== false && fecha >= inicio && fecha <= ahora;
  });
  candidatos.sort((a, b) => rango(a) - rango(b) || masReciente(a, b));
  return candidatos[0] ?? null;
}

/* ─── Perfil de José: el siguiente post ───────────────────────────────────── */

/**
 * El post más reciente ya publicado en la web que todavía no se ha usado en
 * el perfil. `usados`: ids de posts con un envío personal hecho. null si no
 * queda ninguno.
 */
export function siguientePostPerfil(posts, usados = [], ahora = new Date()) {
  const yaUsados = new Set(usados.map(Number));
  return (
    posts
      .filter(
        (p) =>
          p.published !== false &&
          new Date(p.date) <= ahora &&
          !yaUsados.has(Number(p.id)),
      )
      .sort(masReciente)[0] ?? null
  );
}
