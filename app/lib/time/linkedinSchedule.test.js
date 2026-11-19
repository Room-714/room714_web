import { describe, expect, it } from "vitest";
import {
  PLANNED_WEEKDAYS,
  channelForVariant,
  crossActionsFor,
  slotFor,
  takeCountFor,
  variantScheduleFor,
} from "./linkedinSchedule";
import { formatMadridTime, getMadridWeekday } from "./madrid";

// Los artículos se publican a las 07:30 de Madrid, lunes y jueves.
// Lunes 16 y jueves 19 de noviembre de 2026 (CET = UTC+1) → 06:30 UTC.
const LUNES = new Date("2026-11-16T06:30:00Z");
const JUEVES = new Date("2026-11-19T06:30:00Z");
// En verano (CEST = UTC+2): lunes 27 de julio de 2026.
const LUNES_VERANO = new Date("2026-07-27T05:30:00Z");

describe("plan de tomas (publicación automática)", () => {
  it("los artículos salen lunes y jueves", () => {
    expect(PLANNED_WEEKDAYS).toEqual(["Mon", "Thu"]);
  });

  it("cada artículo lleva una sola toma, la de la página de empresa", () => {
    for (const fecha of [LUNES, JUEVES, LUNES_VERANO]) {
      expect(takeCountFor(fecha)).toBe(1);
      expect(channelForVariant({ postPublishDate: fecha, variant: 1 })).toBe("empresa");
    }
  });

  it("sin acciones cruzadas: nada pide trabajo manual", () => {
    expect(crossActionsFor(LUNES)).toEqual([null]);
    expect(crossActionsFor(JUEVES)).toEqual([null]);
  });

  it("la toma queda fechada el viernes a las 08:30, en invierno y en verano", () => {
    for (const fecha of [LUNES, JUEVES, LUNES_VERANO]) {
      const [cuando] = variantScheduleFor(fecha);
      expect(getMadridWeekday(cuando)).toBe("Fri");
      expect(formatMadridTime(cuando)).toBe("08:30");
    }
  });

  it("un artículo fuera de calendario usa el plan del lunes en vez de fallar", () => {
    const martes = new Date("2026-11-17T06:30:00Z");
    expect(takeCountFor(martes)).toBe(1);
    expect(slotFor({ postPublishDate: martes, variant: 1 }).canal).toBe("empresa");
  });

  it("las tomas antiguas con número fuera del plan caen en la primera (empresa)", () => {
    expect(slotFor({ postPublishDate: LUNES, variant: 3 }).canal).toBe("empresa");
  });
});
