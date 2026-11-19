import { describe, expect, it } from "vitest";
import { LINKEDIN_COMPANY, LINKEDIN_FOUNDER, withLinkedInUtm, withUtm } from "@/app/lib/links";

describe("withUtm", () => {
  it("marca origen y medio", () => {
    const u = new URL(withUtm(LINKEDIN_COMPANY));
    expect(u.searchParams.get("utm_source")).toBe("room714.com");
    expect(u.searchParams.get("utm_medium")).toBe("referral");
  });

  it("añade campaña y contenido cuando se los pasas", () => {
    const u = new URL(
      withUtm(LINKEDIN_FOUNDER, { campaign: "blog", content: "firma-articulo" }),
    );
    expect(u.searchParams.get("utm_campaign")).toBe("blog");
    expect(u.searchParams.get("utm_content")).toBe("firma-articulo");
  });

  it("omite los parámetros que no se le dan, en lugar de poner vacíos", () => {
    const u = new URL(withUtm(LINKEDIN_COMPANY));
    expect(u.searchParams.has("utm_campaign")).toBe(false);
    expect(u.searchParams.has("utm_content")).toBe(false);
  });

  it("no pierde el resto de la URL", () => {
    const u = new URL(withUtm(`${LINKEDIN_COMPANY}posts/?locale=es_ES`));
    expect(u.pathname).toBe("/company/room-714/posts/");
    expect(u.searchParams.get("locale")).toBe("es_ES");
  });

  it("no duplica los utm si la URL ya venía marcada", () => {
    const dos = withUtm(withUtm(LINKEDIN_COMPANY, { campaign: "a" }), {
      campaign: "b",
    });
    expect([...new URL(dos).searchParams.getAll("utm_campaign")]).toEqual(["b"]);
  });

  it("los dos perfiles apuntan a la URL canónica de cada uno", () => {
    expect(LINKEDIN_COMPANY).toContain("/company/room-714");
    expect(LINKEDIN_FOUNDER).toContain("/in/josecesfranjo");
  });
});

describe("withLinkedInUtm", () => {
  it("marca LinkedIn como origen y el slug como contenido", () => {
    const u = new URL(withLinkedInUtm("https://www.room714.com/es/blog/mi-post", "mi-post"));
    expect(Object.fromEntries(u.searchParams)).toEqual({
      utm_source: "linkedin",
      utm_medium: "social",
      utm_campaign: "blog",
      utm_content: "mi-post",
    });
  });

  it("sustituye los utm previos en vez de duplicarlos", () => {
    const u = new URL(
      withLinkedInUtm("https://www.room714.com/es/blog/a?utm_source=x&ref=1", "a"),
    );
    expect(u.searchParams.getAll("utm_source")).toEqual(["linkedin"]);
    expect(u.searchParams.get("ref")).toBe("1");
  });
});
