import { describe, expect, it } from "vitest";
import { efficiencyMetrics } from "./metrics";

const dia = (n) => new Date(`2026-08-${String(n).padStart(2, "0")}T06:00:00Z`);

describe("efficiencyMetrics", () => {
  it("vistazos por ficha: empresas miradas entre fichas encoladas", () => {
    const m = efficiencyMetrics({
      ejecuciones: [
        { shownOn: dia(20), miradas: 20, encoladas: 5 },
        { shownOn: dia(21), miradas: 10, encoladas: 5 },
      ],
      decisiones: [],
      costeTotal: 0,
      ahora: dia(21),
    });
    expect(m.vistazosPorFicha).toBeCloseTo(3, 5); // (20+10) / (5+5)
  });

  it("tasa de aceptación: de las decididas, cuántas acabaron en sí", () => {
    const m = efficiencyMetrics({
      ejecuciones: [{ shownOn: dia(21), miradas: 10, encoladas: 5 }],
      decisiones: [
        { decision: "yes", decidedAt: dia(21) },
        { decision: "no", decidedAt: dia(21) },
        { decision: "no", decidedAt: dia(21) },
      ],
      costeTotal: 0,
      ahora: dia(21),
    });
    expect(m.tasaAceptacion).toBeCloseTo(1 / 3, 5);
  });

  it("coste por validado: el gasto del periodo entre los aceptados", () => {
    const m = efficiencyMetrics({
      ejecuciones: [{ shownOn: dia(21), miradas: 10, encoladas: 5 }],
      decisiones: [
        { decision: "yes", decidedAt: dia(21) },
        { decision: "yes", decidedAt: dia(21) },
      ],
      costeTotal: 5,
      ahora: dia(21),
    });
    expect(m.costePorValidado).toBeCloseTo(2.5, 5);
  });

  it("sin aceptados, el coste por validado es null y no Infinity", () => {
    // Infinity se pinta como "Infinity" en pantalla y no dice nada. null se
    // pinta como "—", que es la verdad: todavía no se sabe.
    const m = efficiencyMetrics({
      ejecuciones: [{ shownOn: dia(21), miradas: 10, encoladas: 5 }],
      decisiones: [{ decision: "no", decidedAt: dia(21) }],
      costeTotal: 5,
      ahora: dia(21),
    });
    expect(m.costePorValidado).toBeNull();
  });

  it("solo cuenta los últimos 7 días", () => {
    const m = efficiencyMetrics({
      ejecuciones: [
        { shownOn: dia(1), miradas: 100, encoladas: 1 }, // fuera de ventana
        { shownOn: dia(21), miradas: 10, encoladas: 5 },
      ],
      decisiones: [],
      costeTotal: 0,
      ahora: dia(21),
    });
    expect(m.vistazosPorFicha).toBeCloseTo(2, 5);
  });

  it("el borde de la ventana entra: justo 7 días cuenta", () => {
    const m = efficiencyMetrics({
      ejecuciones: [{ shownOn: dia(14), miradas: 10, encoladas: 5 }],
      decisiones: [],
      costeTotal: 0,
      ahora: dia(21),
    });
    expect(m.vistazosPorFicha).toBeCloseTo(2, 5);
  });

  it("una fecha del futuro NO entra en la ventana", () => {
    // Sin la guarda de diferencia >= 0, una fila de mañana da diferencia
    // negativa, que también es "menor que siete días", y contamina las tres
    // métricas sin dejar rastro. Pasa con un reloj adelantado o con datos de
    // prueba mal fechados.
    const m = efficiencyMetrics({
      ejecuciones: [
        { shownOn: dia(22), miradas: 1000, encoladas: 1 },
        { shownOn: dia(21), miradas: 10, encoladas: 5 },
      ],
      decisiones: [{ decision: "yes", decidedAt: dia(25) }],
      costeTotal: 0,
      ahora: dia(21),
    });
    expect(m.vistazosPorFicha).toBeCloseTo(2, 5);
    expect(m.muestra.miradas).toBe(10);
    expect(m.tasaAceptacion).toBeNull();
  });

  it("una fecha ilegible no entra ni revienta", () => {
    const m = efficiencyMetrics({
      ejecuciones: [{ shownOn: "no soy una fecha", miradas: 99, encoladas: 9 }],
      decisiones: [],
      costeTotal: 0,
      ahora: dia(21),
    });
    expect(m.vistazosPorFicha).toBeNull();
  });

  it("sin datos devuelve nulls, no NaN", () => {
    const m = efficiencyMetrics({ ejecuciones: [], decisiones: [], costeTotal: 0, ahora: dia(21) });
    expect(m.vistazosPorFicha).toBeNull();
    expect(m.tasaAceptacion).toBeNull();
    expect(m.costePorValidado).toBeNull();
  });

  it("aguanta fechas ausentes sin contarlas", () => {
    const m = efficiencyMetrics({
      ejecuciones: [
        { shownOn: null, miradas: 999, encoladas: 999 },
        { shownOn: dia(21), miradas: 10, encoladas: 5 },
      ],
      decisiones: [{ decision: "yes", decidedAt: null }],
      costeTotal: 0,
      ahora: dia(21),
    });
    expect(m.vistazosPorFicha).toBeCloseTo(2, 5);
    expect(m.tasaAceptacion).toBeNull();
  });

  it("devuelve la muestra en la que se basa, para poder desconfiar del número", () => {
    // Una tasa del 100% con una sola decisión no significa nada, y quien mire
    // la pantalla tiene que poder verlo.
    const m = efficiencyMetrics({
      ejecuciones: [{ shownOn: dia(21), miradas: 10, encoladas: 5 }],
      decisiones: [{ decision: "yes", decidedAt: dia(21) }],
      costeTotal: 1,
      ahora: dia(21),
    });
    expect(m.muestra).toEqual({ miradas: 10, encoladas: 5, decididas: 1, aceptadas: 1 });
    expect(m.ventanaDias).toBe(7);
  });

  it("no cuenta como decisión lo que sigue pendiente", () => {
    const m = efficiencyMetrics({
      ejecuciones: [{ shownOn: dia(21), miradas: 10, encoladas: 5 }],
      decisiones: [
        { decision: "yes", decidedAt: dia(21) },
        { decision: "pending", decidedAt: dia(21) },
      ],
      costeTotal: 0,
      ahora: dia(21),
    });
    expect(m.tasaAceptacion).toBe(1);
    expect(m.muestra.decididas).toBe(1);
  });
});
