import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLUSTERS,
  CLUSTERS_POSICIONAMIENTO,
  clusterFromHrefs,
  clusterHref,
  clusterOfContent,
} from "./clusters";

// Los posts publicados desde el 2 de octubre de 2026 (hora de Madrid) tienen
// que caer en uno de los tres clusters del posicionamiento. Los anteriores
// pueden seguir en IA o fuera de cluster: ya están publicados y su cluster es
// el que se les dio el 2026-09-25.
const CORTE = new Date("2026-10-01T22:00:00.000Z");
const FIXTURE = path.join(process.cwd(), "seo", "fixtures", "posts-publicados.json");

describe("clusterFromHrefs", () => {
  it("da el cluster de la página a la que enlaza el post", () => {
    expect(clusterFromHrefs(["/es/blog/otro", clusterHref("C1", "es")], "es")).toBe("C1");
    expect(clusterFromHrefs([clusterHref("C2", "en")], "en")).toBe("C2");
  });

  it("solo cuenta la página del idioma del post", () => {
    expect(clusterFromHrefs([clusterHref("C3", "en")], "es")).toBeNull();
  });

  it("sin enlace a ninguna página de cluster, fuera de cluster", () => {
    expect(clusterFromHrefs(["/es/blog/otro", "/es/casos"], "es")).toBeNull();
    expect(clusterFromHrefs(undefined, "es")).toBeNull();
  });
});

describe("clusterOfContent", () => {
  it("lee el enlace del HTML, relativo o absoluto", () => {
    expect(clusterOfContent('<p>Así <a href="/es/producto-para-tu-equipo">lo hacemos</a>.</p>', "es")).toBe("C3");
    expect(clusterOfContent('<a href="https://www.room714.com/en/ai-in-the-product">x</a>', "en")).toBe("IA");
    expect(clusterOfContent("<p>Sin enlaces.</p>", "es")).toBeNull();
  });
});

describe("CLUSTERS", () => {
  it("cada cluster tiene un tema para el JSON-LD, sin paréntesis", () => {
    for (const c of Object.values(CLUSTERS))
      for (const lang of ["es", "en"]) {
        expect(c.topic[lang]).toBeTruthy();
        expect(c.topic[lang]).not.toMatch(/[()]/);
      }
  });
});

describe("posts publicados (seo/fixtures/posts-publicados.json)", () => {
  it("existe el fixture exportado", () => {
    expect(fs.existsSync(FIXTURE), "Falta el fixture: ver docs/seo-audit-2026-10.md, tarea 3").toBe(true);
  });

  it("todo post publicado después del 01/10/2026 está en uno de los tres clusters", () => {
    if (!fs.existsSync(FIXTURE)) return; // ya lo marca el test anterior
    const { posts } = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
    const sinCluster = posts
      .filter((p) => new Date(p.publishedAt) >= CORTE)
      .map((p) => ({ slug: p.slug, cluster: clusterFromHrefs(p.internalHrefs, p.locale) }))
      .filter((p) => !CLUSTERS_POSICIONAMIENTO.includes(p.cluster));
    expect(sinCluster).toEqual([]);
  });
});
