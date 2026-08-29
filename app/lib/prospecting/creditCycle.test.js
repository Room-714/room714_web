import { describe, expect, it } from "vitest";
import { cycleStartFor, nextResetFor, buildCreditStatus } from "./creditCycle";

describe("cycleStartFor", () => {
  it("el día 20 devuelve el 16 de ese mismo mes", () => {
    expect(cycleStartFor(new Date("2026-08-20T10:00:00Z"), 16)).toEqual(
      new Date("2026-08-16T00:00:00.000Z"),
    );
  });

  it("el día 3 devuelve el 16 del mes anterior", () => {
    expect(cycleStartFor(new Date("2026-08-03T10:00:00Z"), 16)).toEqual(
      new Date("2026-07-16T00:00:00.000Z"),
    );
  });

  it("el propio día 16 devuelve ese día: el ciclo empieza hoy", () => {
    expect(cycleStartFor(new Date("2026-08-16T09:00:00Z"), 16)).toEqual(
      new Date("2026-08-16T00:00:00.000Z"),
    );
  });

  it("cruza bien el cambio de año", () => {
    expect(cycleStartFor(new Date("2026-01-05T10:00:00Z"), 16)).toEqual(
      new Date("2025-12-16T00:00:00.000Z"),
    );
  });
});

describe("nextResetFor", () => {
  it("el día 20 devuelve el 16 del mes siguiente", () => {
    expect(nextResetFor(new Date("2026-08-20T10:00:00Z"), 16)).toEqual(
      new Date("2026-09-16T00:00:00.000Z"),
    );
  });

  it("el día 3 devuelve el 16 de este mes", () => {
    expect(nextResetFor(new Date("2026-08-03T10:00:00Z"), 16)).toEqual(
      new Date("2026-08-16T00:00:00.000Z"),
    );
  });

  it("en diciembre cruza al año siguiente", () => {
    expect(nextResetFor(new Date("2026-12-20T10:00:00Z"), 16)).toEqual(
      new Date("2027-01-16T00:00:00.000Z"),
    );
  });
});

describe("buildCreditStatus", () => {
  const now = new Date("2026-08-20T10:00:00Z");

  it("calcula gastados, restantes y días hasta renovar", () => {
    const s = buildCreditStatus({ spent: 17, cap: 60, now, resetDay: 16 });
    expect(s.spent).toBe(17);
    expect(s.remaining).toBe(43);
    expect(s.cap).toBe(60);
    expect(s.daysToReset).toBe(27); // del 20 de agosto al 16 de septiembre
  });

  it("no deja que los restantes bajen de cero", () => {
    const s = buildCreditStatus({ spent: 75, cap: 60, now, resetDay: 16 });
    expect(s.remaining).toBe(0);
    expect(s.exhausted).toBe(true);
  });

  it("marca exhausted solo cuando no queda ninguno", () => {
    expect(buildCreditStatus({ spent: 59, cap: 60, now, resetDay: 16 }).exhausted).toBe(false);
    expect(buildCreditStatus({ spent: 60, cap: 60, now, resetDay: 16 }).exhausted).toBe(true);
  });

  it("reparte el resto entre los días laborables que quedan", () => {
    // Del jueves 20 de agosto al 15 de septiembre, contando hoy, hay 19
    // laborables: si hoy puedo gastar créditos, hoy cuenta para repartirlos.
    const s = buildCreditStatus({ spent: 17, cap: 60, now, resetDay: 16 });
    expect(s.workdaysToReset).toBe(19);
    expect(s.pacePerWorkday).toBeCloseTo(43 / 19, 2);
  });

  it("no divide por cero el día antes de renovar", () => {
    // El 15 de agosto de 2026 es sábado y el reset es el domingo 16: no queda
    // ningún laborable entre hoy y la renovación. El código documenta que en
    // ese caso el ritmo es "todo lo que queda", así que se fija ese valor
    // concreto y no solo que sea un número finito (con eso pasaría igual un 0,
    // un 42 o cualquier otra cosa).
    const s = buildCreditStatus({
      spent: 10,
      cap: 60,
      now: new Date("2026-08-15T10:00:00Z"),
      resetDay: 16,
    });
    expect(s.workdaysToReset).toBe(0);
    expect(s.pacePerWorkday).toBe(50);
  });

  it("con spent roto (undefined, null o NaN) se asume el cupo agotado: falla en cerrado", () => {
    // undefined: 60 - undefined = NaN, y NaN === 0 es false — sin esta guarda
    // la puerta se quedaría abierta. null: 60 - null = 60, "no se ha gastado
    // nada", que es el error contrario y peor porque parece dato bueno.
    for (const spent of [undefined, null, NaN]) {
      const s = buildCreditStatus({ spent, cap: 60, now, resetDay: 16 });
      expect(s.remaining).toBe(0);
      expect(s.exhausted).toBe(true);
    }
  });

  it("expone en `spent` el valor saneado, no el crudo recibido", () => {
    // Antes se devolvía `spent` tal cual llegaba: con una entrada rota, el
    // mensaje de `acceptCandidate` salía como "Sin créditos: undefined de 60
    // gastados". Lo que debe verse es el número con el que de verdad se ha
    // calculado `remaining` y `exhausted` (el cupo entero, en el peor caso).
    for (const spent of [undefined, null, NaN]) {
      const s = buildCreditStatus({ spent, cap: 60, now, resetDay: 16 });
      expect(s.spent).toBe(60);
    }
    expect(buildCreditStatus({ spent: 17, cap: 60, now, resetDay: 16 }).spent).toBe(17);
  });
});

describe("límites conocidos", () => {
  it("con resetDay 31 se desborda al mes siguiente en meses cortos", () => {
    // Documentado, no arreglado: el ciclo real es el día 16 y ahí no pasa. Este
    // test existe para que quien mueva el día de facturación lo vea fallar antes
    // de descubrirlo en producción.
    expect(nextResetFor(new Date("2026-02-20T10:00:00Z"), 31)).toEqual(
      new Date("2026-03-03T00:00:00.000Z"),
    );
  });
});
