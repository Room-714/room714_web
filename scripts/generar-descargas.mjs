// Genera los dos documentos descargables de la landing de IA en tu empresa,
// cada uno en PDF (para leer) y DOCX (para editar), en public/descargas.
//
//   node scripts/generar-descargas.mjs
//
// - El texto sale de scripts/descargas/contenido.mjs (uno solo para los dos
//   formatos).
// - El PDF se imprime con el Chrome instalado en modo headless a partir de
//   un HTML con la identidad de la web: logo de public/logo.svg, Montserrat
//   para titulares, Gantari para el texto, Mynerve para los rótulos y el rojo
//   de los botones. Las fuentes se cargan de Google Fonts, así que hace falta
//   red al generar.
// - El DOCX se monta con la librería `docx` (devDependency) con las mismas
//   fuentes y colores, y las fuentes van incrustadas (las tres son OFL): así
//   se ve igual en un equipo que no las tenga instaladas.
//
// Los ficheros se sirven con X-Robots-Tag: noindex (next.config.mjs) y el
// proxy no les pone prefijo de idioma (proxy.js).

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  TextRun,
} from "docx";
import { CHECKLIST, PIE, POLITICA, trocear } from "./descargas/contenido.mjs";

const ejecutar = promisify(execFile);

const RAIZ = resolve(import.meta.dirname, "..");
const SALIDA = join(RAIZ, "public", "descargas");
const LOGO_SVG = readFileSync(join(RAIZ, "public", "logo.svg"), "utf8");

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].find((p) => existsSync(p));

// Colores y fuentes de la web.
const NEGRO = "1A1A1A";
const ROJO = "DC2626"; // red-600, botones y acentos
const GRIS = "6B7280";
const HUECO = "FEE2E2"; // red-100, fondo de los huecos a rellenar

const tmp = mkdtempSync(join(tmpdir(), "r714-descargas-"));

async function chrome(args) {
  if (!CHROME) throw new Error("No encuentro Chrome para imprimir el PDF");
  await ejecutar(CHROME, [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    `--user-data-dir=${join(tmp, "perfil")}`,
    ...args,
  ]);
}

// ─── PDF ────────────────────────────────────────────────────────────────────

const esc = (t) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const conHuecos = (texto) =>
  trocear(texto)
    .map((t) => (t.hueco ? `<span class="hueco">${esc(t.texto)}</span>` : esc(t.texto)))
    .join("");

