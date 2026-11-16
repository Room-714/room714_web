import { describe, expect, it } from "vitest";
import { campanaDeQuery } from "@/app/lib/campana";
import { normalizarCampana } from "@/app/lib/leads/guardar";

describe("campanaDeQuery", () => {
  it("se queda solo con utm_* y gclid", () => {
    expect(
      campanaDeQuery("?utm_source=google&utm_medium=cpc&utm_campaign=ia&utm_term=formacion+ia&gclid=abc&otro=x"),
    ).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "ia",
      utm_term: "formacion ia",
      gclid: "abc",
    });
  });

  it("sin parámetros devuelve un objeto vacío", () => {
    expect(campanaDeQuery("")).toEqual({});
    expect(campanaDeQuery(undefined)).toEqual({});
  });

  it("recorta valores absurdamente largos", () => {
    expect(campanaDeQuery(`?gclid=${"a".repeat(500)}`).gclid).toHaveLength(200);
  });
});

describe("normalizarCampana", () => {
  it("descarta claves desconocidas y valores que no son texto", () => {
    expect(normalizarCampana({ utm_source: "google", gclid: 3, hack: "x" })).toEqual({
      utm_source: "google",
    });
    expect(normalizarCampana(null)).toEqual({});
  });
});
