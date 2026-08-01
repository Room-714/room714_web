import { describe, expect, it } from "vitest";
import { channelForVariant, variantScheduleFor } from "./linkedinSchedule";

// Lunes 27 de julio de 2026, 10:00 Madrid (CEST = UTC+2).
const LUNES = new Date("2026-07-27T08:00:00Z");
// Miércoles 29 de julio de 2026, 10:00 Madrid.
const MIERCOLES = new Date("2026-07-29T08:00:00Z");

describe("variantScheduleFor", () => {
  it("programa el mismo día, el siguiente y dos días después por la tarde", () => {
    const [v1, v2, v3] = variantScheduleFor(LUNES);
    expect(v1.toISOString()).toBe("2026-07-27T08:00:00.000Z");
    expect(v2.toISOString()).toBe("2026-07-28T08:00:00.000Z");
    expect(v3.toISOString()).toBe("2026-07-29T14:00:00.000Z");
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
