// Markdown → HTML para el cuerpo de un email.
//
// Solo lo que escriben de verdad los resúmenes de IA de los CV: títulos
// (#, ##, ###…), listas con «-» o «*», separadores (---), párrafos y
// **negrita**. Antes solo se convertía la negrita y los títulos llegaban
// con las almohadillas a la vista.
//
// Todo el texto se escapa antes de convertir: el resumen incluye respuestas
// libres del candidato. Los estilos van en línea porque Gmail y Outlook
// ignoran las hojas de estilo.

const escapar = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const enLinea = (s) => escapar(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

const ESTILO = {
  h3: "margin:20px 0 8px;font-size:17px;color:#000;",
  h4: "margin:16px 0 6px;font-size:15px;color:#000;",
  p: "margin:0 0 12px;",
  ul: "margin:0 0 12px;padding-left:20px;",
  li: "margin:0 0 4px;",
  hr: "border:none;border-top:1px solid #ddd;margin:16px 0;",
};

export function markdownToBasicHtml(md) {
  const salida = [];
  let parrafo = [];
  let lista = null;

  const cerrarParrafo = () => {
    if (parrafo.length) salida.push(`<p style="${ESTILO.p}">${parrafo.join("<br>")}</p>`);
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista) salida.push(`<ul style="${ESTILO.ul}">${lista.join("")}</ul>`);
    lista = null;
  };
  const cerrarTodo = () => {
    cerrarParrafo();
    cerrarLista();
  };

  for (const bruta of md.replace(/\r\n/g, "\n").split("\n")) {
    const linea = bruta.trim();
    if (!linea) {
      cerrarTodo();
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(linea)) {
      cerrarTodo();
      salida.push(`<hr style="${ESTILO.hr}">`);
      continue;
    }

    const titulo = linea.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (titulo) {
      cerrarTodo();
      const tag = titulo[1].length <= 2 ? "h3" : "h4";
      salida.push(`<${tag} style="${ESTILO[tag]}">${enLinea(titulo[2])}</${tag}>`);
      continue;
    }

    // «-» o «*» seguidos de espacio: así «**negrita**» no cuenta como lista.
    const punto = linea.match(/^[-*]\s+(.+)$/);
    if (punto) {
      cerrarParrafo();
      (lista ??= []).push(`<li style="${ESTILO.li}">${enLinea(punto[1])}</li>`);
      continue;
    }

    cerrarLista();
    parrafo.push(enLinea(linea));
  }
  cerrarTodo();

  return salida.join("\n");
}
