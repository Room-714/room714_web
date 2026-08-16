import { describe, expect, it } from "vitest";
import {
  channelForVariant,
  crossActionsFor,
  jitterMinutesFor,
  slotFor,
  variantScheduleFor,
} from "./linkedinSchedule";

// Lunes 27 de julio de 2026, 10:00 Madrid (CEST = UTC+2).
const LUNES = new Date("2026-07-27T08:00:00Z");
// Miércoles 29 de julio de 2026, 10:00 Madrid.
const MIERCOLES = new Date("2026-07-29T08:00:00Z");

const MIN_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

describe("variantScheduleFor", () => {
  it("programa el mismo día, el siguiente y dos días después por la tarde, con jitter dentro de ventana", () => {
    const [v1, v2, v3] = variantScheduleFor(LUNES);
    const base = LUNES.getTime();

    // v1: nunca antes de la publicación del artículo (+4..+52 min).
    const off1 = (v1.getTime() - base) / MIN_MS;
    expect(off1).toBeGreaterThanOrEqual(4);
    expect(off1).toBeLessThanOrEqual(52);

    // v2: día siguiente, -25..+65 min sobre las 10:00.
    const off2 = (v2.getTime() - (base + DAY_MS)) / MIN_MS;
    expect(off2).toBeGreaterThanOrEqual(-25);
    expect(off2).toBeLessThanOrEqual(65);

    // v3: dos días después, -35..+55 min sobre las 16:00.
    const off3 = (v3.getTime() - (base + 2 * DAY_MS + 6 * HOUR_MS)) / MIN_MS;
    expect(off3).toBeGreaterThanOrEqual(-35);
    expect(off3).toBeLessThanOrEqual(55);
  });

  it("es determinista: el mismo post produce siempre el mismo horario", () => {
    const a = variantScheduleFor(LUNES).map((d) => d.toISOString());
    const b = variantScheduleFor(new Date(LUNES)).map((d) => d.toISOString());
    expect(a).toEqual(b);
  });

  it("posts distintos no comparten minuto exacto (el jitter varía)", () => {
    const offsets = [LUNES, MIERCOLES].flatMap((date) =>
      [0, 1, 2].map((idx) => jitterMinutesFor(date, idx)),
    );
    // Si todos los offsets fueran iguales, seguiríamos siendo mecánicos.
    expect(new Set(offsets).size).toBeGreaterThan(1);
  });

  it("mantiene el orden v1 < v2 < v3 y no colisiona el miércoles", () => {
    const [, , v3Lunes] = variantScheduleFor(LUNES);
    const [v1Miercoles] = variantScheduleFor(MIERCOLES);
    const [v1, v2, v3] = variantScheduleFor(LUNES);
    expect(v1.getTime()).toBeLessThan(v2.getTime());
    expect(v2.getTime()).toBeLessThan(v3.getTime());
    // El recall del lunes (X ~16:00) va horas después del anuncio del
    // miércoles (X ~10:00): las ventanas de jitter no pueden solaparse.
    expect(v3Lunes.getTime() - v1Miercoles.getTime()).toBeGreaterThan(
      3 * HOUR_MS,
    );
  });
});

describe("channelForVariant", () => {
  it("reparte el post del lunes en personal, empresa, empresa", () => {
    const canales = [1, 2, 3].map((variant) =>
      channelForVariant({ postPublishDate: LUNES, variant }),
    );
    expect(canales).toEqual(["personal", "empresa", "empresa"]);
  });

  it("reparte el post del miércoles en personal, empresa, personal", () => {
    const canales = [1, 2, 3].map((variant) =>
      channelForVariant({ postPublishDate: MIERCOLES, variant }),
    );
    expect(canales).toEqual(["personal", "empresa", "personal"]);
  });

  it("mantiene 3 y 3 en la semana completa", () => {
    const semana = [
      ...[1, 2, 3].map((v) =>
        channelForVariant({ postPublishDate: LUNES, variant: v }),
      ),
      ...[1, 2, 3].map((v) =>
        channelForVariant({ postPublishDate: MIERCOLES, variant: v }),
      ),
    ];
    expect(semana.filter((c) => c === "personal")).toHaveLength(3);
    expect(semana.filter((c) => c === "empresa")).toHaveLength(3);
  });

  it("aplica el reparto del lunes si el post cae en un día no previsto", () => {
    const viernes = new Date("2026-07-31T08:00:00Z");
    expect(channelForVariant({ postPublishDate: viernes, variant: 1 })).toBe(
      "personal",
    );
    expect(channelForVariant({ postPublishDate: viernes, variant: 3 })).toBe(
      "empresa",
    );
  });

  it("resuelve el mismo día de la semana en horario de invierno", () => {
    // Lunes 5 de enero de 2026, 10:00 Madrid (CET = UTC+1).
    const lunesInvierno = new Date("2026-01-05T09:00:00Z");
    expect(
      channelForVariant({ postPublishDate: lunesInvierno, variant: 2 }),
    ).toBe("empresa");
  });
});

describe("crossActionsFor", () => {
  it("da recompartición, comentario y nada al post del lunes", () => {
    expect(crossActionsFor(LUNES)).toEqual([
      "reshare_company",
      "comment_personal",
      null,
    ]);
  });

  it("da nada, comentario y recompartición al post del miércoles", () => {
    expect(crossActionsFor(MIERCOLES)).toEqual([
      null,
      "comment_personal",
      "reshare_company",
    ]);
  });
});

describe("slotFor", () => {
  it("devuelve canal y acción cruzada juntos", () => {
    expect(slotFor({ postPublishDate: LUNES, variant: 1 })).toEqual({
      canal: "personal",
      cross: "reshare_company",
    });
    expect(slotFor({ postPublishDate: MIERCOLES, variant: 3 })).toEqual({
      canal: "personal",
      cross: "reshare_company",
    });
  });

  it("cae en el primer slot del lunes si la variante está fuera de rango", () => {
    expect(slotFor({ postPublishDate: LUNES, variant: 9 })).toEqual({
      canal: "personal",
      cross: "reshare_company",
    });
  });
});
