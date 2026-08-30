# Consolidación del blog — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que 34 artículos cortos que se canibalizan entre sí dejen de competir, redirigiendo cada uno al artículo que mejor cubre su tema.

**Architecture:** No hace falta código nuevo de infraestructura. El proyecto ya tiene `PostRedirect` y la ruta del blog ya lo consulta antes de buscar el post. Esto es una migración de datos: insertar 68 filas de redirección, despublicar 34 artículos y reapuntar 32 enlaces internos. Todo con un script de un solo uso que se valida contra la base antes de escribir nada y que se borra al terminar.

**Tech Stack:** Prisma 6 + PostgreSQL, Node con `--env-file`.

**Spec:** `docs/superpowers/specs/2026-08-30-consolidacion-blog-design.md`

---

## Contexto que el implementador necesita

**Esto escribe en la base de datos de producción.** `.env.local` apunta a producción y no hay entorno de pruebas. Por eso el script es de dos fases: una que enseña lo que haría y otra que lo hace, y no se ejecuta la segunda sin leer la primera.

**El mecanismo de redirección ya existe y está verificado.** En `app/[lang]/blog/[slug]/page.js`, la función `maybeRedirect` consulta `PostRedirect` por `fromSlug_lang` y lanza `permanentRedirect`, que emite un **308**. Se ejecuta **antes** de buscar el post, así que un artículo despublicado con redirección redirige en vez de dar 404. Google trata el 308 igual que el 301 para canonicalización.

**La ruta del post no es estática.** No tiene `generateStaticParams` ni `revalidate`, así que se renderiza en cada petición y los cambios surten efecto al instante. El sitemap (`app/sitemap.js`) sí tiene `revalidate = 3600`: tarda hasta una hora en reflejar los cambios.

**Orden de operaciones, y por qué importa.** Primero las redirecciones, después despublicar. Si algo falla en medio, quedan redirecciones apuntando a artículos aún publicados — inofensivo, porque el chequeo de redirección va primero y gana. Al revés quedarían 404.

**Comandos.** Todo desde `my-app/`. Scripts: `node --env-file=.env.local scripts/<nombre>.mjs`. Tests: `npx vitest run`.

---

## Estructura de ficheros

| Fichero | Responsabilidad | Acción |
|---|---|---|
| `scripts/consolidar-blog.mjs` | El mapa, su validación y la aplicación | Crear, y **borrar** en la Task 7 |
| `docs/superpowers/specs/2026-08-30-consolidacion-blog-design.md` | El registro permanente de qué se fusionó y por qué | Ya existe, no se toca |

Nada de código de aplicación cambia. El mapa vive en el script y no en `app/lib/` a propósito: cuando termine no lo consume nadie, y un módulo que nadie importa es código muerto. El registro de lo hecho es la spec.

---

## Task 1: Verificar el mecanismo contra producción

Antes de crear ni una redirección hay que comprobar que las que ya existen funcionan de verdad. Si no lo hicieran, despublicar 34 artículos produciría 34 páginas 404 — exactamente el daño que esto quiere evitar.

**Files:** ninguno

- [ ] **Step 1: Elegir una redirección existente y probarla en vivo**

Hay 59 filas en `PostRedirect`. Saca una con destino:

Run:
```bash
node --env-file=.env.local -e "
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  const r = await p.postRedirect.findFirst({ where:{ lang:'es', toSlug:{not:null}, reason:'consolidation' } });
  console.log('probar: https://www.room714.com/es/blog/'+r.fromSlug);
  console.log('debe acabar en: /es/blog/'+r.toSlug);
  await p.\$disconnect();
})();"
```

- [ ] **Step 2: Comprobar que responde 308 y a dónde**

Con la URL del paso anterior:

Run: `curl -s -o /dev/null -w "%{http_code} → %{redirect_url}\n" "<la URL de origen>"`

Expected: `308 → https://www.room714.com/es/blog/<el toSlug>`

