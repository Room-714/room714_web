import { describe, expect, it } from "vitest";
import {
  formatMadridDateLabel,
  formatMadridTime,
  getMadridWeekday,
  madridDayRange,
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
