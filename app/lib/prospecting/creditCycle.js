// El presupuesto de Apollo no renueva el día 1 sino el 16, que es cuando cae el
// ciclo de facturación de esta cuenta. El código anterior lo aproximaba con una
// ventana móvil de 30 días, que servía para no pasarse pero no podía responder a
// la pregunta que de verdad importa mirando la pantalla: cuánto queda y cuándo
// vuelve a llenarse.
//
// Todo el módulo es puro: recibe `now` en vez de leer el reloj, para que los
// tests puedan situarse en cualquier día del ciclo.

export const DEFAULT_RESET_DAY = 16;
export const DEFAULT_CAP = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

// Ojo con `resetDay` por encima de 28: `Date.UTC` normaliza el desbordamiento en
// silencio, así que `resetDay = 31` en un mes de 30 días devuelve el 1 del mes
// siguiente sin lanzar ni avisar. No afecta al día 16, que existe en los doce
// meses, pero si algún día cambia el ciclo de facturación hay que revisarlo aquí
// antes que en ningún otro sitio.

// Se trabaja en UTC a propósito. El desfase con Madrid es de una o dos horas y
// el ciclo dura un mes: hacer aritmética de zona horaria aquí añadiría un modo
// de fallo a cambio de nada.
function utcMidnight(year, month, day) {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

// Inicio del ciclo vigente: el último día `resetDay` anterior o igual a `now`.
export function cycleStartFor(now = new Date(), resetDay = DEFAULT_RESET_DAY) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return now.getUTCDate() >= resetDay
    ? utcMidnight(y, m, resetDay)
    : utcMidnight(y, m - 1, resetDay); // Date normaliza el mes -1 a diciembre
}

// Próxima renovación: el siguiente día `resetDay` estrictamente posterior a hoy.
export function nextResetFor(now = new Date(), resetDay = DEFAULT_RESET_DAY) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return now.getUTCDate() >= resetDay
    ? utcMidnight(y, m + 1, resetDay)
    : utcMidnight(y, m, resetDay);
}

// Días laborables que quedan hasta la renovación, contando hoy. Se usa para
// sugerir un ritmo: gastar los créditos a ojo es como se llega al día 10 sin
// ninguno.
function workdaysBetween(from, to) {
  let count = 0;
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  while (cursor < to) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function buildCreditStatus({
  spent,
  cap = DEFAULT_CAP,
  now = new Date(),
  resetDay = DEFAULT_RESET_DAY,
}) {
  const nextReset = nextResetFor(now, resetDay);
  const remaining = Math.max(0, cap - spent);
  const daysToReset = Math.ceil((nextReset.getTime() - now.getTime()) / DAY_MS);
  const workdaysToReset = workdaysBetween(now, nextReset);

  return {
    spent,
    cap,
    remaining,
    exhausted: remaining === 0,
    cycleStart: cycleStartFor(now, resetDay),
    nextReset,
    daysToReset,
    workdaysToReset,
    // Si no queda ningún laborable, el ritmo es lo que quede: no hay mañana en
    // este ciclo.
    pacePerWorkday: workdaysToReset > 0 ? remaining / workdaysToReset : remaining,
  };
}