Si sale **200**, el mecanismo no está enganchado y **hay que parar el plan entero**: el problema es otro y esta consolidación haría daño. Si sale **404**, la fila existe pero el destino no: investígalo antes de seguir.

- [ ] **Step 3: Comprobar que el destino responde 200**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "https://www.room714.com/es/blog/<el toSlug>"`

Expected: `200`

- [ ] **Step 4: Dejar constancia**

No hay commit en esta tarea. Anota en tu informe los tres códigos obtenidos: son la prueba de que el resto del plan se apoya en algo que funciona.

---

## Task 2: El script, con el mapa y su validación

**Files:**
- Create: `scripts/consolidar-blog.mjs`

- [ ] **Step 1: Escribir el script**

```javascript
// Consolidación del blog: 34 artículos cortos que se canibalizan entre sí
// redirigen al artículo que mejor cubre su tema.
//
// Script de un solo uso. Se borra al terminar: el registro permanente de qué se
// fusionó y por qué es la spec, en
// docs/superpowers/specs/2026-08-30-consolidacion-blog-design.md
//
// Dos fases. Sin argumentos hace una simulación y no escribe nada; con
// --aplicar escribe. La simulación no es una cortesía: es el único sitio donde
// se ve, antes de tocar producción, que los 52 slugs existen y que ningún
// origen es destino de otro.
//
//   node --env-file=.env.local scripts/consolidar-blog.mjs
//   node --env-file=.env.local scripts/consolidar-blog.mjs --aplicar
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--aplicar");

// El mapa, en slugs españoles. Las contrapartidas inglesas se resuelven solas a
// través del Post, que es el que une las dos traducciones: escribirlas a mano
// sería una segunda lista que mantener sincronizada y una segunda oportunidad
// de equivocarse.
const MAPA = [
  // Grupos con un artículo largo que ya cubre el tema
  ["codigo-barato-ingenieria-cara-ia-deuda-tecnica", [
    "ingenieria-de-precision-no-fabricas-de-codigo",
    "tu-codigo-es-un-activo-o-una-deuda-pendiente",
  ]],
  ["seguridad-arquitecturas-ia-el-agujero-que-nadie-audita", [
    "product-led-governance-la-seguridad-como-feature-no-como-freno",
    "seguridad-en-ia-el-neutron-que-tumba-la-muralla",
  ]],
  ["rag-no-es-magia-como-elegir-arquitectura-de-recuperacion", [
    "data-flywheels-el-motor-secreto-de-la-ia",
    "graphrag-de-la-busqueda-de-textos-a-la-comprension-de-relaciones",
    "el-modelo-canonico-que-no-alucine-tu-ia",
  ]],
  ["accesibilidad-no-es-una-feature-es-infraestructura", [
    "accesibilidad-el-requisito-que-nadie-pone-en-el-roadmap",
  ]],

  // Grupos huérfanos: gana el mejor del grupo
  ["la-friccion-es-un-impuesto-al-beneficio", [
    "aplicando-el-factor-sentidino",
    "menos-manuales-mas-sentido-comun",
    "tu-software-es-una-ayuda-o-un-obstaculo-diario",
  ]],
  ["el-equilibrio-vital-entre-estetica-y-usabilidad", [
    "si-no-vende-no-es-diseno-es-decoracion",
    "estetica-que-factura",
    "tu-interfaz-esta-devaluando-tu-servicio",
  ]],
  ["local-first-la-arquitectura-que-le-devuelve-el-control-a-tu-producto", [
    "invertir-en-un-mundo-que-caduca-cada-martes",
    "el-efecto-google-por-que-tu-ram-ahora-vale-el-doble",
    "tu-equipo-de-desarrollo-necesita-una-ia-local",
    "el-retorno-del-hierro-la-resurreccion-del-co-location",
    "eficiencia-sobre-gigantismo-por-que-el-futuro-de-tu-empresa-es-small",
  ]],
  ["ui-generativa-cuando-la-interfaz-deja-de-ser-un-plano", [
    "interfaces-que-piensan-en-voz-alta-el-reto-de-disenar-para-agentes-de-ia",
    "diseno-en-streaming-cuando-la-interfaz-tiene-que-pensar-y-moverse-a-la-vez",
  ]],
  ["anticipatory-ux-eliminando-la-carga-de-decision", [
    "ni-codigo-ni-diseno-el-producto-es-anticipacion",
    "la-mejor-interfaz-es-la-que-no-existe-el-paso-hacia-la-invisible-ui",
  ]],
  ["el-sindrome-de-la-herramienta-nueva-probar-todo-te-impide-construir", [
    "shadow-it-y-el-renacimiento-del-cpo",
    "el-fin-de-la-ia-por-decreto",
  ]],
  ["construir-antes-de-validar-el-error-de-producto-que-destruye-startups", [
    "volviendo-a-las-bases-el-ceo-del-producto",
    "el-minimum-lovable-product-mlp",
  ]],
  ["la-ia-no-se-cansa-en-el-kilometro-42", ["la-ia-no-tiene-nervios"]],
  ["de-programadores-de-sintaxis-a-ingenieros-de-flujos", ["el-colapso-de-la-factoria"]],
  ["unbundling-el-poder-de-la-especializacion", ["ia-unbundling-microservicios-de-proposito-unico"]],
  ["estas-sentado-en-una-mina-de-oro", ["el-techo-de-cristal-de-tu-escalabilidad"]],
  ["el-clasismo-del-software-el-cliente-gana-al-empleado", ["el-asesino-silencioso-de-la-productividad"]],
  ["el-prototipo-que-miente-por-que-tus-tests-de-usabilidad-estan-contaminados", ["la-cura-contra-el-ego-del-disenador"]],
  ["disenadores-en-la-era-de-la-ia-el-juicio-no-se-automatiza", ["ux-2026-del-hacer-pantallas-al-decidir-experiencias"]],
];

