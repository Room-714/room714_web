import { describe, expect, it } from "vitest";
import {
  clusterDePost,
  franjaLinkedIn,
  mejorPostDeLaSemana,
  proximaEjecucion,
  siguientePostPerfil,
} from "./selectores";

// Semana del lunes 16 al domingo 22 de noviembre de 2026 (CET, UTC+1).
// 07:30 Madrid = 06:30 UTC; 08:30 Madrid = 07:30 UTC.
const post = (id, category, iso, extra = {}) => ({ id, category, date: new Date(iso), published: true, ...extra });
const VIERNES_0830 = new Date("2026-11-20T07:30:00Z");

describe("mejorPostDeLaSemana (página de empresa, viernes)", () => {
  it("prefiere C2 aunque haya uno más reciente de C1", () => {
    const posts = [
      post(1, "UX", "2026-11-16T06:30:00Z"), // C2, lunes
      post(2, "PRODUCT", "2026-11-19T06:30:00Z"), // C1, jueves
    ];
    expect(mejorPostDeLaSemana(posts, VIERNES_0830).id).toBe(1);
  });

  it("C1 gana a C3", () => {
    const posts = [post(1, "PRODUCT", "2026-11-16T06:30:00Z"), post(2, "TECH", "2026-11-19T06:30:00Z")];
    expect(mejorPostDeLaSemana(posts, VIERNES_0830).id).toBe(1);
  });

  it("entre dos del mismo cluster, el más reciente (DESIGN también es C2)", () => {
    const posts = [post(1, "UX", "2026-11-16T06:30:00Z"), post(2, "DESIGN", "2026-11-19T06:30:00Z")];
    expect(mejorPostDeLaSemana(posts, VIERNES_0830).id).toBe(2);
  });

  it("solo mira la semana de Madrid: un post del domingo anterior no cuenta", () => {
    const posts = [post(1, "UX", "2026-11-15T22:30:00Z") /* domingo 23:30 Madrid */];
    expect(mejorPostDeLaSemana(posts, VIERNES_0830)).toBeNull();
    // Domingo 23:30 UTC ya es lunes 00:30 en Madrid: ese sí cuenta.
    expect(mejorPostDeLaSemana([post(2, "UX", "2026-11-15T23:30:00Z")], VIERNES_0830).id).toBe(2);
  });

  it("no cuenta posts programados para después de ahora ni borradores", () => {
    const posts = [
      post(1, "UX", "2026-11-20T09:00:00Z"),
      post(2, "UX", "2026-11-18T06:30:00Z", { published: false }),
    ];
    expect(mejorPostDeLaSemana(posts, VIERNES_0830)).toBeNull();
  });

  it("semana sin posts nuevos: null (no se publica nada)", () => {
    expect(mejorPostDeLaSemana([post(1, "UX", "2026-11-12T06:30:00Z")], VIERNES_0830)).toBeNull();
    expect(mejorPostDeLaSemana([], VIERNES_0830)).toBeNull();
  });

  it("un post sin cluster reconocible va el último", () => {
    const posts = [post(1, "OTRA", "2026-11-19T06:30:00Z"), post(2, "TECH", "2026-11-16T06:30:00Z")];
    expect(clusterDePost(posts[0])).toBeNull();
    expect(mejorPostDeLaSemana(posts, VIERNES_0830).id).toBe(2);
  });
});

describe("siguientePostPerfil (perfil de José, martes y jueves)", () => {
  const posts = [
    post(1, "UX", "2026-11-09T06:30:00Z"),
    post(2, "TECH", "2026-11-12T06:30:00Z"),
    post(3, "PRODUCT", "2026-11-16T06:30:00Z"),
    post(4, "UX", "2026-11-19T06:30:00Z"),
  ];

  it("el más reciente ya publicado en la web", () => {
    expect(siguientePostPerfil(posts, [], new Date("2026-11-17T07:30:00Z")).id).toBe(3);
    expect(siguientePostPerfil(posts, [], new Date("2026-11-19T07:30:00Z")).id).toBe(4);
  });

  it("no reutiliza posts ya usados en el perfil", () => {
    expect(siguientePostPerfil(posts, [4, 3], new Date("2026-11-19T07:30:00Z")).id).toBe(2);
  });

  it("acepta ids como texto (vienen de JSON)", () => {
    expect(siguientePostPerfil(posts, ["4"], new Date("2026-11-19T07:30:00Z")).id).toBe(3);
  });

  it("null si ya se usaron todos", () => {
    expect(siguientePostPerfil(posts, [1, 2, 3, 4], new Date("2026-11-19T07:30:00Z"))).toBeNull();
  });
});

describe("franjaLinkedIn (qué toca en cada ejecución del cron)", () => {
  it("viernes 08:30 Madrid: página de empresa; 08:45: su reintento", () => {
    expect(franjaLinkedIn(new Date("2026-11-20T07:30:00Z"))).toEqual({ canal: "empresa", modo: "principal" });
    expect(franjaLinkedIn(new Date("2026-11-20T07:45:00Z"))).toEqual({ canal: "empresa", modo: "reintento" });
  });

  it("martes y jueves 08:30 Madrid: perfil de José", () => {
    expect(franjaLinkedIn(new Date("2026-11-17T07:30:00Z"))).toEqual({ canal: "personal", modo: "principal" });
    expect(franjaLinkedIn(new Date("2026-11-19T07:45:00Z"))).toEqual({ canal: "personal", modo: "reintento" });
  });

  it("el resto de ejecuciones no hace nada", () => {
    for (const iso of [
      "2026-11-16T07:30:00Z", // lunes
      "2026-11-18T07:30:00Z", // miércoles
      "2026-11-20T07:35:00Z", // viernes 08:35
      "2026-11-20T07:40:00Z", // viernes 08:40
      "2026-11-20T06:30:00Z", // viernes 07:30
      "2026-11-20T07:50:00Z", // viernes 08:50
    ]) {
      expect(franjaLinkedIn(new Date(iso))).toBeNull();
    }
  });

  it("en verano la misma hora de Madrid cae una hora antes en UTC", () => {
    expect(franjaLinkedIn(new Date("2026-07-24T06:30:00Z"))).toEqual({ canal: "empresa", modo: "principal" });
    expect(franjaLinkedIn(new Date("2026-07-24T07:30:00Z"))).toBeNull();
  });
});

describe("proximaEjecucion", () => {
  it("la siguiente franja de cada canal", () => {
    const miercoles = new Date("2026-11-18T12:00:00Z");
    expect(proximaEjecucion("empresa", miercoles)).toEqual(new Date("2026-11-20T07:30:00Z"));
    expect(proximaEjecucion("personal", miercoles)).toEqual(new Date("2026-11-19T07:30:00Z"));
  });

  it("pasada la de hoy, salta a la semana siguiente", () => {
    expect(proximaEjecucion("empresa", new Date("2026-11-20T07:31:00Z"))).toEqual(new Date("2026-11-27T07:30:00Z"));
  });
});
