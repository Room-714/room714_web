const TIMEZONE = "Europe/Madrid";

function getMadridParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);

  const result = {};
  for (const p of parts) {
    if (p.type !== "literal") result[p.type] = p.value;
  }
  return result;
}

export function isMadridHour(targetHour) {
  const { hour } = getMadridParts(new Date());
  return parseInt(hour, 10) === targetHour;
}

export function getMadridHour(date = new Date()) {
  const { hour } = getMadridParts(date);
  return parseInt(hour, 10);
}

export function isMadridWeekday() {
  const { weekday } = getMadridParts(new Date());
  return !["Sat", "Sun"].includes(weekday);
}

// Día de la semana en Madrid ("Mon".."Sun"). Usar esto y no getDay()/getUTCDay():
// una fecha guardada en UTC puede caer en otro día natural según el huso.
export function getMadridWeekday(date = new Date()) {
  return getMadridParts(date).weekday;
}

// Hora de Madrid en formato "HH:MM".
export function formatMadridTime(date) {
  const { hour, minute } = getMadridParts(date);
  return `${hour}:${minute}`;
}

// Etiqueta corta para asuntos de correo: "lunes 27".
export function formatMadridDateLabel(date = new Date()) {
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === "weekday").value;
  const day = parts.find((p) => p.type === "day").value;
  return `${weekday} ${day}`;
}

// Desplazamiento de Madrid respecto a UTC, en milisegundos, en ese instante.
function madridOffsetMs(date) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName").value; // "GMT+02:00"

  const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000;
}

// Primer y último instante (en UTC) del día natural de Madrid al que pertenece
// `date`. Se usa para filtrar por fecha en Prisma, que compara instantes.
//
// El desplazamiento se toma en `date`, así que un día de cambio de hora podría
// desviar el rango una hora. No afecta: los cambios ocurren de madrugada en
// domingo y este cálculo solo lo usa el cron de lunes a viernes.
export function madridDayRange(date = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // "2026-07-27"

  const [year, month, day] = ymd.split("-").map(Number);
  const offset = madridOffsetMs(date);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offset);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

// Próximo instante en que Madrid marque `targetHour:targetMinute` en un día
// laborable. El bucle recorre horas UTC porque los desfases de Madrid son de
// hora entera: el minuto de Madrid y el minuto UTC coinciden siempre, así que
// fijarlo aquí no altera la comprobación de la hora.
export function nextMadridSlot(targetHour, targetMinute = 0) {
  const now = new Date();
  const targetStr = String(targetHour).padStart(2, "0");

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    for (let utcHour = 0; utcHour < 24; utcHour++) {
      const candidate = new Date(now);
      candidate.setUTCDate(candidate.getUTCDate() + dayOffset);
      candidate.setUTCHours(utcHour, targetMinute, 0, 0);

      if (candidate <= now) continue;

      const { hour, weekday } = getMadridParts(candidate);
      if (hour === targetStr && !["Sat", "Sun"].includes(weekday)) {
        return candidate;
      }
    }
  }
  throw new Error(
    `nextMadridSlot: no se encontró slot para ${targetStr}:${String(targetMinute).padStart(2, "0")}`,
  );
}
