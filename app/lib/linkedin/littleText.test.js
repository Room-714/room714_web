import { describe, expect, it } from "vitest";
import { escaparLittleText, paraLinkedIn } from "./littleText";
import { CIERRE } from "./perfilPersonal";

describe("escaparLittleText", () => {
  it("el cierre del perfil sale con los paréntesis escapados", () => {
    const cierre = "Si te pasa algo parecido, escríbeme o pide una sesión de diagnóstico (enlace en mi perfil).";
    expect(CIERRE).toBe(cierre);
    expect(escaparLittleText(cierre)).toBe(
      "Si te pasa algo parecido, escríbeme o pide una sesión de diagnóstico \\(enlace en mi perfil\\).",
    );
  });

  it("no escapa los # de los hashtags", () => {
    const texto = `${CIERRE}\n\n#CX #ProductoDigital`;
    const escapado = escaparLittleText(texto);
    expect(escapado.endsWith("\n\n#CX #ProductoDigital")).toBe(true);
    expect(escapado).not.toContain("\\#");
  });

  it("escapa todos los reservados: ( ) [ ] { } < > | @ * _ ~ \\", () => {
    expect(escaparLittleText("()[]{}<>|@*_~\\")).toBe(
      "\\(\\)\\[\\]\\{\\}\\<\\>\\|\\@\\*\\_\\~\\\\",
    );
  });

  it("deja igual el resto (acentos, signos, puntos, comillas)", () => {
    const t = "¿Qué pasó? «Nada»: 40 %, 3.5 y \"comillas\" — ok!";
    expect(escaparLittleText(t)).toBe(t);
  });
});

describe("paraLinkedIn", () => {
  it("escapa solo los campos de texto de la publicación, sin tocar la URL del enlace", () => {
    const url = "https://www.room714.com/es/blog/x?utm_source=linkedin&utm_content=mi_post";
    const original = {
      canal: "empresa",
      title: "Título (con paréntesis)",
      linkedin_post: "Texto (empresa) con @mención",
      linkedin_hashtags_string: "#UX #CX",
      url,
      link_for_first_comment: url,
    };
    const p = paraLinkedIn(original);
    expect(p.linkedin_post).toBe("Texto \\(empresa\\) con \\@mención");
    expect(p.linkedin_hashtags_string).toBe("#UX #CX");
    expect(p.url).toBe(url);
    expect(p.link_for_first_comment).toBe(url);
    expect(p.title).toBe(original.title);
    // No muta el original (es lo que se guarda en la BD).
    expect(original.linkedin_post).toBe("Texto (empresa) con @mención");
  });

  it("escapa el texto del perfil personal", () => {
    expect(paraLinkedIn({ canal: "personal", texto: CIERRE }).texto).toContain("\\(enlace en mi perfil\\)");
  });
});
