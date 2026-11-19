import { describe, expect, it } from "vitest";
import {
  ESTADOS,
  conflictosSemana,
  construirPublicacion,
  elegirTomaEmpresa,
  fechaPrevistaLinkedIn,
  proximaVentana,
  semanaMadrid,
  transicion,
  utmEnTexto,
} from "./aprobacion";

// Semana del lunes 16 al domingo 22 de noviembre de 2026 (CET, UTC+1).
const LUNES_0730 = new Date("2026-11-16T06:30:00Z");
const JUEVES_0730 = new Date("2026-11-19T06:30:00Z");
const DOMINGO_ANTES = new Date("2026-11-15T12:00:00Z");

const traducciones = (slug = "mi-post", title = "Mi post") => [
  {
    lang: "es",
    slug,
    title,
    tags: ["ux"],
    content: "<p>Contenido del artículo</p>",
    linkedinPost: null,
    linkedinHashtags: [],
  },
];

describe("transicion", () => {
  it("la casilla pasa de solo web a pendiente, nunca a aprobado", () => {
    expect(transicion("SOLO_WEB", "marcar")).toEqual({ estado: "PENDIENTE" });
    expect(transicion("APROBADO", "marcar")).toEqual({ estado: "APROBADO" });
  });

  it("solo se aprueba lo que está pendiente", () => {
    expect(transicion("PENDIENTE", "aprobar")).toEqual({ estado: "APROBADO" });
    expect(transicion("SOLO_WEB", "aprobar").error).toMatch(/Marca antes la casilla/);
  });

  it("desmarcar devuelve a solo web y retirar devuelve a pendiente", () => {
    expect(transicion("APROBADO", "desmarcar")).toEqual({ estado: "SOLO_WEB" });
    expect(transicion("APROBADO", "retirar")).toEqual({ estado: "PENDIENTE" });
    expect(transicion("PENDIENTE", "retirar").error).toBeTruthy();
  });

  it("lo ya publicado no admite ningún cambio", () => {
    for (const accion of ["marcar", "desmarcar", "aprobar", "retirar"]) {
      expect(transicion(ESTADOS.PUBLICADO, accion).error).toMatch(/ya está publicado/);
    }
  });
});

describe("semanaMadrid", () => {
  it("va de lunes 00:00 a lunes 00:00 de Madrid", () => {
    expect(semanaMadrid(new Date("2026-11-18T10:00:00Z"))).toEqual({
      inicio: new Date("2026-11-15T23:00:00Z"),
      fin: new Date("2026-11-22T23:00:00Z"),
    });
  });

  it("el domingo a última hora sigue en la misma semana y el lunes 00:30 ya no", () => {
    expect(semanaMadrid(new Date("2026-11-22T22:30:00Z")).inicio).toEqual(
      new Date("2026-11-15T23:00:00Z"),
    );
    expect(semanaMadrid(new Date("2026-11-22T23:30:00Z")).inicio).toEqual(
      new Date("2026-11-22T23:00:00Z"),
    );
  });

  it("respeta el cambio de hora de octubre", () => {
    expect(semanaMadrid(new Date("2026-10-22T10:00:00Z"))).toEqual({
      inicio: new Date("2026-10-18T22:00:00Z"),
      fin: new Date("2026-10-25T23:00:00Z"),
    });
  });
});

describe("proximaVentana", () => {
  it("dentro de la ventana de la mañana, es el mismo instante", () => {
    const d = new Date("2026-11-18T07:15:00Z"); // miércoles 08:15
    expect(proximaVentana(d)).toEqual(d);
  });

  it("por la tarde pasa a las 07:00 del día siguiente", () => {
    expect(proximaVentana(new Date("2026-11-18T16:00:00Z"))).toEqual(
      new Date("2026-11-19T06:00:00Z"),
    );
  });

  it("el viernes por la tarde y el fin de semana pasan al lunes", () => {
    const lunes = new Date("2026-11-23T06:00:00Z");
    expect(proximaVentana(new Date("2026-11-20T12:00:00Z"))).toEqual(lunes);
    expect(proximaVentana(new Date("2026-11-21T09:00:00Z"))).toEqual(lunes);
  });
});

describe("fechaPrevistaLinkedIn", () => {
  it("un post programado sale cuando está en la web", () => {
    expect(fechaPrevistaLinkedIn({ date: JUEVES_0730 }, DOMINGO_ANTES)).toEqual(
      JUEVES_0730,
    );
  });

  it("lo publicado devuelve su fecha real", () => {
    const publicadoAt = new Date("2026-11-10T07:05:00Z");
    expect(
      fechaPrevistaLinkedIn({ date: LUNES_0730, linkedinPublicadoAt: publicadoAt }),
    ).toEqual(publicadoAt);
  });
});