// ─── Validación ─────────────────────────────────────────────────────────────
// Se ejecuta siempre, también en simulación, y aborta si algo no cuadra. Es
// preferible no hacer nada a hacer la mitad.

function validarMapa() {
  const problemas = [];
  const destinos = MAPA.map(([d]) => d);
  const origenes = MAPA.flatMap(([, o]) => o);

  // Un origen que además es destino crearía una cadena de redirecciones, y
  // Google deja de seguirlas a partir de unos pocos saltos.
  const cadenas = origenes.filter((o) => destinos.includes(o));
  if (cadenas.length) problemas.push(`encadenamiento: ${cadenas.join(", ")}`);

  // Un origen repetido en dos grupos dejaría la última escritura ganando en
  // silencio, y el artículo acabaría redirigiendo a donde no toca.
  const repetidos = origenes.filter((o, i) => origenes.indexOf(o) !== i);
  if (repetidos.length) problemas.push(`origen repetido: ${[...new Set(repetidos)].join(", ")}`);

  const destRepes = destinos.filter((d, i) => destinos.indexOf(d) !== i);
  if (destRepes.length) problemas.push(`destino repetido: ${[...new Set(destRepes)].join(", ")}`);

  return problemas;
}

async function resolver(slug) {
  return prisma.postTranslation.findUnique({
    where: { slug },
    include: { post: { include: { translations: true } } },
  });
}