function plantillaHtml({ rotulo, titulo, subtitulo, cuerpo }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gantari:wght@400;700&family=Montserrat:wght@700;900&family=Mynerve&display=block" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 18mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  /* Una página: el cuerpo ocupa el alto útil del A4 (297 - 16 - 14 mm) y el
     pie se queda abajo sin crear otra página. */
  body { display: flex; flex-direction: column; height: 266mm; font-family: Gantari, sans-serif; color: #${NEGRO}; font-size: 10.5pt; line-height: 1.45; font-variant-ligatures: no-common-ligatures; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 9mm; }
  header svg { height: 13mm; width: auto; }
  .rotulo { font-family: Mynerve, cursive; color: #${ROJO}; font-size: 13pt; }
  h1 { font-family: Montserrat, sans-serif; font-weight: 900; font-size: 21pt; line-height: 1.15; margin: 0 0 3mm; }
  .subtitulo { color: #${GRIS}; font-size: 10.5pt; margin: 0 0 7mm; }
  .intro { font-size: 11pt; margin: 0 0 6mm; }
  ol.secciones { list-style: none; padding: 0; margin: 0; }
  ol.secciones li { display: grid; grid-template-columns: 9mm 1fr; margin-bottom: 3.2mm; break-inside: avoid; }
  .num { font-family: Mynerve, cursive; color: #${ROJO}; font-size: 13pt; line-height: 1.1; }
  strong { font-family: Montserrat, sans-serif; font-weight: 700; }
  ul.casillas { list-style: none; padding: 0; margin: 0; }
  ul.casillas li { display: grid; grid-template-columns: 9mm 1fr; margin-bottom: 3.6mm; break-inside: avoid; }
  .caja { width: 4.4mm; height: 4.4mm; border: 1.6px solid #${NEGRO}; border-radius: 1mm; margin-top: 0.6mm; }
  .nota { margin-top: 6mm; padding-top: 3mm; border-top: 1px solid #E5E5E5; color: #${GRIS}; font-size: 9pt; }
  .hueco { background: #${HUECO}; border-radius: 3px; padding: 0 2px; font-weight: 700; }
  footer { margin-top: auto; border-top: 1px solid #E5E5E5; padding-top: 2.5mm; color: #${GRIS}; font-size: 8.5pt; }
</style></head>
<body>
  <header>${LOGO_SVG.replace("<svg ", '<svg role="img" aria-label="Room 714" ')}<span class="rotulo">${esc(rotulo)}</span></header>
  <h1>${conHuecos(titulo)}</h1>
  ${subtitulo ? `<p class="subtitulo">${conHuecos(subtitulo)}</p>` : ""}
  ${cuerpo}
  <footer>${esc(PIE)}</footer>
</body></html>`;
}

function htmlPolitica() {
  const cuerpo = `<ol class="secciones">${POLITICA.secciones
    .map(
      (s, i) =>
        `<li><span class="num">${i + 1}.</span><p style="margin:0"><strong>${esc(s.titulo)}</strong> ${conHuecos(s.texto)}</p></li>`,
    )
    .join("")}</ol>`;
  return plantillaHtml({ ...POLITICA, cuerpo });
}

function htmlChecklist() {
  const cuerpo = `<p class="intro">${esc(CHECKLIST.intro)}</p>
  <ul class="casillas">${CHECKLIST.casillas
    .map((c) => `<li><span class="caja"></span><span>${esc(c)}</span></li>`)
    .join("")}</ul>
  <p class="nota">${esc(CHECKLIST.nota)}</p>`;
  return plantillaHtml({ ...CHECKLIST, subtitulo: null, cuerpo });
}

async function pdf(nombre, html) {
  const fuente = join(tmp, `${nombre}.html`);
  writeFileSync(fuente, html);
  const destino = join(SALIDA, `${nombre}.pdf`);
  await chrome([
    "--no-pdf-header-footer",
    "--virtual-time-budget=10000",
    `--print-to-pdf=${destino}`,
    pathToFileURL(fuente).href,
  ]);
  const paginas = (readFileSync(destino, "latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`  ${nombre}.pdf · ${paginas} página(s)`);
  if (paginas !== 1) console.warn(`  ¡Ojo! ${nombre}.pdf debería ocupar una página`);
}

// ─── DOCX ───────────────────────────────────────────────────────────────────

/**
 * Los TTF de Google Fonts, para incrustarlos. La API de CSS devuelve TTF a un
 * cliente que no es un navegador; se toma la URL de cada peso.
 */
async function ttf(familia, peso) {
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${familia}:wght@${peso}`)
  ).text();
  const url = css.match(/url\((https:[^)]+\.ttf)\)/)?.[1];
  if (!url) throw new Error(`Sin TTF para ${familia} ${peso}`);
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

async function fuentesIncrustadas() {
  const [gantari, gantariBold, montserrat, mynerve] = await Promise.all([
    ttf("Gantari", 400),
    ttf("Gantari", 700),
    ttf("Montserrat", 700),
    ttf("Mynerve", 400),
  ]);
  return [
    { name: "Gantari", data: gantari, bold: gantariBold },
    // Montserrat solo se usa en negrita (titulares).
    { name: "Montserrat", data: montserrat, bold: montserrat },
    { name: "Mynerve", data: mynerve },
  ];
}

async function logoPng() {
  // El logo es SVG; Word necesita un mapa de bits. Se rasteriza con el mismo
  // Chrome, a doble resolución y con fondo transparente.
  const fuente = join(tmp, "logo.html");
  writeFileSync(
    fuente,
    `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:658px;height:248px}</style>${LOGO_SVG}`,
  );
  const destino = join(tmp, "logo.png");
  await chrome([
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    "--default-background-color=00000000",
    "--window-size=658,248",
    `--screenshot=${destino}`,
    pathToFileURL(fuente).href,
  ]);
  return readFileSync(destino);
}

const corridas = (texto, base = {}) =>
  trocear(texto).map(
    (t) =>
      new TextRun({
        text: t.texto,
        ...base,
        ...(t.hueco
          ? { bold: true, shading: { type: ShadingType.CLEAR, fill: HUECO, color: "auto" } }
          : {}),
      }),
  );

function documento({ logo, fuentes, rotulo, titulo, subtitulo, cuerpo }) {
  return new Document({
    creator: "Room 714",
    fonts: fuentes,
    title: titulo,
    styles: {
      default: {
        document: {
          run: { font: "Gantari", size: 21, color: NEGRO },
          paragraph: { spacing: { line: 300 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 900, bottom: 1100, left: 1020, right: 1020, footer: 500, header: 500 } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new ImageRun({ type: "png", data: logo, transformation: { width: 130, height: 49 } }),
                  new TextRun({ text: "\t" + rotulo, font: "Mynerve", size: 24, color: ROJO }),
                ],
                tabStops: [{ type: "right", position: 9860 }],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E5E5E5", space: 6 } },
                children: [new TextRun({ text: PIE, size: 17, color: GRIS })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            spacing: { before: 200, after: 120 },
            children: corridas(titulo, { font: "Montserrat", bold: true, size: 40 }),
          }),
          ...(subtitulo
            ? [new Paragraph({ spacing: { after: 280 }, children: corridas(subtitulo, { color: GRIS }) })]
            : []),
          ...cuerpo,
        ],
      },
    ],
  });
}

function docxPolitica(logo, fuentes) {
  const cuerpo = POLITICA.secciones.map(
    (s, i) =>
      new Paragraph({
        spacing: { after: 140 },
        indent: { left: 440, hanging: 440 },
        children: [
          new TextRun({ text: `${i + 1}.\t`, font: "Mynerve", color: ROJO, size: 24 }),
          new TextRun({ text: s.titulo + " ", font: "Montserrat", bold: true }),
          ...corridas(s.texto),
        ],
        tabStops: [{ type: "left", position: 440 }],
      }),
  );
  return documento({ logo, fuentes, ...POLITICA, cuerpo });
}

function docxChecklist(logo, fuentes) {
  const cuerpo = [
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: CHECKLIST.intro, size: 22 })] }),
    ...CHECKLIST.casillas.map(
      (c) =>
        new Paragraph({
          spacing: { after: 140 },
          indent: { left: 440, hanging: 440 },
          tabStops: [{ type: "left", position: 440 }],
          children: [
            new TextRun({ text: "☐\t", font: "Segoe UI Symbol", size: 26 }),
            new TextRun({ text: c }),
          ],
        }),
    ),
    new Paragraph({
      spacing: { before: 240 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E5E5E5", space: 8 } },
      children: [new TextRun({ text: CHECKLIST.nota, size: 18, color: GRIS })],
    }),
  ];
  return documento({ logo, fuentes, ...CHECKLIST, subtitulo: null, cuerpo });
}

async function docx(nombre, doc) {
  writeFileSync(join(SALIDA, `${nombre}.docx`), await Packer.toBuffer(doc));
  console.log(`  ${nombre}.docx`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

mkdirSync(SALIDA, { recursive: true });
console.log(`Generando en ${SALIDA}`);
await pdf(POLITICA.fichero, htmlPolitica());
await pdf(CHECKLIST.fichero, htmlChecklist());
const logo = await logoPng();
const fuentes = await fuentesIncrustadas();
await docx(POLITICA.fichero, docxPolitica(logo, fuentes));
await docx(CHECKLIST.fichero, docxChecklist(logo, fuentes));
console.log("Hecho.");