describe("conflictosSemana", () => {
  const post = { id: 1, date: JUEVES_0730, linkedinEstado: "PENDIENTE" };

  it("sin otras publicaciones esa semana no hay conflicto", () => {
    const r = conflictosSemana({ post, otros: [], now: DOMINGO_ANTES });
    expect(r.superaLimite).toBe(false);
    expect(r.conflictos).toEqual([]);
  });

  it("otro aprobado en la misma semana supera el límite de 1", () => {
    const otro = {
      id: 2,
      date: new Date("2026-11-16T07:00:00Z"),
      linkedinEstado: "APROBADO",
      translations: traducciones("otro", "Otro post"),
    };
    const r = conflictosSemana({ post, otros: [otro], now: DOMINGO_ANTES });
    expect(r.superaLimite).toBe(true);
    expect(r.conflictos).toEqual([
      expect.objectContaining({ postId: 2, titulo: "Otro post", estado: "APROBADO" }),
    ]);
  });

  it("lo publicado la semana anterior no cuenta", () => {
    const otro = {
      id: 3,
      date: new Date("2026-11-09T06:30:00Z"),
      linkedinEstado: "PUBLICADO",
      linkedinPublicadoAt: new Date("2026-11-13T07:00:00Z"),
    };
    expect(
      conflictosSemana({ post, otros: [otro], now: DOMINGO_ANTES }).superaLimite,
    ).toBe(false);
  });

  it("de las tomas del sistema anterior solo cuentan las de la página de empresa", () => {
    const postLunes = { id: 9, date: LUNES_0730, translations: traducciones() };
    const enviadaMartes = new Date("2026-11-17T06:40:00Z");
    const r = conflictosSemana({
      post,
      tomasEnviadas: [
        { variant: 1, sentAt: enviadaMartes, post: postLunes }, // personal
        { variant: 2, sentAt: enviadaMartes, post: postLunes }, // empresa
      ],
      now: DOMINGO_ANTES,
    });
    expect(r.conflictos).toHaveLength(1);
    expect(r.conflictos[0]).toMatchObject({ postId: 9, estado: "PUBLICADO" });
  });
});

describe("construirPublicacion", () => {
  const tomas = [
    { id: 11, variant: 1, angle: "data", text: "Toma personal", hashtags: ["IA"], imageBlobUrl: "https://img/1.jpg" },
    { id: 12, variant: 2, angle: "polemica", text: "Toma de empresa: https://www.room714.com/es/blog/mi-post", hashtags: ["#UX", "CX"], imageBlobUrl: "https://img/2.jpg" },
  ];
  const post = {
    id: 5,
    date: LUNES_0730,
    image: "https://img/portada.jpg",
    translations: traducciones(),
    linkedinVariants: tomas,
  };

  it("elige la toma pensada para la página de empresa", () => {
    expect(elegirTomaEmpresa(post).id).toBe(12);
  });

  it("publica siempre por el canal de empresa con enlaces con UTM", () => {
    const p = construirPublicacion(post);
    expect(p.canal).toBe("empresa");
    const url = new URL(p.url);
    expect(url.origin + url.pathname).toBe("https://www.room714.com/es/blog/mi-post");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: "linkedin",
      utm_medium: "social",
      utm_campaign: "blog",
      utm_content: "mi-post",
    });
    expect(p.link_for_first_comment).toBe(p.url);
    expect(p.variant_id).toBe(12);
    expect(p.image).toBe("https://img/2.jpg");
    expect(p.linkedin_hashtags_string).toBe("#UX #CX");
  });

  it("el enlace al artículo dentro del texto también lleva UTM", () => {
    const p = construirPublicacion(post);
    expect(p.linkedin_post).toBe(`Toma de empresa: ${p.url}`);
  });

  it("sin tomas usa el texto de la traducción o un resumen, y la portada", () => {
    const p = construirPublicacion({ ...post, linkedinVariants: [] });
    expect(p.linkedin_post).toBe("Contenido del artículo");
    expect(p.variant_id).toBe("");
    expect(p.image).toBe("https://img/portada.jpg");
  });

  it("sin traducción española no hay publicación", () => {
    expect(construirPublicacion({ ...post, translations: [] })).toBeNull();
  });
});

describe("utmEnTexto", () => {
  it("no toca enlaces a otros artículos que empiecen por el mismo slug", () => {
    const texto = "Ver https://www.room714.com/es/blog/mi-post-2 y https://room714.com/es/blog/mi-post.";
    expect(utmEnTexto(texto, "mi-post", "URL_UTM")).toBe(
      "Ver https://www.room714.com/es/blog/mi-post-2 y URL_UTM.",
    );
  });
});