async function main() {
  const problemas = validarMapa();
  if (problemas.length) {
    console.error("❌ El mapa no es válido, no se toca nada:");
    for (const p of problemas) console.error("   " + p);
    process.exit(1);
  }

  console.log(APLICAR ? "=== APLICANDO ===" : "=== SIMULACIÓN (no escribe nada) ===");
  console.log();

  const filas = [];
  let faltan = 0;

  for (const [destinoSlug, origenesSlugs] of MAPA) {
    const destino = await resolver(destinoSlug);
    if (!destino) {
      console.error(`❌ destino inexistente: ${destinoSlug}`);
      faltan++;
      continue;
    }
    const destinoEn = destino.post.translations.find((t) => t.lang === "en");
    if (!destinoEn) {
      console.error(`❌ el destino ${destinoSlug} no tiene traducción inglesa`);
      faltan++;
      continue;
    }

    console.log(`→ ${destinoSlug}`);
    for (const oSlug of origenesSlugs) {
      const origen = await resolver(oSlug);
      if (!origen) {
        console.error(`   ❌ origen inexistente: ${oSlug}`);
        faltan++;
        continue;
      }
      const origenEn = origen.post.translations.find((t) => t.lang === "en");
      if (!origenEn) {
        console.error(`   ❌ el origen ${oSlug} no tiene traducción inglesa`);
        faltan++;
        continue;
      }
      console.log(`   ← ${oSlug}`);
      console.log(`     en: ${origenEn.slug} → ${destinoEn.slug}`);
      filas.push(
        { fromSlug: origen.slug, toSlug: destino.slug, lang: "es", postId: origen.postId },
        { fromSlug: origenEn.slug, toSlug: destinoEn.slug, lang: "en", postId: origen.postId },
      );
    }
  }

  if (faltan) {
    console.error(`\n❌ ${faltan} slugs no resueltos. No se escribe nada.`);
    process.exit(1);
  }

  const postsADespublicar = [...new Set(filas.map((f) => f.postId))];

  console.log(`\n=== RESUMEN ===`);
  console.log(`redirecciones a crear: ${filas.length} (${filas.length / 2} por idioma)`);
  console.log(`artículos a despublicar: ${postsADespublicar.length}`);

  if (!APLICAR) {
    console.log("\nSimulación terminada. Nada escrito.");
    console.log("Para aplicar: node --env-file=.env.local scripts/consolidar-blog.mjs --aplicar");
    return;
  }

  // Primero las redirecciones y después despublicar, no al revés: si algo falla
  // en medio, queda una redirección sobre un artículo aún publicado, que es
  // inofensivo porque el chequeo de redirección corre antes de buscar el post.
  // Al revés quedarían 404.
  let creadas = 0;
  for (const f of filas) {
    await prisma.postRedirect.upsert({
      where: { fromSlug_lang: { fromSlug: f.fromSlug, lang: f.lang } },
      update: { toSlug: f.toSlug, reason: "consolidation" },
      create: { fromSlug: f.fromSlug, toSlug: f.toSlug, lang: f.lang, reason: "consolidation" },
    });
    creadas++;
  }
  console.log(`redirecciones escritas: ${creadas}`);

  const desp = await prisma.post.updateMany({
    where: { id: { in: postsADespublicar } },
    data: { published: false },
  });
  console.log(`artículos despublicados: ${desp.count}`);
}

await main();
await prisma.$disconnect();
```

Fíjate en el `upsert`: hace el script **idempotente**. Volver a ejecutarlo no duplica nada ni rompe el `@@unique([fromSlug, lang])`, solo reescribe las mismas filas con los mismos valores.

- [ ] **Step 2: Comprobar que el script no tiene errores de sintaxis**

Run: `npx eslint scripts/consolidar-blog.mjs`
Expected: limpio. Si `eslint` no cubre `scripts/`, basta con `node --check scripts/consolidar-blog.mjs`.

- [ ] **Step 3: Commit**

```bash
git add scripts/consolidar-blog.mjs
git commit -m "feat(seo): script de consolidacion del blog, con simulacion por defecto"
```

---

## Task 3: La simulación

**Files:** ninguno

- [ ] **Step 1: Ejecutar sin `--aplicar`**

Run: `node --env-file=.env.local scripts/consolidar-blog.mjs`

Expected, al final:
```
=== RESUMEN ===
redirecciones a crear: 68 (34 por idioma)
artículos a despublicar: 34

