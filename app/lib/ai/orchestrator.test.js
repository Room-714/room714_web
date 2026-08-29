import { describe, expect, it } from "vitest";
import { buildTakeRows } from "./orchestrator";
import { variantScheduleFor } from "@/app/lib/time/linkedinSchedule";

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
