import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatMadridDateLabel,
  formatMadridTime,
  getMadridWeekday,
  madridDayRange,
  nextMadridSlot,
} from "./madrid";

describe("getMadridWeekday", () => {
  it("devuelve el día natural de Madrid, no el de UTC", () => {
    // 22:30 UTC del domingo son las 00:30 del lunes en Madrid.
    expect(getMadridWeekday(new Date("2026-07-26T22:30:00Z"))).toBe("Mon");
  });
});

describe("formatMadridTime", () => {
  it("formatea en horario de verano", () => {
    expect(formatMadridTime(new Date("2026-07-27T08:00:00Z"))).toBe("10:00");
    expect(formatMadridTime(new Date("2026-07-29T14:00:00Z"))).toBe("16:00");
  });

  it("formatea en horario de invierno", () => {
    expect(formatMadridTime(new Date("2026-01-05T09:00:00Z"))).toBe("10:00");
  });
});

describe("madridDayRange", () => {
  it("cubre el día natural de Madrid en verano (UTC+2)", () => {
    const { start, end } = madridDayRange(new Date("2026-07-27T09:30:00Z"));
    expect(start.toISOString()).toBe("2026-07-26T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-27T21:59:59.999Z");
  });

  it("cubre el día natural de Madrid en invierno (UTC+1)", () => {
    const { start, end } = madridDayRange(new Date("2026-01-05T09:30:00Z"));
    expect(start.toISOString()).toBe("2026-01-04T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-05T22:59:59.999Z");
  });

  it("incluye una publicación de las 16:00 de ese mismo día", () => {
    const { start, end } = madridDayRange(new Date("2026-07-31T06:00:00Z"));
    const publicacion = new Date("2026-07-31T14:00:00Z"); // 16:00 Madrid
    expect(publicacion >= start && publicacion <= end).toBe(true);
  });
});

describe("formatMadridDateLabel", () => {
  it("devuelve día de la semana y número", () => {
    expect(formatMadridDateLabel(new Date("2026-07-27T08:00:00Z"))).toBe(
      "lunes 27",
    );
  });
});

describe("nextMadridSlot", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve las 07:30 de Madrid del mismo día en horario de verano", () => {
    // Lunes 27 de julio de 2026, 06:00 Madrid (CEST = UTC+2) → 04:00 UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T04:00:00Z"));

    const slot = nextMadridSlot(7, 30);

    expect(slot.toISOString()).toBe("2026-07-27T05:30:00.000Z");
  });

  it("devuelve las 07:30 de Madrid del mismo día en horario de invierno", () => {
    // Lunes 5 de enero de 2026, 06:00 Madrid (CET = UTC+1) → 05:00 UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T05:00:00Z"));

    const slot = nextMadridSlot(7, 30);

    expect(slot.toISOString()).toBe("2026-01-05T06:30:00.000Z");
  });

  it("salta al siguiente día laborable si la hora ya pasó", () => {
    // Viernes 31 de julio de 2026, 09:00 Madrid: las 07:30 ya pasaron.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T07:00:00Z"));

    const slot = nextMadridSlot(7, 30);

    // Lunes 3 de agosto, 07:30 Madrid (CEST).
    expect(slot.toISOString()).toBe("2026-08-03T05:30:00.000Z");
  });

  it("sigue funcionando sin minutos, como antes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T04:00:00Z"));

    expect(nextMadridSlot(10).toISOString()).toBe("2026-07-27T08:00:00.000Z");
  });

  it("no devuelve las 07:30 de hoy si ya son las 07:45", () => {
    // Lunes 27 de julio de 2026, 07:45 Madrid (CEST = UTC+2) → 05:45 UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T05:45:00Z"));

    // Se salta al martes: el slot de hoy ya pasó.
    expect(nextMadridSlot(7, 30).toISOString()).toBe("2026-07-28T05:30:00.000Z");
  });
});