Simulación terminada. Nada escrito.
```

**Si algún número difiere de 68 y 34, para y dilo.** El mapa se verificó contra producción el 2026-08-30; una diferencia significa que la base ha cambiado desde entonces y hay que entender por qué antes de escribir.

- [ ] **Step 2: Revisar los pares en inglés**

La salida imprime cada par `en: origen → destino`. Recórrelos y comprueba que ningún destino inglés aparece también como origen inglés — la validación cubre el español, pero los slugs ingleses se derivan y merecen una mirada.

Si ves alguno, **para**: sería una cadena de redirección en inglés que la validación del mapa no puede ver.

- [ ] **Step 3: Comprobar que la base sigue intacta**

Run:
```bash
node --env-file=.env.local -e "
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  console.log('publicados:', await p.post.count({where:{published:true}}));
  console.log('redirecciones:', await p.postRedirect.count());
  await p.\$disconnect();
})();"
```

Expected: `publicados: 98` y `redirecciones: 59`. La simulación no debe haber cambiado nada.

- [ ] **Step 4: Cruzar con Search Console, si la API ya funciona**

La spec asume el riesgo de consolidar sin datos de rendimiento, pero deja apuntada esta mitigación por si la API está operativa cuando se ejecute el plan. Compruébalo:

```bash
node --env-file=.env.local -e "
import('./app/lib/seo/googleAuth.js').then(async ({getAccessToken}) => {
  const t = await getAccessToken('https://www.googleapis.com/auth/webmasters.readonly');
  const r = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', { headers: { Authorization: 'Bearer ' + t } });
  console.log('Search Console API:', r.status === 200 ? 'operativa' : 'no disponible (' + r.status + ')');
});"
```

**Si dice «no disponible», sáltate este paso y sigue**: es la situación que la spec ya asumió.

**Si dice «operativa»**, pide las impresiones por URL de los últimos 90 días y cruza con los 34 orígenes:

```bash
node --env-file=.env.local -e "
import('./app/lib/seo/googleAuth.js').then(async ({getAccessToken}) => {
  const t = await getAccessToken('https://www.googleapis.com/auth/webmasters.readonly');
  const hasta = new Date().toISOString().slice(0,10);
  const desde = new Date(Date.now()-90*864e5).toISOString().slice(0,10);
  const r = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aroom714.com/searchAnalytics/query', {
    method:'POST',
    headers:{ Authorization:'Bearer '+t, 'Content-Type':'application/json' },
    body: JSON.stringify({ startDate: desde, endDate: hasta, dimensions:['page'], rowLimit: 500 }),
  });
  const j = await r.json();
  const filas = (j.rows||[]).filter(x => x.clicks > 0);
  console.log('URLs con al menos un clic en 90 días:', filas.length);
  filas.sort((a,b)=>b.clicks-a.clicks).slice(0,30).forEach(x=>console.log('  '+x.clicks+' clics · '+x.impressions+' impr · '+x.keys[0]));
});"
```

Compara esa lista con los 34 orígenes del mapa. **Si alguno aparece con clics, sácalo del mapa y dilo**: consolidar un artículo que recibe visitas es justo el error que esta comprobación evita, y el coste de dejarlo fuera es cero.

---

## Task 4: Aplicar

Este es el paso irreversible sobre producción. **No lo ejecutes sin haber leído la salida de la Task 3.**

**Files:** ninguno

- [ ] **Step 1: Copia de seguridad de lo que se va a tocar**

Crear `scripts/backup-consolidacion.mjs`:

```javascript
// Vuelca las traducciones y el estado de publicación antes de consolidar. Los
// artículos se despublican, no se borran, así que esto es un cinturón sobre
// tirantes — pero cuesta un minuto y cubre el caso de un error en el mapa.
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const datos = {
  exportadoEn: new Date().toISOString(),
  posts: await prisma.post.findMany({ select: { id: true, published: true, date: true } }),
  translations: await prisma.postTranslation.findMany({
    select: { id: true, postId: true, lang: true, slug: true, content: true },
  }),
  redirects: await prisma.postRedirect.findMany(),
};

