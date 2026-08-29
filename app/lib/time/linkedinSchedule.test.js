import { describe, expect, it } from "vitest";
import {
  channelForVariant,
  crossActionsFor,
  jitterMinutesFor,
  slotFor,
  takeCountFor,
  variantScheduleFor,
} from "./linkedinSchedule";
import { formatMadridTime } from "./madrid";

// Los artículos se publican a las 07:30 de Madrid.
// Lunes 27 de julio de 2026 (CEST = UTC+2) → 05:30 UTC.
const LUNES = new Date("2026-07-27T05:30:00Z");
// Miércoles 29 de julio de 2026, 07:30 Madrid.
const MIERCOLES = new Date("2026-07-29T05:30:00Z");

const MIN_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

describe("takeCountFor", () => {
  it("da tres tomas al artículo del lunes y dos al del miércoles", () => {
    expect(takeCountFor(LUNES)).toBe(3);
    expect(takeCountFor(MIERCOLES)).toBe(2);
  });

  it("cae en el plan del lunes si el artículo sale un día no previsto", () => {
    const viernes = new Date("2026-07-31T05:30:00Z");
    expect(takeCountFor(viernes)).toBe(3);
  });
});

describe("variantScheduleFor", () => {
  it("reparte el artículo del lunes en lunes, martes y viernes", () => {
    const [t1, t2, t3] = variantScheduleFor(LUNES);
    const base = LUNES.getTime();

    // Toma 1: mismo día a las 08:35 (65 min después del artículo), +0..+8.
    const off1 = (t1.getTime() - (base + 65 * MIN_MS)) / MIN_MS;
    expect(off1).toBeGreaterThanOrEqual(0);
    expect(off1).toBeLessThanOrEqual(8);

    // Toma 2: martes a las 07:30, +0..+28.
    const off2 = (t2.getTime() - (base + DAY_MS)) / MIN_MS;
    expect(off2).toBeGreaterThanOrEqual(0);
    expect(off2).toBeLessThanOrEqual(28);

    // Toma 3: viernes a las 07:30, +0..+28.
    const off3 = (t3.getTime() - (base + 4 * DAY_MS)) / MIN_MS;
    expect(off3).toBeGreaterThanOrEqual(0);
    expect(off3).toBeLessThanOrEqual(28);
  });

  it("reparte el artículo del miércoles en miércoles y jueves", () => {
    const fechas = variantScheduleFor(MIERCOLES);
    expect(fechas).toHaveLength(2);

    const base = MIERCOLES.getTime();
    const off1 = (fechas[0].getTime() - (base + 65 * MIN_MS)) / MIN_MS;
    const off2 = (fechas[1].getTime() - (base + DAY_MS)) / MIN_MS;
    expect(off1).toBeGreaterThanOrEqual(0);
    expect(off1).toBeLessThanOrEqual(8);
    expect(off2).toBeGreaterThanOrEqual(0);
    expect(off2).toBeLessThanOrEqual(28);
  });

  it("ninguna toma se sale de su franja, en invierno y en verano", () => {
    const bases = [
      LUNES,
      MIERCOLES,
      // Lunes 5 y miércoles 7 de enero de 2026, 07:30 Madrid (CET = UTC+1).
      new Date("2026-01-05T06:30:00Z"),
      new Date("2026-01-07T06:30:00Z"),
      // Lunes 23 de marzo: su toma 3 cae el viernes 27, aún en CET (el cambio
      // es el domingo 29).
      new Date("2026-03-23T06:30:00Z"),
      // Lunes 19 de octubre: su toma 3 cae el viernes 23, aún en CEST (el
      // cambio es el domingo 25).
      new Date("2026-10-19T05:30:00Z"),
    ];

    for (const base of bases) {
      for (const fecha of variantScheduleFor(base)) {
        const hhmm = formatMadridTime(fecha);
        const enFranjaManana = hhmm >= "07:30" && hhmm <= "07:58";
        const enFranjaRevision = hhmm >= "08:35" && hhmm <= "08:43";
        expect(
          enFranjaManana || enFranjaRevision,
          `artículo ${base.toISOString()} → toma a las ${hhmm} de Madrid`,
        ).toBe(true);
      }
    }
  });

  it("es determinista: el mismo artículo produce siempre el mismo horario", () => {
    const a = variantScheduleFor(LUNES).map((d) => d.toISOString());
    const b = variantScheduleFor(new Date(LUNES)).map((d) => d.toISOString());
    expect(a).toEqual(b);
  });

  it("mantiene el orden entre tomas", () => {
    const [t1, t2, t3] = variantScheduleFor(LUNES);
    expect(t1.getTime()).toBeLessThan(t2.getTime());
    expect(t2.getTime()).toBeLessThan(t3.getTime());
  });

  it("la toma del lunes no pisa la del martes ni la del miércoles", () => {
    const [, martes, viernes] = variantScheduleFor(LUNES);
    const [miercoles, jueves] = variantScheduleFor(MIERCOLES);
    const orden = [martes, miercoles, jueves, viernes].map((d) => d.getTime());
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  it("el jitter dispersa las tomas de un mismo artículo", () => {
    const lunes = [0, 1, 2].map((idx) => jitterMinutesFor(LUNES, idx));
    expect(new Set(lunes).size).toBeGreaterThan(1);

    // Solo dos índices: el plan del miércoles no tiene una tercera toma y
    // pedirla caería en el respaldo sin que el test lo dijera.
    const miercoles = [0, 1].map((idx) => jitterMinutesFor(MIERCOLES, idx));
    expect(new Set(miercoles).size).toBeGreaterThan(1);
  });
});

describe("channelForVariant", () => {
  it("saca el artículo del lunes por personal, empresa y personal", () => {
    const canales = [1, 2, 3].map((variant) =>
      channelForVariant({ postPublishDate: LUNES, variant }),
    );
    expect(canales).toEqual(["personal", "empresa", "personal"]);
  });

  it("saca el artículo del miércoles por personal y empresa", () => {
    const canales = [1, 2].map((variant) =>
      channelForVariant({ postPublishDate: MIERCOLES, variant }),
    );
    expect(canales).toEqual(["personal", "empresa"]);
  });

  it("deja la semana en 3 personal y 2 empresa", () => {
    const semana = [
      ...[1, 2, 3].map((v) =>
        channelForVariant({ postPublishDate: LUNES, variant: v }),
      ),
      ...[1, 2].map((v) =>
        channelForVariant({ postPublishDate: MIERCOLES, variant: v }),
      ),
    ];
    expect(semana.filter((c) => c === "personal")).toHaveLength(3);
    expect(semana.filter((c) => c === "empresa")).toHaveLength(2);
  });

  it("resuelve el día de la semana en horario de invierno", () => {
    // Lunes 5 de enero de 2026, 07:30 Madrid (CET = UTC+1).
    const lunesInvierno = new Date("2026-01-05T06:30:00Z");
    expect(
      channelForVariant({ postPublishDate: lunesInvierno, variant: 2 }),
    ).toBe("empresa");
  });
});

describe("crossActionsFor", () => {
  it("da tres acciones al artículo del lunes", () => {
    expect(crossActionsFor(LUNES)).toEqual([
      "reshare_company",
      "comment_personal",
      "reshare_company",
    ]);
  });

  it("da dos al del miércoles", () => {
    expect(crossActionsFor(MIERCOLES)).toEqual([
      "reshare_company",
      "comment_personal",
    ]);
  });

  it("deja exactamente una acción cruzada por día de la semana", () => {
    const semana = [...crossActionsFor(LUNES), ...crossActionsFor(MIERCOLES)];
    expect(semana).toHaveLength(5);
    expect(semana.every(Boolean)).toBe(true);
  });
});

describe("slotFor", () => {
  it("devuelve canal y acción cruzada juntos", () => {
    expect(slotFor({ postPublishDate: LUNES, variant: 1 })).toMatchObject({
      canal: "personal",
      cross: "reshare_company",
    });
    expect(slotFor({ postPublishDate: MIERCOLES, variant: 2 })).toMatchObject({
      canal: "empresa",
      cross: "comment_personal",
    });
  });

  it("cae en la primera toma si la variante está fuera de rango", () => {
    expect(slotFor({ postPublishDate: MIERCOLES, variant: 9 })).toMatchObject({
      canal: "personal",
      cross: "reshare_company",
    });
  });
});
