// Verifica, contra un servidor real, lo que promete la arquitectura de
// rutas: que las URLs nuevas responden 200, que las antiguas hacen 301 al
// sitio correcto, que las guardas de idioma no dejan contenido duplicado y
// que ninguna URL del sitemap antiguo se ha quedado muerta.
//
// Uso:
//   node scripts/verificar-rutas.mjs                          (contra local)
//   node scripts/verificar-rutas.mjs https://www.room714.com   (contra prod)
//
// Sale con codigo 1 si algo falla, para poder usarlo en CI.
import { RENOMBRADAS, TODAS, guardasDeIdioma, pathsOf } from "../app/lib/routes.mjs";

const BASE = process.argv[2] || "http://localhost:3111";

let fallos = 0;
const mal = (t) => {
  fallos += 1;
  console.log(`  ✗ ${t}`);
};

const rutaDe = (u) => (u.startsWith("http") ? new URL(u).pathname : u.split("?")[0]);

async function pedir(ruta) {
  const res = await fetch(`${BASE}${ruta}`, { redirect: "manual" });
  return {
    status: res.status,
    destino: res.headers.get("location"),
  };
}

console.log("─── URLs nuevas: deben responder 200");
for (const clave of Object.keys(TODAS)) {
  const rutas = pathsOf(clave);
  for (const lang of ["es", "en"]) {
    const { status } = await pedir(rutas[lang]);
    // Los tres casos no existen todavía: son de la Fase 3.
    const esCaso = rutas[lang].includes("/casos/") || rutas[lang].includes("/cases/");
    if (status === 200) continue;
    if (esCaso && status === 404) {
      console.log(`  · ${rutas[lang]} 404 (página de la Fase 3, esperado)`);
      continue;
    }
    mal(`${rutas[lang]} devuelve ${status}`);
  }
}

console.log("\n─── URLs antiguas: 301 a su equivalente");
for (const { de, a } of RENOMBRADAS) {
  const { status, destino } = await pedir(de);
  if (status !== 301) mal(`${de} devuelve ${status}, no 301`);
  else if (!destino?.endsWith(a)) mal(`${de} redirige a ${destino}, esperaba ${a}`);
  else console.log(`  ${de.padEnd(16)} 301 → ${a}`);
}

console.log("\n─── Guardas de idioma: 301 sin contenido duplicado");
const guardas = guardasDeIdioma();
let guardasOk = 0;
for (const { de, a } of guardas) {
  const { status, destino } = await pedir(de);
  if (status !== 301) mal(`${de} devuelve ${status}, no 301`);
  else if (!destino?.endsWith(a)) mal(`${de} redirige a ${destino}, esperaba ${a}`);
  else guardasOk += 1;
}
console.log(`  ${guardasOk} de ${guardas.length} guardas correctas`);

console.log("\n─── El sitemap antiguo: nada muerto");
const VIEJAS = [
  "/es", "/en",
  "/es/about", "/en/about",
  "/es/projects", "/en/projects",
  "/es/contact", "/en/contact",
  "/es/diagnostic", "/en/diagnostic",
  "/es/blog", "/en/blog",
  "/es/careers", "/en/careers",
  "/es/privacy", "/es/terms", "/es/cookies",
  "/legal", "/es/legal", "/en/legal",
];
for (const ruta of VIEJAS) {
  const { status, destino } = await pedir(ruta);
  if (status === 200) { console.log(`  ${ruta.padEnd(16)} 200`); continue; }
  if (status === 301 && destino) {
    const segundo = await pedir(rutaDe(destino));
    if (segundo.status === 200) console.log(`  ${ruta.padEnd(16)} 301 → ${rutaDe(destino)} → 200`);
    else mal(`${ruta} 301 → ${destino} → ${segundo.status}`);
    continue;
  }
  mal(`${ruta} devuelve ${status}`);
}

console.log("\n─── El sitemap nuevo no anuncia 404");
const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const noArticulos = locs.filter((l) => !l.includes("/blog/"));
console.log(`  ${locs.length} URLs en total, ${noArticulos.length} de página`);
for (const loc of noArticulos) {
  const { status } = await pedir(rutaDe(loc));
  if (status !== 200) mal(`el sitemap anuncia ${rutaDe(loc)}, que devuelve ${status}`);
}

console.log(fallos ? `\n${fallos} fallos` : "\nsin fallos");
process.exitCode = fallos ? 1 : 0;