const destino = `backup-consolidacion-${datos.exportadoEn.slice(0, 10)}.json`;
writeFileSync(destino, JSON.stringify(datos));
console.log(
  `${destino}: ${datos.posts.length} posts, ${datos.translations.length} traducciones, ${datos.redirects.length} redirecciones`,
);

await prisma.$disconnect();
```

Añade `backup-consolidacion-*.json` a `.gitignore` **antes** de generarlo.

Run: `node --env-file=.env.local scripts/backup-consolidacion.mjs`

Expected: `98 posts, 196 traducciones, 59 redirecciones`.

- [ ] **Step 2: Aplicar**

Run: `node --env-file=.env.local scripts/consolidar-blog.mjs --aplicar`

Expected:
```
redirecciones escritas: 68
artículos despublicados: 34
```

- [ ] **Step 3: Comprobar el estado resultante**

Run:
```bash
node --env-file=.env.local -e "
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  console.log('publicados:', await p.post.count({where:{published:true}}));
  console.log('despublicados:', await p.post.count({where:{published:false}}));
  console.log('redirecciones:', await p.postRedirect.count());
  const r = await p.postRedirect.groupBy({by:['reason'],_count:true});
  console.log('por motivo:', JSON.stringify(r));
  await p.\$disconnect();
})();"
```

Expected: `publicados: 64`, `despublicados: 34`, `redirecciones: 127` (59 + 68), y `consolidation` con 124.

- [ ] **Step 4: Probar tres redirecciones en vivo**

Espera un minuto a que Vercel sirva el estado nuevo y prueba tres orígenes de grupos distintos:

```bash
for s in aplicando-el-factor-sentidino la-ia-no-tiene-nervios seguridad-en-ia-el-neutron-que-tumba-la-muralla; do
  curl -s -o /dev/null -w "$s → %{http_code} %{redirect_url}\n" "https://www.room714.com/es/blog/$s"
done
```

Expected: los tres con `308` y la URL de su destino.

Si alguno da **404**, la redirección no se escribió: mira si su fila existe en `PostRedirect` y por qué falta.

- [ ] **Step 5: Commit del registro**

```bash
git add .gitignore scripts/backup-consolidacion.mjs
git commit -m "chore(seo): copia de seguridad previa a la consolidacion"
```

---

## Task 5: Reapuntar los enlaces internos

Hay 32 enlaces internos en español, repartidos en 25 artículos, que apuntan a slugs que ahora redirigen. Funcionan —el 308 no rompe nada— pero cada uno es un salto innecesario, y un enlace interno hacia una página despublicada es una señal pobre.

Los textos de esos enlaces son frases temáticas («seguridad en sistemas de IA», «gestión de producto»), no títulos de artículo, así que reapuntarlos al destino no deja anclas que mientan. Se comprobó muestreando doce.

**Files:**
- Create: `scripts/reapuntar-enlaces.mjs`

- [ ] **Step 1: Escribir el script**

```javascript
// Reapunta los enlaces internos que quedaron señalando a artículos
// consolidados. Lee el mapa desde PostRedirect, así que no duplica la lista y
// no puede desincronizarse del paso anterior.
//
// Sin argumentos simula; con --aplicar escribe.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--aplicar");

// Solo las de esta consolidación: las 59 anteriores ya se aplicaron en su
// momento y sus enlaces ya se reapuntaron o se dejaron a propósito.
const DESDE = new Date("2026-08-30T00:00:00Z");

const redirs = await prisma.postRedirect.findMany({
  where: { reason: "consolidation", createdAt: { gte: DESDE }, toSlug: { not: null } },
});
console.log(`redirecciones a aplicar sobre el contenido: ${redirs.length}`);

const traducciones = await prisma.postTranslation.findMany({
  select: { id: true, lang: true, slug: true, content: true },
});

