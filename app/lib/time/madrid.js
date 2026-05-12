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

export function isMadridWeekday() {
  const { weekday } = getMadridParts(new Date());
  return !["Sat", "Sun"].includes(weekday);
}

export function nextMadridSlot(targetHour) {
  const now = new Date();
  const targetStr = String(targetHour).padStart(2, "0");

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    for (let utcHour = 0; utcHour < 24; utcHour++) {
      const candidate = new Date(now);
      candidate.setUTCDate(candidate.getUTCDate() + dayOffset);
      candidate.setUTCHours(utcHour, 0, 0, 0);

      if (candidate <= now) continue;

      const { hour, weekday } = getMadridParts(candidate);
      if (hour === targetStr && !["Sat", "Sun"].includes(weekday)) {
        return candidate;
      }
    }
  }
  throw new Error(`nextMadridSlot: no se encontró slot para hora ${targetHour}`);
}
