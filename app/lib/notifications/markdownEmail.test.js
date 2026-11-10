import { describe, expect, it } from "vitest";
import { markdownToBasicHtml } from "./markdownEmail";

const sinEstilos = (html) => html.replace(/ style="[^"]*"/g, "");

describe("markdownToBasicHtml", () => {
  it("convierte los títulos y no deja almohadillas a la vista", () => {
    const html = sinEstilos(markdownToBasicHtml("## Respuestas en el chat\n\n### 1. Datos de contacto"));
    expect(html).toBe("<h3>Respuestas en el chat</h3>\n<h4>1. Datos de contacto</h4>");
    expect(html).not.toContain("#");
  });

  it("agrupa las líneas con guion en una lista, con negrita dentro", () => {
    const html = sinEstilos(
      markdownToBasicHtml("- **¿Dónde resides?** Madrid\n- **Experiencia:** 2 años"),
    );
    expect(html).toBe(
      "<ul><li><strong>¿Dónde resides?</strong> Madrid</li><li><strong>Experiencia:</strong> 2 años</li></ul>",
    );
  });

  it("no confunde una línea en negrita con una lista", () => {
    expect(sinEstilos(markdownToBasicHtml("**Fit con Room 714**: bueno"))).toBe(
      "<p><strong>Fit con Room 714</strong>: bueno</p>",
    );
  });

  it("convierte separadores y párrafos", () => {
    const html = sinEstilos(markdownToBasicHtml("Uno\ndos\n\n---\n\nTres"));
    expect(html).toBe("<p>Uno<br>dos</p>\n<hr>\n<p>Tres</p>");
  });

  it("escapa el HTML de las respuestas libres del candidato", () => {
    const html = markdownToBasicHtml("- **Residencia:** <script>alert(1)</script> & co");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; co");
    expect(html).not.toContain("<script>");
  });

  it("acepta finales de línea de Windows", () => {
    expect(sinEstilos(markdownToBasicHtml("## Título\r\n- punto"))).toBe(
      "<h3>Título</h3>\n<ul><li>punto</li></ul>",
    );
  });
});