let tocados = 0;
let enlaces = 0;

for (const t of traducciones) {
  let nuevo = t.content;
  for (const r of redirs) {
    if (r.lang !== t.lang) continue;
    // Se ancla a la comilla final para no cazar un slug que sea prefijo de otro.
    const patron = `/${r.lang}/blog/${r.fromSlug}"`;
    if (!nuevo.includes(patron)) continue;
    const cuantos = nuevo.split(patron).length - 1;
    nuevo = nuevo.split(patron).join(`/${r.lang}/blog/${r.toSlug}"`);
    enlaces += cuantos;
  }
  if (nuevo === t.content) continue;
  tocados++;
  console.log(`  ${t.lang} ${t.slug}`);
  if (APLICAR) {
    await prisma.postTranslation.update({ where: { id: t.id }, data: { content: nuevo } });
  }
}

console.log(`\ntraducciones con enlaces reapuntados: ${tocados}`);
console.log(`enlaces reapuntados: ${enlaces}`);
console.log(APLICAR ? "aplicado" : "simulación: nada escrito");

await prisma.$disconnect();
```

- [ ] **Step 2: Simular**

Run: `node --env-file=.env.local scripts/reapuntar-enlaces.mjs`

Expected: `redirecciones a aplicar sobre el contenido: 68`, y un recuento de enlaces reapuntados. En español se midieron **32 en 25 artículos**; con el inglés incluido el total será mayor. Anota los números.

**Si sale 0 enlaces**, algo falla: comprueba que el patrón de búsqueda coincide con el formato real de los enlaces en el contenido, que es `<a href="/es/blog/SLUG">texto</a>`.

- [ ] **Step 3: Aplicar**

Run: `node --env-file=.env.local scripts/reapuntar-enlaces.mjs --aplicar`

- [ ] **Step 4: Comprobar que no queda ninguno apuntando a un origen**

Run: `node --env-file=.env.local scripts/reapuntar-enlaces.mjs`

Expected: `enlaces reapuntados: 0` y `traducciones con enlaces reapuntados: 0`. La segunda simulación debe salir vacía, que es la prueba de que la primera aplicación fue completa.

- [ ] **Step 5: Commit**

```bash
git add scripts/reapuntar-enlaces.mjs
git commit -m "feat(seo): reapunta los enlaces internos a los articulos consolidados"
```

---

## Task 6: Verificar el resultado en la web

**Files:** ninguno

- [ ] **Step 1: El sitemap encoge**

El sitemap tiene `revalidate = 3600`, así que puede tardar hasta una hora. Cuando pase:

Run: `curl -s https://www.room714.com/sitemap.xml | grep -c "<loc>"`

Expected: **150**. Eran 218 y desaparecen 34 artículos × 2 idiomas = 68.

Si sigue en 218, la caché no ha expirado todavía: no es un fallo, espera.

- [ ] **Step 2: El hub del blog no enlaza a los despublicados**

Run:
```bash
curl -s https://www.room714.com/es/blog | grep -o "/es/blog/aplicando-el-factor-sentidino" | wc -l
```

Expected: `0`.

- [ ] **Step 3: Los destinos siguen vivos**

```bash
for s in la-friccion-es-un-impuesto-al-beneficio local-first-la-arquitectura-que-le-devuelve-el-control-a-tu-producto ui-generativa-cuando-la-interfaz-deja-de-ser-un-plano; do
  curl -s -o /dev/null -w "$s → %{http_code}\n" "https://www.room714.com/es/blog/$s"
done
```

Expected: los tres `200`.

- [ ] **Step 4: Avisar a Google de los destinos**

El proyecto tiene la Indexing API montada (`app/lib/seo/indexingApi.js`). Notificar los 18 destinos acelera que Google reprocese la consolidación:

