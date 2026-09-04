// Hoja de contactos de todas las páginas, en escritorio y en móvil.
//
// Existe porque durante tres fases he verificado la maquetación con curl y
// grep, que ven un 404 y una jerarquía de encabezados pero no ven un margen
// descuadrado, un solape ni una ilustración cruzando el texto en diagonal.
//
// Usa el Chrome que ya está instalado en modo headless. Sin dependencias
// nuevas.
//
// Uso:
//   node scripts/capturar.mjs                        (contra local, las dos medidas)
//   node scripts/capturar.mjs --lang=en --solo=movil
//   node scripts/capturar.mjs --base=https://www.room714.com --dir=antes

import { execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import { promisify } from "node:util";
import { EN_SITEMAP, path as rutaDe } from "../app/lib/routes.mjs";

const ejecutar = promisify(execFile);

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];

const arg = (nombre, porDefecto) => {
  const hit = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  return hit ? hit.slice(nombre.length + 3) : porDefecto;
};

const BASE = arg("base", "http://localhost:3111").replace(/\/$/, "");
const LANG = arg("lang", "es");
const DIR = arg("dir", "capturas");
const SOLO = arg("solo", null);

// Escritorio al ancho del contenedor central (max-w-400 = 1600px) más los
// laterales, para ver el marco como lo ve un portátil grande.
const MEDIDAS = {
  movil: { w: 428, h: 926 },      // iPhone 14 Plus
  tablet: { w: 820, h: 1180 },    // iPad A16
  escritorio: { w: 1366, h: 768 },// el que usas para revisar
  ancho: { w: 1920, h: 1080 },
};

async function capturar(chrome, ruta, nombre, medida) {
  const { w, h } = MEDIDAS[medida];
  const destino = `${DIR}/${medida}/${nombre}.png`;
  await ejecutar(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=${w},${h}`,
    "--screenshot=" + destino,
    "--virtual-time-budget=2500",
    `${BASE}${ruta}`,
  ]);
  return destino;
}

async function main() {
  const { existsSync } = await import("node:fs");
  const chrome = CHROME.find((c) => existsSync(c));
  if (!chrome) throw new Error("No encuentro chrome.exe");

  const medidas = SOLO ? [SOLO] : Object.keys(MEDIDAS);
  for (const m of medidas) mkdirSync(`${DIR}/${m}`, { recursive: true });

  // Todas las páginas del sitio, más un artículo del blog para la plantilla.
  const paginas = EN_SITEMAP.map((clave) => ({
    nombre: clave,
    ruta: rutaDe(clave, LANG),
  }));

  for (const { nombre, ruta } of paginas) {
    for (const medida of medidas) {
      try {
        const destino = await capturar(chrome, ruta, nombre, medida);
        console.log(`  ${medida.padEnd(11)} ${ruta.padEnd(46)} → ${destino}`);
      } catch (error) {
        console.log(`  ✗ ${medida} ${ruta}: ${error.message.split("\n")[0]}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
