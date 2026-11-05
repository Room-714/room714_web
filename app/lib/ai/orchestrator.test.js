import { describe, expect, it } from "vitest";
import { buildTakeRows, categoriaParaCluster, decidirDuplicado } from "./orchestrator";
import { agruparFilas } from "./duplicados";
import { variantScheduleFor } from "@/app/lib/time/linkedinSchedule";

const AHORA = new Date("2026-11-05T12:00:00Z");
const CORPUS = agruparFilas([
  {
    id: 900,
    date: "2026-10-14T05:30:00Z",
    createdAt: "2026-10-13T04:00:00Z",
    category: "UX",
    published: true,
    lang: "es",
    slug: "diferencia-entre-diseno-de-producto-y-diseno-ux",
    title: "Diseño de Producto vs. Diseño UX: La Distinción que Tu Equipo Necesita Entender Ya",
    metaTitle: null,
    metaDescription: null,
    tags: [],
  },
  {
    id: 950,
    date: "2026-11-02T06:30:00Z",
    createdAt: "2026-11-02T04:00:00Z",
    category: "PRODUCT",
    published: true,
    lang: "es",
    slug: "como-validar-una-idea-de-producto-digital",
    title: "Cómo validar una idea de producto digital",
    metaTitle: null,
    metaDescription: null,
    tags: [],
  },
]);

const plan = (extra = {}) => ({ tema_es: "", tema_en: "", angulo_es: "", cluster: "C2", duplicadoDe: null, motivo: "", ...extra });

describe("decidirDuplicado", () => {
  it("el tema de octubre es duplicado por la comprobación léxica", () => {
    const d = decidirDuplicado(plan({ tema_es: "diferencia entre diseño de producto y UX" }), CORPUS, AHORA);
    expect(d).toMatchObject({ fuente: "léxica", existente: { id: 900, estado: "publicado" } });
    expect(d.existente.url).toBe("/es/blog/diferencia-entre-diseno-de-producto-y-diseno-ux");
  });

  it("si la léxica no ve nada, decide la semántica del planificador", () => {
    const d = decidirDuplicado(
      plan({ tema_es: "por qué tu equipo confunde a quien diseña con quien decide", duplicadoDe: { id: 900 }, motivo: "Misma tesis." }),
      CORPUS,
      AHORA,
    );
    expect(d).toMatchObject({ fuente: "semántica", motivo: "Misma tesis.", existente: { id: 900 } });
  });

  it("un tema nuevo pasa", () => {
    expect(decidirDuplicado(plan({ tema_es: "cómo priorizar funcionalidades de un producto digital" }), CORPUS, AHORA)).toBeNull();
  });
});

describe("categoriaParaCluster", () => {
  it("respeta la categoría si ya es del cluster", () => {
    expect(categoriaParaCluster("DESIGN", "C2")).toBe("DESIGN");
    expect(categoriaParaCluster("TECH", "C3")).toBe("TECH");
  });

  it("la cambia por la del cluster si no lo es", () => {
    expect(categoriaParaCluster("TECH", "C1")).toBe("PRODUCT");
    expect(categoriaParaCluster(null, "C2")).toBe("UX");
  });
});

// Miércoles 29 de julio de 2026, 07:30 Madrid: dos tomas.
const MIERCOLES = new Date("2026-07-29T05:30:00Z");

const take = (extra = {}) => ({
  angle: "data",
  text: "Texto de la toma",
  hashtags: ["#IA"],
  image_query: "abstract texture",
  cross_note: "Sugerencia",
  ...extra,
});

describe("buildTakeRows", () => {
  it("numera las tomas desde 1 y usa el horario del calendario", () => {
    const schedules = variantScheduleFor(MIERCOLES);
    const rows = buildTakeRows({
      postId: 42,
      takes: [take(), take()],
      schedules,
      images: ["https://blob/1.jpg", "https://blob/2.jpg"],
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.variant)).toEqual([1, 2]);
    expect(rows.map((r) => r.postId)).toEqual([42, 42]);
    expect(rows[0].scheduledFor).toEqual(schedules[0]);
    expect(rows[1].scheduledFor).toEqual(schedules[1]);
    expect(rows[0].imageBlobUrl).toBe("https://blob/1.jpg");
  });

  it("convierte los hashtags ausentes en un array vacío", () => {
    const rows = buildTakeRows({
      postId: 1,
      takes: [take({ hashtags: undefined })],
      schedules: variantScheduleFor(MIERCOLES),
      images: ["https://blob/1.jpg"],
    });
    expect(rows[0].hashtags).toEqual([]);
  });

  it("convierte una nota cruzada en blanco en null", () => {
    const rows = buildTakeRows({
      postId: 1,
      takes: [take({ cross_note: "   " })],
      schedules: variantScheduleFor(MIERCOLES),
      images: ["https://blob/1.jpg"],
    });
    expect(rows[0].crossNote).toBeNull();
  });
});