```javascript
// scripts/avisar-destinos.mjs
//
// Ojo con lo que NO se importa: `app/lib/seo/indexingApi.js` haría exactamente
// esto, pero importa `./googleAuth` sin extensión, y Node en ESM exige la
// extensión en los imports relativos — eso lo resuelven Next y vitest, no
// `node` a secas. Así que se importa `googleAuth.js` (que solo importa
// `crypto`, un builtin, y sí carga bien) y se llama al endpoint a mano.
import { PrismaClient } from "@prisma/client";
import { getAccessToken } from "../app/lib/seo/googleAuth.js";

const ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish";
const SCOPE = "https://www.googleapis.com/auth/indexing";

const prisma = new PrismaClient();
const DESDE = new Date("2026-08-30T00:00:00Z");

const redirs = await prisma.postRedirect.findMany({
  where: { reason: "consolidation", createdAt: { gte: DESDE }, toSlug: { not: null } },
  select: { toSlug: true, lang: true },
});

const urls = [...new Set(redirs.map((r) => `https://www.room714.com/${r.lang}/blog/${r.toSlug}`))];
console.log(`destinos únicos a notificar: ${urls.length}`);

const token = await getAccessToken(SCOPE);

for (const url of urls) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, type: "URL_UPDATED" }),
  });
  console.log(`  ${res.ok ? "ok " : "ERR"} ${res.status} ${url}`);
  if (!res.ok) console.log("      " + (await res.text()).slice(0, 150));
}

await prisma.$disconnect();
```

La Indexing API tiene cuota diaria (200 peticiones al día en el plan por defecto). 36 URLs caben de sobra.

Run: `node --env-file=.env.local scripts/avisar-destinos.mjs`

Expected: 36 URLs (18 destinos × 2 idiomas), todas `ok`.

No se notifican los orígenes: la Indexing API es para contenido vivo, y avisar de una URL que redirige no aporta nada.

---

## Task 7: Limpieza

**Files:**
- Delete: `scripts/consolidar-blog.mjs`, `scripts/reapuntar-enlaces.mjs`, `scripts/avisar-destinos.mjs`

- [ ] **Step 1: Borrar los tres scripts de un solo uso**

```bash
git rm scripts/consolidar-blog.mjs scripts/reapuntar-enlaces.mjs scripts/avisar-destinos.mjs
```

Se borran a propósito. Un script de migración que se queda en el repositorio acaba ejecutándose otra vez, y este despublicaría artículos y reescribiría contenido. El registro permanente de qué se hizo es la spec.

Deja `scripts/backup-consolidacion.mjs`: es de solo lectura y sirve para la próxima vez.

- [ ] **Step 2: Comprobar que la suite y el build siguen bien**

Run: `npx vitest run`
Expected: verde. Este plan no toca código de aplicación, así que no debería cambiar nada.

Run: `npx next build`
Expected: correcto.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(seo): retira los scripts de un solo uso de la consolidacion"
```

Antes del `add -A`, `git status --short`: si aparece algún `backup-consolidacion-*.json`, **no debe entrar** — está en `.gitignore` y lleva el contenido completo del blog.

---

## Qué mirar en los días siguientes

No forma parte del plan, pero es lo que dirá si esto ha servido:

- **Search Console → Indexación de páginas.** «Rastreada: actualmente sin indexar» debería bajar de 18, y las 2 «duplicadas sin canónica» deberían cerrarse: una de ellas es exactamente uno de los artículos que este plan consolida.
- **Las 35 «Página con redirección» subirán a unas 69.** Es lo esperado y no es un problema: son redirecciones deliberadas.
- **Las 114 «Descubierta sin indexar» no cambiarán mucho**, porque son las páginas en inglés y su causa es otra.

## Fuera de alcance

- Las dos parejas de artículos **largos** que también se solapan (accesibilidad de julio y agosto; piloto de IA de junio y julio). Se decide con datos de Search Console, no aquí.
- Los 28 cortos restantes sin grupo.
- Editar el contenido de ningún artículo, más allá de reapuntar los `href` de los enlaces internos.
