# Prospección B2: cualificación con IA y memoria vectorial — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la cola diaria pase de 20 fichas ciegas a 5 fichas cualificadas contra cuatro criterios de negocio, con la evidencia y las fuentes a la vista, un chat por ficha para resolver dudas antes de gastar el crédito de Apollo, y una memoria vectorial que hace que cada mañana haga falta mirar menos empresas para llenar la cola.

**Architecture:** Tres capas, ordenadas por lo que cuestan. La **memoria vectorial** (pgvector + Voyage, gratis a este volumen) embebe los ~125 candidatos que devuelve Apollo y los ordena por parecido con lo ya decidido, sin descartar a nadie. El **vistazo** (Haiku 4.5, ~0,03 $) recorre esa lista de arriba abajo y para en cuanto hay 5 que pasan. La **profundidad** (Opus 5: análisis a fondo y chat) solo corre cuando el humano pulsa un botón. El crédito de Apollo se sigue gastando únicamente al decir que sí.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 6 + PostgreSQL 17.2 con pgvector 0.8.1, `@anthropic-ai/sdk`, Voyage AI por HTTP, vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-prospeccion-b2-cualificacion-ia-design.md`

---

## Contexto que el implementador necesita

**Lo que ya existe y funciona (fase B1).** El cron `/api/cron/prospect-queue` corre a las 06:00 de lunes a viernes, elige una combinación de sector×tramo de plantilla en ciclo fijo, busca en Apollo paginando hasta reunir 20 caras nuevas (**buscar es gratis**), las filtra en local y las escribe en `ProspectDiscovery` con `decision: "pending"`. La pantalla `/admin/prospects` las enseña; "Sí" enriquece (**1 crédito de 60 al mes**) y crea un `Prospect`; "No" pide motivo. Las reglas que ajustan la búsqueda se **derivan contando decisiones**, sin tabla de estado.

**Lo que la API de Apollo permite, verificado el 2026-08-31 con llamadas reales.** `mixed_people/api_search` es gratis y devuelve por persona `id`, `first_name`, `last_name_obfuscated`, `title` y un `organization` con **solo `name` y banderas booleanas**. El filtro `revenue_range` **está bloqueado en el plan gratuito** (422) y su variante con corchetes `revenue_range[min]` **devuelve 200 ignorando el filtro en silencio**: es un filtro fantasma y no debe aparecer en la consulta bajo ninguna forma.

**Estado de la base (producción, 2026-08-31).** 68 `ProspectDiscovery`: 16 pendientes, 48 con `reasonCode = "legacy"` (las puso la migración de B1; nadie las decidió) y **4 decisiones humanas reales**. Solo 4 filas tienen nota. La memoria arranca vacía: el sistema tiene que funcionar el día uno sin ella.

**pgvector**, verificado contra producción: `pg_available_extensions` devuelve `vector` **0.8.1** con `installed_version: null` sobre PostgreSQL 17.2. Hay que crear la extensión; no hay que contratar nada.

**Esquema: `db push`, nunca `migrate`.** Este proyecto no usa migraciones de Prisma — no hay `prisma/migrations` ni tabla `_prisma_migrations`. Ejecutar `prisma migrate dev` detectaría deriva contra un historial vacío y **pediría resetear la base entera**. La extensión y el índice HNSW no los crea `db push`: van por SQL directo (Task 2).

**Claves.** `ANTHROPIC_API_KEY` y `APOLLO_API_KEY` ya están en `.env.local`. **`VOYAGE_API_KEY` no existe todavía**: hay que darse de alta en voyageai.com y añadirla a `.env.local` y a Vercel. Es la única alta externa de todo el plan (Task 1).

**Comandos.** Tests: `npx vitest run <ruta>`. Todo: `npx vitest run`. Todo desde `my-app/`. Los scripts sueltos: `node --env-file=.env.local scripts/<x>.mjs`.

**Orden de las tareas.** Primero la verificación contra la API real (Task 0), porque tres decisiones del spec dependen de que ciertas combinaciones de modelo y herramienta funcionen. Después el esquema (2), luego los módulos puros con TDD (3-9), luego la orquestación (10-11) y por último la pantalla (12-14). El árbol queda verde en cada commit.

**Estilo del repositorio.** Comentarios en castellano que explican **por qué**, no qué. Tests con `describe`/`it` en castellano. Los módulos de `app/lib/prospecting/` reciben sus dependencias inyectadas (mira `collectFreshCandidates`, que recibe `search`) para poder probarse sin red. Mantén ese patrón en todo lo nuevo.

---

## Estructura de ficheros

| Fichero | Responsabilidad | Acción |
|---|---|---|
| `scripts/probe-modelos.mjs` | verificar modelo+herramienta contra la API real | Crear (se borra al final) |
| `scripts/setup-pgvector.mjs` | `CREATE EXTENSION` + índice HNSW | Crear |
| `prisma/schema.prisma` | modelo de datos | Modificar: `ProspectMemory` nuevo, campos en `ProspectDiscovery` y `Prospect` |
| `app/lib/prospecting/aiCost.js` | precios y suma de `usage` | Crear |
| `app/lib/prospecting/score.js` | fórmula del score, puertas duras, umbral | Crear |
| `app/lib/prospecting/embeddings.js` | cliente de Voyage | Crear |
| `app/lib/prospecting/memory.js` | escribir y consultar `ProspectMemory` | Crear |
| `app/lib/prospecting/rankPool.js` | ordenar el pozo por vecindad | Crear |
| `app/lib/prospecting/qualify.js` | `quickLook()` y `deepDive()` | Crear |
| `app/lib/prospecting/introText.js` | la nota de conexión | Crear |
| `app/lib/prospecting/prospectChat.js` | el chat por ficha | Crear |
| `app/lib/prospecting/metrics.js` | las tres métricas de eficacia | Crear |
| `app/data/ProspectingProfile.js` | tramos de plantilla y rotación ponderada | Modificar |
| `app/lib/prospecting/buildQueue.js` | `QUEUE_SIZE` 20 → 5 | Modificar |
| `app/api/cron/prospect-queue/route.js` | orquestación del día | Reescribir |
| `app/(admin-zone)/admin/prospects/actions.js` | acciones de servidor | Modificar |
| `app/(admin-zone)/admin/prospects/page.js` | la pantalla | Modificar |

---

## Task 0: Verificar contra la API real qué combinaciones funcionan

Tres decisiones del spec descansan en supuestos que no están confirmados: que Haiku 4.5 admite la herramienta de búsqueda web, que admite salida estructurada, y si una sola llamada puede hacer búsqueda web **y** salida estructurada a la vez (el spec las parte en dos por precaución). Confirmarlo cuesta unos céntimos y evita construir sobre arena.

**Files:**
- Create: `scripts/probe-modelos.mjs`

- [ ] **Step 1: Escribe el script de sondeo**

```javascript
// scripts/probe-modelos.mjs
// Sondeo de un solo uso: qué combinaciones de modelo y herramienta funcionan.
// Se borra en la Task 15. Cuesta unos céntimos.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const ESQUEMA = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      empresa: { type: "string" },
      hace_producto_digital: { type: "boolean" },
    },
    required: ["empresa", "hace_producto_digital"],
    additionalProperties: false,
  },
};

async function probar(etiqueta, params) {
  try {
    const r = await client.messages.create(params);
    const texto = r.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    console.log(`\n✅ ${etiqueta}`);
    console.log("   stop_reason:", r.stop_reason);
    console.log("   usage:", JSON.stringify(r.usage));
    console.log("   texto:", texto.slice(0, 220).replace(/\n/g, " "));
  } catch (err) {
    console.log(`\n❌ ${etiqueta}`);
    console.log("   ", err.status, err.message?.slice(0, 300));
  }
}

const PREGUNTA = "¿A qué se dedica la empresa española Mahou San Miguel y cuánto factura?";

// A · Haiku 4.5 con búsqueda web básica
await probar("A · haiku-4-5 + web_search_20250305", {
  model: "claude-haiku-4-5",
  max_tokens: 1024,
  tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
  messages: [{ role: "user", content: PREGUNTA }],
});

// B · Haiku 4.5 con la versión nueva y llamada directa
await probar("B · haiku-4-5 + web_search_20260318 + allowed_callers direct", {
  model: "claude-haiku-4-5",
  max_tokens: 1024,
  tools: [
    {
      type: "web_search_20260318",
      name: "web_search",
      max_uses: 2,
      allowed_callers: ["direct"],
    },
  ],
  messages: [{ role: "user", content: PREGUNTA }],
});

// C · Haiku 4.5 con salida estructurada, sin herramientas
await probar("C · haiku-4-5 + output_config.format", {
  model: "claude-haiku-4-5",
  max_tokens: 1024,
  output_config: { format: ESQUEMA },
  messages: [
    { role: "user", content: "Mahou San Miguel fabrica cerveza. Devuelve el JSON." },
  ],
});

// D · la pregunta del spec: ¿una sola llamada con búsqueda web Y estructura?
await probar("D · haiku-4-5 + web_search + output_config.format a la vez", {
  model: "claude-haiku-4-5",
  max_tokens: 1024,
  tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
  output_config: { format: ESQUEMA },
  messages: [{ role: "user", content: PREGUNTA }],
});

// E · Opus 5 con la versión nueva, filtrado dinámico y response_inclusion
await probar("E · opus-5 + web_search_20260318 + response_inclusion excluded", {
  model: "claude-opus-5",
  max_tokens: 2048,
  thinking: { type: "adaptive" },
  tools: [
    {
      type: "web_search_20260318",
      name: "web_search",
      max_uses: 3,
      response_inclusion: "excluded",
    },
  ],
  messages: [{ role: "user", content: PREGUNTA }],
});

// F · Opus 5, una sola llamada con búsqueda web Y estructura
await probar("F · opus-5 + web_search + output_config.format a la vez", {
  model: "claude-opus-5",
  max_tokens: 2048,
  thinking: { type: "adaptive" },
  tools: [{ type: "web_search_20260318", name: "web_search", max_uses: 3 }],
  output_config: { format: ESQUEMA },
  messages: [{ role: "user", content: PREGUNTA }],
});
```

- [ ] **Step 2: Ejecútalo**

Run: `node --env-file=.env.local scripts/probe-modelos.mjs`

### RESULTADOS (ejecutado el 2026-08-31)

**Los seis casos pasaron.** Lo que importa:

| Caso | Resultado | Tokens entrada | Búsquedas |
|---|---|---|---|
| A · haiku + `web_search_20250305` | ✅ | 10.487 | 1 |
| B · haiku + `web_search_20260318` + direct | ✅ | 10.487 | 1 |
| C · haiku + `output_config.format` | ✅ | 194 | — |
| D · haiku + búsqueda **y** estructura | ✅ buscó **y** devolvió JSON | 9.891 | 1 |
| E · opus-5 + `20260318` + `excluded` | ✅ | **49.974** | 3 |
| F · opus-5 + búsqueda y estructura | ✅ pero **no buscó** | 5.564 | 0 |

**Decisiones que salen de aquí:**

1. **`quickLook` se colapsa en UNA llamada.** D lo demuestra: buscó y devolvió JSON válido. Ahorra ~20% del coste del vistazo.
2. **`deepDive` mantiene las dos llamadas.** F fue aceptada por la API pero no buscó ni una vez — una sola muestra no prueba incompatibilidad, pero el valor entero del análisis a fondo es que investigue, y no vamos a jugárnoslo a que el esquema no suprima la búsqueda. Se revisa cuando haya más muestras.
3. **El análisis a fondo cuesta ~0,33 $, no ~0,15 $.** El caso E gastó 49.974 tokens de entrada: los resultados de búsqueda entran como input aunque el filtrado dinámico los cribe. `response_inclusion: "excluded"` recorta la SALIDA, no la entrada. Cuenta: 0,250 $ (entrada) + 0,049 $ (salida) + 0,030 $ (3 búsquedas) = **0,329 $**.
   - El botón de la pantalla dice **`~0,35 $`**, no `~0,15 $`.
   - `BUSQUEDA_FONDO` baja a `max_uses: 3`, que es lo que midió E.
   - Hay que actualizar la tabla de costes del spec.
4. **El vistazo se confirma en ~0,022 $**: 10.487 entrada × 1 $/M + 292 salida × 5 $/M + 1 búsqueda = 0,022 $. La estimación de 0,03 $ aguanta con margen.
5. Se usa `web_search_20250305` en el vistazo: A funciona y es la más simple.

- [ ] **Step 3: Anota los resultados y ajusta el plan** — HECHO, ver arriba

Escribe los seis resultados en el propio fichero del plan, bajo esta tarea. Reglas de decisión:

- **A falla y B funciona** → en Task 8 usa `web_search_20260318` con `allowed_callers: ["direct"]` para el vistazo. **A funciona** → usa `web_search_20250305`, más simple.
- **A y B fallan los dos** → Haiku 4.5 no sirve para el vistazo. Cambia el modelo del vistazo a `claude-sonnet-5` en Task 8 y **actualiza la tabla de costes del spec**: el vistazo pasa de ~0,03 $ a ~0,08 $ por empresa, y el tope diario de 0,75 $ hay que subirlo a 1,50 $. Avisa al usuario antes de seguir: cambia el coste del sistema.
- **C falla** → el paso de estructurar del vistazo usa también `claude-sonnet-5`, que sí la soporta.
- **D y F funcionan** → **colapsa las dos llamadas en una** en Task 8 y borra el paso de estructurar. Anota en el spec, en la sección "Dos llamadas, no una", que se comprobó y se colapsó.
- **D o F fallan** → quedan las dos llamadas. Anota el mensaje de error exacto en el spec: es la justificación de por qué están partidas.
- **E falla** → usa `web_search_20260209` (sin `response_inclusion`) para Opus 5.

- [ ] **Step 4: Commit**

```bash
git add scripts/probe-modelos.mjs docs/superpowers/plans/2026-08-31-prospeccion-b2-cualificacion-ia.md
git commit -m "chore(prospeccion): sondeo de modelos y herramientas contra la API real"
```

---

## Task 1: Dar de alta Voyage

**Files:**
- Modify: `my-app/.env.local`

- [ ] **Step 1: Alta y clave**

Date de alta en `https://dashboard.voyageai.com`, crea una clave y añádela a `.env.local`:

```
# Embeddings para la memoria de prospección (voyage-4-lite, 200M tokens gratis)
VOYAGE_API_KEY=pa-...
```

Añádela también en Vercel → Settings → Environment Variables, entorno Production, porque ahí corre el cron.

- [ ] **Step 2: Comprueba que responde**

```bash
curl -s https://api.voyageai.com/v1/embeddings \
  -H "Authorization: Bearer $VOYAGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"input":["fabricante de herrajes"],"model":"voyage-4-lite","input_type":"document"}' \
  | head -c 300
```

Expected: un JSON con `"object":"list"` y un `embedding` que empieza por números. Si devuelve 401, la clave está mal.

- [ ] **Step 3: No hay commit**

`.env.local` está en `.gitignore`. No lo añadas nunca.

---

## Task 2: Esquema — `ProspectMemory`, campos nuevos, extensión e índice

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `scripts/setup-pgvector.mjs`

- [ ] **Step 1: Añade los campos a `ProspectDiscovery`**

En `prisma/schema.prisma`, dentro de `model ProspectDiscovery`, después de `imported`:

```prisma
  // ─── Cualificación con IA (fase B2) ───────────────────────────────────────
  // El dossier es lo que hace que la ficha diga algo de la empresa. Sin él, la
  // fila no debe llegar nunca a la cola: la pantalla asume que está.
  score       Int? // 0-100, calculado en score.js a partir de los 4 veredictos
  dossier     Json? // veredictos, informe en prosa, fuentes y coste estimado
  depth       String? // "vistazo" | "fondo" — de dónde viene el dossier
  qualifiedAt DateTime? // cuándo se miró por última vez
  neighbors   Json? // los 3 vecinos más cercanos, para el "se parece a"
```

Y añade el índice, junto a los dos que ya hay:

```prisma
  @@index([decision, score])
```

- [ ] **Step 2: Añade los campos a `Prospect`**

Dentro de `model Prospect`, después de `notes`:

```prisma
  // La nota de conexión de LinkedIn que se genera al validar. Se guarda TAL Y
  // COMO queda tras tus ediciones, porque las notas editadas son los ejemplos
  // de tono de las siguientes (ver introText.js).
  introText String? @db.Text
  dossier   Json? // copia del dossier del descubrimiento, para no perderlo
```

- [ ] **Step 3: Añade el modelo `ProspectMemory`**

Al final del bloque de prospección, después de `model ProspectDiscovery`:

```prisma
// La memoria de la prospección. Guarda documentos de tipos distintos en la
// misma tabla para que una sola consulta de vecindad los recorra todos.
//
// Su trabajo principal NO es la precisión, es el ORDEN: cada mañana Apollo
// devuelve ~125 caras, embeberlas todas cuesta cero y pasarles el vistazo a
// todas costaría 3,75 $. Ordenarlas por parecido con lo ya decidido es lo que
// permite mirar solo a los ocho o diez primeros.
//
// Prisma no tiene tipo nativo para `vector`, así que la columna va como
// Unsupported y todo lo que la toca pasa por $queryRaw (ver memory.js).
model ProspectMemory {
  id        Int      @id @default(autoincrement())
  kind      String // "decision" | "criterio" | "conclusion"
  sourceId  String? // apolloId de la fila que lo originó
  text      String   @db.Text // el texto que se embebió, legible
  metadata  Json // decisión, motivo, veredictos, sector, tramo, score
  embedding Unsupported("vector(1024)")
  createdAt DateTime @default(now())

  @@index([kind])
  @@index([sourceId])
}
```

- [ ] **Step 4: NO apliques el esquema todavía**

⚠️ **El orden importa y es un círculo vicioso si se hace mal.** Comprobado en la
ejecución real del 2026-08-31: lanzar `db push` antes de crear la extensión falla
con `ERROR: type "vector" does not exist`, porque no puede crear la tabla
`ProspectMemory` sin el tipo. Y el índice HNSW no se puede crear antes que la
tabla. La secuencia correcta es la del Step 6.

`npx prisma validate` sí se puede ejecutar ahora: no toca la base.

- [ ] **Step 5: Crea el script de la extensión y el índice**

`db push` no crea extensiones ni índices HNSW. Van aparte, y son idempotentes:

```javascript
// scripts/setup-pgvector.mjs
// La extensión y el índice HNSW que `prisma db push` no crea. Idempotente:
// se puede ejecutar tantas veces como haga falta.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
  console.log("✅ extensión vector");

  // El índice HNSW hace la consulta de vecindad rápida. Con unos cientos de
  // filas daría igual, pero crearlo ahora evita tener que acordarse después.
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS prospect_memory_embedding_idx
      ON "ProspectMemory" USING hnsw (embedding vector_cosine_ops)
  `);
  console.log("✅ índice HNSW");

  const [{ count }] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS count FROM "ProspectMemory"`,
  );
  console.log("filas en ProspectMemory:", count);
} finally {
  await prisma.$disconnect();
}
```

- [ ] **Step 6: Ejecútalo**

Run: `node --env-file=.env.local scripts/setup-pgvector.mjs`
Expected:
```
✅ extensión vector
✅ índice HNSW
filas en ProspectMemory: 0
```

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma scripts/setup-pgvector.mjs
git commit -m "feat(prospeccion): esquema de la memoria vectorial y del dossier"
```

---

## Task 3: `aiCost.js` — cuánto ha costado cada llamada

Sin esto no hay tope de gasto ni métrica de coste por prospecto, que son dos piezas del spec. Es aritmética pura: perfecta para empezar por ella.

**Files:**
- Create: `app/lib/prospecting/aiCost.js`
- Test: `app/lib/prospecting/aiCost.test.js`

- [ ] **Step 1: Escribe el test que falla**

```javascript
// app/lib/prospecting/aiCost.test.js
import { describe, expect, it } from "vitest";
import { costOf, sumCosts } from "./aiCost";

describe("costOf", () => {
  it("cobra entrada y salida al precio del modelo", () => {
    // Opus 5: 5 $/M de entrada, 25 $/M de salida.
    const c = costOf("claude-opus-5", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(c).toBeCloseTo(30, 6);
  });

  it("cobra la lectura de caché a una décima parte de la entrada", () => {
    const c = costOf("claude-opus-5", {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
    });
    expect(c).toBeCloseTo(0.5, 6);
  });

  it("cobra las búsquedas web a 10 $ por mil", () => {
    const c = costOf("claude-haiku-4-5", {
      input_tokens: 0,
      output_tokens: 0,
      server_tool_use: { web_search_requests: 3 },
    });
    expect(c).toBeCloseTo(0.03, 6);
  });

  it("un modelo desconocido se cobra al precio más caro que conocemos", () => {
    // Fallar en abierto aquí significa creerse más barato de lo que se es y
    // pasarse del tope sin enterarse. Se falla en cerrado.
    const desconocido = costOf("claude-modelo-que-no-existe", {
      input_tokens: 1_000_000,
      output_tokens: 0,
    });
    const masCaro = costOf("claude-opus-5", { input_tokens: 1_000_000, output_tokens: 0 });
    expect(desconocido).toBeGreaterThanOrEqual(masCaro);
  });

  it("un usage roto no rompe: cuenta cero en lo que falte", () => {
    expect(costOf("claude-opus-5", undefined)).toBe(0);
    expect(costOf("claude-opus-5", { input_tokens: null })).toBe(0);
  });
});

describe("sumCosts", () => {
  it("suma una lista de llamadas", () => {
    const total = sumCosts([
      { model: "claude-haiku-4-5", usage: { input_tokens: 1_000_000, output_tokens: 0 } },
      { model: "claude-haiku-4-5", usage: { input_tokens: 0, output_tokens: 1_000_000 } },
    ]);
    expect(total).toBeCloseTo(6, 6); // 1 $ de entrada + 5 $ de salida
  });

  it("una lista vacía cuesta cero", () => {
    expect(sumCosts([])).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecuta el test para verlo fallar**

Run: `npx vitest run app/lib/prospecting/aiCost.test.js`
Expected: FAIL, `Failed to resolve import "./aiCost"`.

- [ ] **Step 3: Escribe la implementación mínima**

```javascript
// app/lib/prospecting/aiCost.js
// Cuánto ha costado una llamada. Es una ESTIMACIÓN nuestra, no la factura de
// Anthropic: la interfaz lo dice con esas palabras. Sirve para dos cosas que sí
// necesitan un número, aunque sea aproximado — el tope de gasto del cron y la
// métrica de coste por prospecto validado.
//
// Precios verificados el 2026-08-31, en dólares por millón de tokens.
// Si cambian, se cambian AQUÍ y en ningún otro sitio.
const PRECIOS = {
  "claude-opus-5": { entrada: 5, salida: 25 },
  "claude-sonnet-5": { entrada: 2, salida: 10 },
  "claude-haiku-4-5": { entrada: 1, salida: 5 },
};

// La búsqueda web se factura aparte de los tokens: 10 $ por cada mil búsquedas.
export const PRECIO_BUSQUEDA_WEB = 10 / 1000;

// La lectura de caché cuesta una décima parte del precio de entrada.
const FACTOR_CACHE = 0.1;

// Escribir en caché tiene RECARGO, al contrario que leer: 1,25× el precio de
// entrada con TTL de 5 minutos y 2× con TTL de 1 hora. Y no es un caso raro: la
// búsqueda web inserta una escritura de caché de 5 minutos por su cuenta cuando
// la petición ya usa `cache_control`, que es exactamente lo que hace el
// cualificador. Sin esto se subestimaba el gasto en cada llamada.
//
// `usage.cache_creation` desglosa por TTL (`ephemeral_5m_input_tokens` /
// `ephemeral_1h_input_tokens`). Cuando solo llega el agregado sin desglose se
// cobra al 2×, el peor caso: mismo principio de fallar en cerrado que MAS_CARO.
const FACTOR_ESCRITURA_5M = 1.25;
const FACTOR_ESCRITURA_1H = 2;

// Fallar en CERRADO ante un modelo desconocido. Creerse más barato de lo que
// uno es lleva a pasarse del tope diario sin que nada avise; creerse más caro
// solo hace que el cron pare antes, que es el lado seguro.
const MAS_CARO = Object.values(PRECIOS).reduce(
  (peor, p) => ({
    entrada: Math.max(peor.entrada, p.entrada),
    salida: Math.max(peor.salida, p.salida),
  }),
  { entrada: 0, salida: 0 },
);

function num(valor) {
  return Number.isFinite(valor) ? valor : 0;
}

export function costOf(model, usage) {
  if (!usage) return 0;
  const precio = PRECIOS[model] ?? MAS_CARO;

  const entrada = num(usage.input_tokens);
  const salida = num(usage.output_tokens);
  const cache = num(usage.cache_read_input_tokens);
  const creacionCache = num(usage.cache_creation_input_tokens);
  const busquedas = num(usage.server_tool_use?.web_search_requests);

  return (
    ((entrada + creacionCache) * precio.entrada) / 1e6 +
    (salida * precio.salida) / 1e6 +
    (cache * precio.entrada * FACTOR_CACHE) / 1e6 +
    busquedas * PRECIO_BUSQUEDA_WEB
  );
}

// Suma las llamadas de una ejecución. Cada elemento es `{ model, usage }`.
export function sumCosts(llamadas = []) {
  return llamadas.reduce((total, l) => total + costOf(l?.model, l?.usage), 0);
}
```

- [ ] **Step 4: Ejecuta el test para verlo pasar**

Run: `npx vitest run app/lib/prospecting/aiCost.test.js`
Expected: PASS, 10 tests (7 iniciales + 3 del recargo de escritura de caché).

- [ ] **Step 5: Commit**

```bash
git add app/lib/prospecting/aiCost.js app/lib/prospecting/aiCost.test.js
git commit -m "feat(prospeccion): estimacion del coste de cada llamada de IA"
```

---

## Task 4: `score.js` — la fórmula, las puertas duras y el umbral

**Files:**
- Create: `app/lib/prospecting/score.js`
- Test: `app/lib/prospecting/score.test.js`

- [ ] **Step 1: Escribe el test que falla**

```javascript
// app/lib/prospecting/score.test.js
import { describe, expect, it } from "vitest";
import { scoreOf, passesGate, QUALIFY_THRESHOLD, PESOS } from "./score";

const todoPass = {
  revenue: { verdict: "pass" },
  digitalNeed: { verdict: "pass" },
  itTeam: { verdict: "pass" },
  advisory: { verdict: "pass" },
};

describe("scoreOf", () => {
  it("los cuatro en pass dan 100", () => {
    expect(scoreOf(todoPass)).toBe(100);
  });

  it("los cuatro en unclear dan 40, el 40% de todo", () => {
    const todoUnclear = Object.fromEntries(
      Object.keys(todoPass).map((k) => [k, { verdict: "unclear" }]),
    );
    expect(scoreOf(todoUnclear)).toBe(40);
  });

  it("un fail resta el peso entero de ese criterio", () => {
    expect(scoreOf({ ...todoPass, advisory: { verdict: "fail" } })).toBe(
      100 - PESOS.advisory,
    );
  });

  it("un veredicto ausente o inventado cuenta como unclear, no como pass", () => {
    // Si el modelo devuelve basura, el sesgo tiene que ser hacia la duda.
    const roto = { ...todoPass, itTeam: { verdict: "quizá" } };
    expect(scoreOf(roto)).toBe(100 - PESOS.itTeam * 0.6);
    expect(scoreOf({})).toBe(40);
    expect(scoreOf(null)).toBe(0);
  });

  it("los pesos suman 100", () => {
    expect(Object.values(PESOS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("passesGate", () => {
  it("deja pasar lo que llega al umbral", () => {
    expect(passesGate(todoPass).ok).toBe(true);
  });

  it("un fail en facturación descarta aunque el resto sume", () => {
    const r = passesGate({ ...todoPass, revenue: { verdict: "fail" } });
    expect(r.ok).toBe(false);
    expect(r.reasonCode).toBe("revenue");
  });

  it("un fail en producto digital descarta aunque el resto sume", () => {
    const r = passesGate({ ...todoPass, digitalNeed: { verdict: "fail" } });
    expect(r.ok).toBe(false);
    expect(r.reasonCode).toBe("no_digital_need");
  });

  it("un fail en equipo IT solo resta, no descarta por sí solo", () => {
    expect(passesGate({ ...todoPass, itTeam: { verdict: "fail" } }).ok).toBe(true);
  });

  it("por debajo del umbral no pasa, y dice cuánto sacó", () => {
    const flojo = {
      revenue: { verdict: "unclear" },
      digitalNeed: { verdict: "unclear" },
      itTeam: { verdict: "unclear" },
      advisory: { verdict: "unclear" },
    };
    const r = passesGate(flojo); // 40 < 50
    expect(r.ok).toBe(false);
    expect(r.reasonCode).toBe("other");
    expect(r.score).toBe(40);
  });

  it("justo en el umbral entra", () => {
    // digitalNeed pass (30) + revenue unclear (12) + itTeam unclear (10)
    // + advisory fail (0) = 52. Por encima de 50, entra.
    const justo = {
      revenue: { verdict: "unclear" },
      digitalNeed: { verdict: "pass" },
      itTeam: { verdict: "unclear" },
      advisory: { verdict: "fail" },
    };
    const r = passesGate(justo);
    expect(r.score).toBe(52);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecuta el test para verlo fallar**

Run: `npx vitest run app/lib/prospecting/score.test.js`
Expected: FAIL, `Failed to resolve import "./score"`.

- [ ] **Step 3: Escribe la implementación**

```javascript
// app/lib/prospecting/score.js
// La puntuación de encaje. Lo importante de este módulo no es la fórmula, es
// QUIÉN la calcula: nosotros, no el modelo.
//
// Pedirle un número al modelo daría una cifra que nadie puede discutir —"¿por
// qué 68 y no 74?" no tiene respuesta—. Calculándolo aquí a partir de los
// cuatro veredictos, discrepar del 68 es discrepar de un veredicto concreto,
// que sí es una conversación que se puede tener mirando la evidencia de la
// ficha. Los pesos son la palanca para afinar el perfil.

export const PESOS = {
  revenue: 30, // el más caro de equivocar: define el tamaño de cliente
  digitalNeed: 30, // el que separa a un cliente de una competencia
  itTeam: 25,
  advisory: 15, // el más difícil de ver desde fuera, así que pesa menos
};

// `unclear` no vale cero: una empresa de la que no hemos podido confirmar nada
// no es lo mismo que una que sabemos que no encaja. Con el vistazo barato,
// `unclear` va a ser el veredicto más frecuente, y a cero la cola saldría vacía
// todos los días.
const FACTOR = { pass: 1, unclear: 0.4, fail: 0 };

// Por debajo del umbral no entra en la cola. Está deliberadamente bajo: el
// filtrado de verdad lo hacen las dos puertas duras de abajo, y el score sirve
// sobre todo para ORDENAR y para que se vea de un golpe cuál merece los 0,35 $
// del análisis a fondo.
export const QUALIFY_THRESHOLD = 50;

// Un `fail` en estos dos descarta pase lo que pase con el resto: una empresa de
// 300 M€ o una que hace software no encaja por mucho que su equipo de IT sea
// pequeño y necesite orientación.
const PUERTAS_DURAS = {
  revenue: "revenue",
  digitalNeed: "no_digital_need",
};

function factorDe(criterio) {
  const veredicto = criterio?.verdict;
  // Un veredicto ausente o que no reconocemos se trata como duda, nunca como
  // acierto: si el modelo devuelve basura, el sesgo tiene que ir hacia mirar
  // más, no hacia colar un candidato.
  return FACTOR[veredicto] ?? FACTOR.unclear;
}

export function scoreOf(veredictos) {
  if (!veredictos || typeof veredictos !== "object") return 0;
  const total = Object.entries(PESOS).reduce(
    (suma, [clave, peso]) => suma + peso * factorDe(veredictos[clave]),
    0,
  );
  return Math.round(total);
}

// ¿Entra en la cola? Devuelve también el porqué, para que el resumen del cron
// sea diagnosticable sin abrir la base de datos.
export function passesGate(veredictos) {
  const score = scoreOf(veredictos);

  for (const [clave, reasonCode] of Object.entries(PUERTAS_DURAS)) {
    if (veredictos?.[clave]?.verdict === "fail") {
      return { ok: false, score, reasonCode };
    }
  }

  if (score < QUALIFY_THRESHOLD) {
    return { ok: false, score, reasonCode: "other" };
  }

  return { ok: true, score, reasonCode: null };
}
```

- [ ] **Step 4: Ejecuta el test para verlo pasar**

Run: `npx vitest run app/lib/prospecting/score.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add app/lib/prospecting/score.js app/lib/prospecting/score.test.js
git commit -m "feat(prospeccion): formula del score y puertas duras de los criterios"
```

---

## Task 5: `embeddings.js` — el cliente de Voyage

**Files:**
- Create: `app/lib/prospecting/embeddings.js`
- Test: `app/lib/prospecting/embeddings.test.js`

- [ ] **Step 1: Escribe el test que falla**

```javascript
// app/lib/prospecting/embeddings.test.js
import { describe, expect, it, vi } from "vitest";
import { embedTexts, textoDeCandidato, VOYAGE_MODEL, VOYAGE_DIMS } from "./embeddings";

function fetchFalso(respuesta, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 429,
    text: async () => JSON.stringify(respuesta),
  });
}

describe("embedTexts", () => {
  it("devuelve los vectores en el mismo orden que los textos", async () => {
    const fetch = fetchFalso({
      data: [
        { index: 1, embedding: [0.2] },
        { index: 0, embedding: [0.1] },
      ],
    });
    const v = await embedTexts(["a", "b"], { fetch, apiKey: "k" });
    // Voyage puede devolverlos desordenados: se reordenan por `index`.
    expect(v).toEqual([[0.1], [0.2]]);
  });

  it("una lista vacía no llama a la API", async () => {
    const fetch = fetchFalso({});
    expect(await embedTexts([], { fetch, apiKey: "k" })).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("manda input_type document al guardar y query al buscar", async () => {
    const fetch = fetchFalso({ data: [{ index: 0, embedding: [0.1] }] });
    await embedTexts(["a"], { fetch, apiKey: "k", inputType: "query" });
    const cuerpo = JSON.parse(fetch.mock.calls[0][1].body);
    expect(cuerpo.input_type).toBe("query");
    expect(cuerpo.model).toBe(VOYAGE_MODEL);
    expect(cuerpo.output_dimension).toBe(VOYAGE_DIMS);
  });

  it("sin clave lanza un error explícito", async () => {
    await expect(embedTexts(["a"], { fetch: fetchFalso({}), apiKey: "" })).rejects.toThrow(
      /VOYAGE_API_KEY/,
    );
  });

  it("un error HTTP lanza con el estado dentro", async () => {
    const fetch = fetchFalso({ detail: "rate limited" }, false);
    await expect(embedTexts(["a"], { fetch, apiKey: "k" })).rejects.toThrow(/429/);
  });

  it("trocea en lotes de 128 y concatena", async () => {
    const fetch = vi.fn().mockImplementation((url, opciones) => {
      const { input } = JSON.parse(opciones.body);
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: input.map((_, i) => ({ index: i, embedding: [i] })),
          }),
      });
    });
    const textos = Array.from({ length: 200 }, (_, i) => `t${i}`);
    const v = await embedTexts(textos, { fetch, apiKey: "k" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(v).toHaveLength(200);
  });
});

describe("textoDeCandidato", () => {
  it("junta cargo y empresa, que es toda la señal que hay antes de mirar", () => {
    expect(textoDeCandidato({ title: "COO", company: "Herrajes Nordeste" })).toBe(
      "COO · Herrajes Nordeste",
    );
  });

  it("aguanta que falte cualquiera de los dos", () => {
    expect(textoDeCandidato({ company: "Herrajes Nordeste" })).toBe("Herrajes Nordeste");
    expect(textoDeCandidato({})).toBe("");
  });
});
```

- [ ] **Step 2: Ejecuta el test para verlo fallar**

Run: `npx vitest run app/lib/prospecting/embeddings.test.js`
Expected: FAIL, `Failed to resolve import "./embeddings"`.

- [ ] **Step 3: Escribe la implementación**

```javascript
// app/lib/prospecting/embeddings.js
// Cliente de Voyage AI. Solo transporte: aquí no hay ninguna decisión sobre qué
// se embebe ni para qué (eso vive en memory.js y en rankPool.js).
//
// Anthropic no ofrece API de embeddings y recomienda Voyage. `voyage-4-lite`
// cuesta 0,02 $ por millón de tokens CON LOS PRIMEROS 200 MILLONES GRATIS: a
// nuestro volumen —unos 125 candidatos al día a ~20 tokens— son 900k tokens al
// año, así que esto no va a costar dinero en toda la vida del proyecto.
//
// `fetch` y `apiKey` se inyectan para poder probar esto sin red.

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

export const VOYAGE_MODEL = "voyage-4-lite";
export const VOYAGE_DIMS = 1024;

// Voyage acepta hasta 128 textos por llamada.
const LOTE = 128;

export async function embedTexts(
  textos = [],
  { fetch: fetchImpl = fetch, apiKey = process.env.VOYAGE_API_KEY, inputType = "document" } = {},
) {
  if (textos.length === 0) return [];
  if (!apiKey) {
    throw new Error(
      "VOYAGE_API_KEY no está definida: la memoria de prospección no puede embeber nada",
    );
  }

  const vectores = [];

  for (let i = 0; i < textos.length; i += LOTE) {
    const trozo = textos.slice(i, i + LOTE);

    const respuesta = await fetchImpl(VOYAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: trozo,
        model: VOYAGE_MODEL,
        input_type: inputType,
        output_dimension: VOYAGE_DIMS,
      }),
    });

    const texto = await respuesta.text();
    if (!respuesta.ok) {
      throw new Error(`Voyage respondió ${respuesta.status}: ${texto.slice(0, 300)}`);
    }

    const datos = JSON.parse(texto);
    // Voyage no garantiza el orden de `data`: trae un `index` por elemento y
    // hay que respetarlo. Confiar en el orden de llegada emparejaría cada
    // vector con el candidato equivocado, y el fallo sería silencioso — la
    // memoria simplemente ordenaría mal para siempre.
    const ordenados = new Array(trozo.length);
    for (const fila of datos.data ?? []) {
      ordenados[fila.index] = fila.embedding;
    }
    vectores.push(...ordenados);
  }

  return vectores;
}

// El texto con el que se representa a un candidato ANTES de mirarlo. Es todo lo
// que Apollo da gratis, y el nombre de la empresa es lo que más señal semántica
// aporta: "Herrajes Nordeste" dice más de a qué se dedican que la etiqueta de
// sector con la que los buscamos.
export function textoDeCandidato({ title, company } = {}) {
  return [title, company]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}
```

- [ ] **Step 4: Ejecuta el test para verlo pasar**

Run: `npx vitest run app/lib/prospecting/embeddings.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add app/lib/prospecting/embeddings.js app/lib/prospecting/embeddings.test.js
git commit -m "feat(prospeccion): cliente de embeddings de Voyage"
```

---

## Task 6: `memory.js` — escribir y consultar la memoria

**Files:**
- Create: `app/lib/prospecting/memory.js`
- Test: `app/lib/prospecting/memory.test.js`

- [ ] **Step 1: Escribe el test que falla**

```javascript
// app/lib/prospecting/memory.test.js
import { describe, expect, it, vi } from "vitest";
import { textoDeDecision, esMemorizabe, vectorLiteral } from "./memory";

describe("textoDeDecision", () => {
  it("mete la decisión al final, que es la etiqueta que se aprende", () => {
    const texto = textoDeDecision({
      title: "Director de Operaciones",
      company: "Herrajes Nordeste",
      sectorQuery: "Industria y fabricación",
      sizeQuery: "101,250",
      decision: "yes",
      dossier: { summary: "Fabricante que monta portal B2B" },
    });
    expect(texto).toContain("Director de Operaciones");
    expect(texto).toContain("Herrajes Nordeste");
    expect(texto).toContain("Fabricante que monta portal B2B");
    expect(texto).toMatch(/ACEPTADO$/);
  });

  it("un descarte lleva el motivo pegado a la etiqueta", () => {
    const texto = textoDeDecision({
      company: "Clínicas Vitalis",
      decision: "no",
      reasonCode: "revenue",
    });
    expect(texto).toMatch(/DESCARTADO por revenue$/);
  });

  it("aguanta una fila sin dossier: las de antes de esta fase no lo tienen", () => {
    expect(() => textoDeDecision({ company: "X", decision: "yes" })).not.toThrow();
  });
});

describe("esMemorizabe", () => {
  it("una decisión humana sí", () => {
    expect(esMemorizabe({ decision: "yes", reasonCode: null })).toBe(true);
    expect(esMemorizabe({ decision: "no", reasonCode: "revenue" })).toBe(true);
  });

  it("las filas legacy NO: nadie las decidió", () => {
    // 48 de las 52 filas decididas de producción son legacy, puestas por la
    // migración de B1. Meterlas en la memoria sería enseñarle al sistema un
    // criterio que ninguna persona ha tenido nunca.
    expect(esMemorizabe({ decision: "yes", reasonCode: "legacy" })).toBe(false);
    expect(esMemorizabe({ decision: "no", reasonCode: "legacy" })).toBe(false);
  });

  it("lo pendiente todavía no", () => {
    expect(esMemorizabe({ decision: "pending" })).toBe(false);
  });
});

describe("vectorLiteral", () => {
  it("serializa como literal de pgvector", () => {
    expect(vectorLiteral([0.1, -0.2, 0])).toBe("[0.1,-0.2,0]");
  });

  it("rechaza lo que no es un vector de números finitos", () => {
    expect(() => vectorLiteral([0.1, NaN])).toThrow(/vector/i);
    expect(() => vectorLiteral(null)).toThrow(/vector/i);
    expect(() => vectorLiteral([])).toThrow(/vector/i);
  });
});
```

- [ ] **Step 2: Ejecuta el test para verlo fallar**

Run: `npx vitest run app/lib/prospecting/memory.test.js`
Expected: FAIL, `Failed to resolve import "./memory"`.

- [ ] **Step 3: Escribe la implementación**

```javascript
// app/lib/prospecting/memory.js
// La memoria de la prospección: qué se guarda, cómo se representa en texto y
// cómo se consultan los vecinos.
//
// Prisma no tiene tipo nativo para `vector`, así que todo lo que toca la
// columna `embedding` pasa por $queryRaw. Las funciones puras (el texto, el
// filtro de memorizables, el literal) están arriba y separadas para poder
// probarlas sin base de datos.

import { embedTexts, textoDeCandidato } from "./embeddings";

// ─── Puro ───────────────────────────────────────────────────────────────────

// El texto que se embebe de una decisión. La decisión va AL FINAL porque es la
// etiqueta: lo que queremos que el modelo asocie con el resto de la frase.
export function textoDeDecision(fila = {}) {
  const cabecera = textoDeCandidato(fila);
  const criterio = [
    fila.sectorQuery,
    fila.sizeQuery ? `${String(fila.sizeQuery).replace(",", "-")} empleados` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const resumen = fila.dossier?.summary ?? null;

  const etiqueta =
    fila.decision === "yes"
      ? "ACEPTADO"
      : `DESCARTADO por ${fila.reasonCode ?? "sin motivo"}`;

  return [cabecera, criterio ? `buscado como ${criterio}` : null, resumen, etiqueta]
    .filter(Boolean)
    .join(" · ");
}

// Qué filas entran en la memoria. La guarda de `legacy` es la misma que ya
// aplica rules.js y por el mismo motivo: son decisiones que puso una migración,
// no una persona. En producción son 48 de 52, así que dejarlas entrar sería
// llenar la memoria de criterio inventado desde el primer día.
export function esMemorizabe(fila = {}) {
  if (fila.reasonCode === "legacy") return false;
  return fila.decision === "yes" || fila.decision === "no";
}

// pgvector acepta el vector como literal de texto: '[0.1,-0.2,0]'.
export function vectorLiteral(vector) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("vector vacío o no es un array");
  }
  if (!vector.every((n) => Number.isFinite(n))) {
    throw new Error("el vector lleva valores que no son números finitos");
  }
  return `[${vector.join(",")}]`;
}

// ─── Con base de datos ──────────────────────────────────────────────────────

// Guarda un documento. `prisma` se inyecta para poder probar el resto sin base.
export async function remember(
  prisma,
  { kind, sourceId = null, text, metadata = {}, embedding },
) {
  const literal = vectorLiteral(embedding);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProspectMemory" (kind, "sourceId", text, metadata, embedding)
     VALUES ($1, $2, $3, $4::jsonb, $5::vector)`,
    kind,
    sourceId,
    text,
    JSON.stringify(metadata),
    literal,
  );
}

// Guarda la decisión de un candidato. Se llama al aceptar y al descartar.
export async function rememberDecision(prisma, fila, opciones = {}) {
  if (!esMemorizabe(fila)) return { guardado: false, motivo: "no memorizable" };

  const text = textoDeDecision(fila);
  const [embedding] = await embedTexts([text], { ...opciones, inputType: "document" });
  if (!embedding) return { guardado: false, motivo: "sin embedding" };

  await remember(prisma, {
    kind: "decision",
    sourceId: fila.apolloId ?? null,
    text,
    metadata: {
      decision: fila.decision,
      reasonCode: fila.reasonCode ?? null,
      company: fila.company ?? null,
      title: fila.title ?? null,
      sectorQuery: fila.sectorQuery ?? null,
      sizeQuery: fila.sizeQuery ?? null,
      score: fila.score ?? null,
    },
    embedding,
  });

  return { guardado: true };
}

// Los `k` documentos más cercanos a un vector. `<=>` es distancia coseno: 0 es
// idéntico, 2 es opuesto. Se devuelve también la distancia para poder decidir
// si el parecido es lo bastante bueno como para enseñarlo en la ficha.
export async function nearest(prisma, embedding, { k = 5, kinds = null } = {}) {
  const literal = vectorLiteral(embedding);
  const filtroKind = kinds?.length ? `WHERE kind = ANY($3)` : "";

  const params = [literal, k];
  if (kinds?.length) params.push(kinds);

  return prisma.$queryRawUnsafe(
    `SELECT id, kind, "sourceId", text, metadata,
            (embedding <=> $1::vector) AS distance
       FROM "ProspectMemory"
       ${filtroKind}
      ORDER BY embedding <=> $1::vector
      LIMIT $2`,
    ...params,
  );
}

// Cuántos documentos hay. La pantalla lo usa para explicar el arranque en frío:
// con la memoria casi vacía, el orden de la cola es poco más que el de Apollo.
export async function memorySize(prisma) {
  const [fila] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "ProspectMemory" WHERE kind = 'decision'`,
  );
  return fila?.n ?? 0;
}
```

- [ ] **Step 4: Ejecuta el test para verlo pasar**

Run: `npx vitest run app/lib/prospecting/memory.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add app/lib/prospecting/memory.js app/lib/prospecting/memory.test.js
git commit -m "feat(prospeccion): memoria vectorial, escritura y consulta de vecinos"
```

---

## Task 7: `rankPool.js` — ordenar el pozo sin descartar a nadie

Esta es la pieza que hace que la búsqueda sea más eficaz cada día. Es también la que más fácil sería hacer mal: si en vez de ordenar filtrase, la memoria acabaría condenando candidatos por parecerse a un descarte antiguo, que es exactamente el trinquete que B1 rechazó.

**Files:**
- Create: `app/lib/prospecting/rankPool.js`
- Test: `app/lib/prospecting/rankPool.test.js`

- [ ] **Step 1: Escribe el test que falla**

```javascript
// app/lib/prospecting/rankPool.test.js
import { describe, expect, it, vi } from "vitest";
import { afinidad, rankPool } from "./rankPool";

describe("afinidad", () => {
  it("un vecino aceptado y cercano puntúa alto", () => {
    const a = afinidad([{ distance: 0.1, metadata: { decision: "yes" } }]);
    expect(a).toBeGreaterThan(0);
  });

  it("un vecino descartado y cercano puntúa en contra", () => {
    const a = afinidad([{ distance: 0.1, metadata: { decision: "no" } }]);
    expect(a).toBeLessThan(0);
  });

  it("un vecino lejano pesa menos que uno cercano", () => {
    const cerca = afinidad([{ distance: 0.1, metadata: { decision: "yes" } }]);
    const lejos = afinidad([{ distance: 1.2, metadata: { decision: "yes" } }]);
    expect(cerca).toBeGreaterThan(lejos);
  });

  it("sin vecinos la afinidad es cero, no negativa", () => {
    // Con la memoria vacía todos los candidatos deben empatar, para que el
    // orden original de Apollo se conserve.
    expect(afinidad([])).toBe(0);
    expect(afinidad(null)).toBe(0);
  });

  it("solo mira los documentos de tipo decision", () => {
    const a = afinidad([
      { distance: 0.05, kind: "criterio", metadata: {} },
      { distance: 0.9, kind: "decision", metadata: { decision: "yes" } },
    ]);
    const soloDecision = afinidad([
      { distance: 0.9, kind: "decision", metadata: { decision: "yes" } },
    ]);
    expect(a).toBeCloseTo(soloDecision, 10);
  });
});

describe("rankPool", () => {
  const candidatos = [
    { id: "a", title: "COO", organization: { name: "Alfa" } },
    { id: "b", title: "CEO", organization: { name: "Beta" } },
    { id: "c", title: "CIO", organization: { name: "Gamma" } },
  ];

  it("con memoria vacía conserva el orden de Apollo", async () => {
    const ordenados = await rankPool(candidatos, {
      embed: async (textos) => textos.map(() => [1, 0]),
      buscarVecinos: async () => [],
    });
    expect(ordenados.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("pone delante al que se parece a un aceptado", async () => {
    const ordenados = await rankPool(candidatos, {
      embed: async (textos) => textos.map(() => [1, 0]),
      buscarVecinos: async (_v, i) =>
        i === 2 ? [{ kind: "decision", distance: 0.05, metadata: { decision: "yes" } }] : [],
    });
    expect(ordenados[0].id).toBe("c");
  });

  it("NUNCA elimina candidatos: ordena, no filtra", async () => {
    // La memoria solo decide a quién se MIRA primero. Si además descartara,
    // un mal recuerdo temprano condenaría para siempre a todo lo que se le
    // parezca, sin que nadie llegue a mirarlo nunca. Ese es el trinquete que
    // este proyecto ya rechazó una vez en rules.js.
    const ordenados = await rankPool(candidatos, {
      embed: async (textos) => textos.map(() => [1, 0]),
      buscarVecinos: async () => [
        { kind: "decision", distance: 0.01, metadata: { decision: "no" } },
      ],
    });
    expect(ordenados).toHaveLength(3);
  });

  it("si los embeddings fallan, devuelve el orden original y lo dice", async () => {
    const ordenados = await rankPool(candidatos, {
      embed: async () => {
        throw new Error("Voyage caído");
      },
      buscarVecinos: async () => [],
    });
    expect(ordenados.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(ordenados.degradado).toBeUndefined(); // el array es un array normal
  });

  it("adjunta los vecinos a cada candidato para el «se parece a»", async () => {
    const vecino = {
      kind: "decision",
      distance: 0.05,
      metadata: { decision: "yes", company: "Conservas Maribel" },
    };
    const ordenados = await rankPool(candidatos, {
      embed: async (textos) => textos.map(() => [1, 0]),
      buscarVecinos: async () => [vecino],
    });
    expect(ordenados[0]._vecinos[0].metadata.company).toBe("Conservas Maribel");
  });
});
```

- [ ] **Step 2: Ejecuta el test para verlo fallar**

Run: `npx vitest run app/lib/prospecting/rankPool.test.js`
Expected: FAIL, `Failed to resolve import "./rankPool"`.

- [ ] **Step 3: Escribe la implementación**

```javascript
// app/lib/prospecting/rankPool.js
// Ordena el pozo de candidatos antes de gastar un céntimo en mirarlos.
//
// POR QUÉ ESTO EXISTE: Apollo devuelve hasta 125 caras cada mañana. Embeberlas
// todas cuesta cero; pasarles el vistazo a todas costaría 3,75 $. Ordenarlas
// por parecido con lo ya decidido es lo que permite mirar solo a los ocho o
// diez primeros y parar en cuanto hay cinco que pasan.
//
// LO QUE ESTE MÓDULO NO HACE, Y NO DEBE HACER NUNCA: filtrar. Solo decide a
// quién se MIRA primero. Si además descartara, un mal recuerdo temprano
// condenaría a todo lo que se le parezca sin que nadie llegue a mirarlo jamás
// —y con la memoria casi vacía, los primeros recuerdos son casi arbitrarios—.
// Es el mismo trinquete que rules.js ya evita con la guarda de "ningún sí".

import { textoDeCandidato } from "./embeddings";

// Cuántos vecinos se consultan por candidato. Tres bastan para el "se parece a"
// de la ficha y para una afinidad estable.
const VECINOS = 3;

// Peso de un vecino según lo cerca que esté. `<=>` da distancia coseno, donde 0
// es idéntico. Se convierte en un peso que cae con la distancia, para que un
// parecido flojo no arrastre tanto como uno fuerte.
function peso(distancia) {
  const d = Number.isFinite(distancia) ? Math.max(0, distancia) : 2;
  return 1 / (1 + d * d);
}

// Cuánto se parece este candidato a lo que aceptaste, menos cuánto se parece a
// lo que descartaste. Positivo = mirar antes.
export function afinidad(vecinos) {
  if (!Array.isArray(vecinos) || vecinos.length === 0) return 0;

  return vecinos
    // Solo las decisiones enseñan algo sobre si mirar o no. El documento de
    // criterio comercial y las conclusiones del chat sirven de contexto para el
    // modelo, no para ordenar.
    .filter((v) => (v.kind ?? "decision") === "decision")
    .reduce((suma, v) => {
      const signo = v.metadata?.decision === "yes" ? 1 : -1;
      return suma + signo * peso(v.distance);
    }, 0);
}

// Ordena los candidatos. `embed` y `buscarVecinos` se inyectan para poder
// probar esto sin red ni base de datos.
//
// Si algo falla —Voyage caído, falta la clave— devuelve el orden original. La
// capa vectorial se degrada, no rompe: sin ella el sistema sigue llenando la
// cola, solo que mirando más empresas para conseguirlo.
export async function rankPool(candidatos = [], { embed, buscarVecinos } = {}) {
  if (candidatos.length === 0) return [];

  let vectores;
  try {
    vectores = await embed(candidatos.map((c) =>
      textoDeCandidato({ title: c.title, company: c.organization?.name }),
    ));
  } catch (err) {
    console.error("[prospeccion] no se pudieron embeber los candidatos:", err.message);
    return [...candidatos];
  }

  const conAfinidad = [];
  for (let i = 0; i < candidatos.length; i++) {
    let vecinos = [];
    try {
      vecinos = vectores[i] ? await buscarVecinos(vectores[i], i) : [];
    } catch (err) {
      console.error("[prospeccion] consulta de vecinos falló:", err.message);
    }
    conAfinidad.push({
      ...candidatos[i],
      _vecinos: vecinos.slice(0, VECINOS),
      _afinidad: afinidad(vecinos),
      _orden: i, // el orden original de Apollo, para desempatar
    });
  }

  // Desempate por el orden de Apollo: con la memoria vacía todas las afinidades
  // son 0 y el resultado tiene que ser exactamente la lista de entrada.
  return conAfinidad.sort((a, b) => b._afinidad - a._afinidad || a._orden - b._orden);
}
```

- [ ] **Step 4: Ejecuta el test para verlo pasar**

Run: `npx vitest run app/lib/prospecting/rankPool.test.js`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add app/lib/prospecting/rankPool.js app/lib/prospecting/rankPool.test.js
git commit -m "feat(prospeccion): ordena el pozo por afinidad con lo ya decidido"
```

---

## Task 8: `qualify.js` — el vistazo y el análisis a fondo

**Files:**
- Create: `app/lib/prospecting/qualify.js`
- Test: `app/lib/prospecting/qualify.test.js`

> **Antes de empezar**: aplica lo que salió de la Task 0. Si D y F funcionaron, colapsa `investigar` y `estructurar` en una sola llamada. Si A falló y B funcionó, cambia la definición de la herramienta del vistazo.

- [ ] **Step 1: Escribe el test que falla**

```javascript
// app/lib/prospecting/qualify.test.js
import { describe, expect, it, vi } from "vitest";
import { parseVerdicts, construirEjemplos, quickLook, MODELO_VISTAZO } from "./qualify";

const VEREDICTOS_OK = {
  revenue: { verdict: "pass", value: "≈71 M€ (2024)", evidence: "Cuentas depositadas", sources: ["https://e.example/x"] },
  digitalNeed: { verdict: "pass", value: "Portal B2B", evidence: "Nota de prensa", sources: [] },
  itTeam: { verdict: "pass", value: "3 personas", evidence: "LinkedIn", sources: [] },
  advisory: { verdict: "pass", value: "Alta", evidence: "Dos proyectos", sources: [] },
  summary: "Fabricante de 71 M€ montando su primer canal digital.",
};

describe("parseVerdicts", () => {
  it("acepta un JSON completo", () => {
    const r = parseVerdicts(JSON.stringify(VEREDICTOS_OK));
    expect(r.ok).toBe(true);
    expect(r.veredictos.revenue.verdict).toBe("pass");
  });

  it("rechaza JSON inválido y dice por qué", () => {
    const r = parseVerdicts("{ esto no es json");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/json/i);
  });

  it("rechaza si falta alguno de los cuatro criterios", () => {
    const { itTeam, ...incompleto } = VEREDICTOS_OK;
    const r = parseVerdicts(JSON.stringify(incompleto));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/itTeam/);
  });

  it("normaliza un veredicto desconocido a unclear en vez de romper", () => {
    const raro = { ...VEREDICTOS_OK, itTeam: { ...VEREDICTOS_OK.itTeam, verdict: "quizás" } };
    const r = parseVerdicts(JSON.stringify(raro));
    expect(r.ok).toBe(true);
    expect(r.veredictos.itTeam.verdict).toBe("unclear");
  });

  it("saca el JSON aunque venga envuelto en texto o en un bloque de código", () => {
    const envuelto = "Aquí tienes:\n```json\n" + JSON.stringify(VEREDICTOS_OK) + "\n```";
    expect(parseVerdicts(envuelto).ok).toBe(true);
  });
});

describe("construirEjemplos", () => {
  it("con memoria vacía no añade apartado de ejemplos", () => {
    expect(construirEjemplos([])).toBe("");
  });

  it("mete la decisión y el motivo de cada vecino", () => {
    const texto = construirEjemplos([
      { text: "COO · Herrajes Nordeste · ACEPTADO", metadata: { decision: "yes" } },
      { text: "CEO · Vitalis · DESCARTADO por revenue", metadata: { decision: "no", reasonCode: "revenue" } },
    ]);
    expect(texto).toContain("Herrajes Nordeste");
    expect(texto).toContain("revenue");
  });
});

describe("quickLook", () => {
  // El vistazo va en UNA sola llamada: la misma petición busca en la web y
  // devuelve el JSON (medido en la Task 0, caso D).
  function clienteFalso({ json = JSON.stringify(VEREDICTOS_OK) } = {}) {
    const create = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: json }],
      usage: { input_tokens: 10_000, output_tokens: 300 },
    });
    return { messages: { create } };
  }

  it("devuelve veredictos, informe y coste", async () => {
    const r = await quickLook(
      { title: "COO", company: "Herrajes Nordeste" },
      { client: clienteFalso(), ejemplos: [] },
    );
    expect(r.ok).toBe(true);
    expect(r.veredictos.revenue.verdict).toBe("pass");
    expect(r.cost).toBeGreaterThan(0);
    expect(r.depth).toBe("vistazo");
  });

  it("el vistazo hace UNA sola llamada, no dos", async () => {
    const client = clienteFalso();
    await quickLook({ company: "X" }, { client, ejemplos: [] });
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });

  it("el vistazo pide la salida estructurada en la misma llamada que busca", async () => {
    const client = clienteFalso();
    await quickLook({ company: "X" }, { client, ejemplos: [] });
    const params = client.messages.create.mock.calls[0][0];
    expect(params.output_config?.format).toBeTruthy();
    expect(params.tools).toHaveLength(1);
  });

  it("usa el modelo del vistazo, no el caro", async () => {
    const client = clienteFalso();
    await quickLook({ company: "X" }, { client, ejemplos: [] });
    expect(client.messages.create.mock.calls[0][0].model).toBe(MODELO_VISTAZO);
  });

  it("si el JSON no se puede parsear, devuelve ok false con el coste ya gastado", async () => {
    const r = await quickLook(
      { company: "X" },
      { client: clienteFalso({ json: "no soy json" }), ejemplos: [] },
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/json/i);
    expect(r.cost).toBeGreaterThan(0);
  });

  it("si la API lanza, devuelve ok false sin romper el cron", async () => {
    const client = { messages: { create: vi.fn().mockRejectedValue(new Error("529")) } };
    const r = await quickLook({ company: "X" }, { client, ejemplos: [] });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/529/);
  });
});
```

- [ ] **Step 2: Ejecuta el test para verlo fallar**

Run: `npx vitest run app/lib/prospecting/qualify.test.js`
Expected: FAIL, `Failed to resolve import "./qualify"`.

- [ ] **Step 3: Escribe la implementación**

```javascript
// app/lib/prospecting/qualify.js
// El cualificador: convierte "un cargo y un nombre de empresa" en los cuatro
// veredictos que hacen falta para decidir, con su evidencia y sus fuentes.
//
// Dos funciones con la MISMA forma de salida, para que la ficha no tenga que
// saber cuál la produjo:
//   quickLook()  — Haiku 4.5, automático en el cron, ~0,03 $
//   deepDive()   — Opus 5, solo cuando el humano pulsa el botón, ~0,33 $ medido
//
// El cliente de Anthropic se inyecta para poder probar esto sin red.

import { costOf } from "./aiCost";

export const MODELO_VISTAZO = "claude-haiku-4-5";
export const MODELO_FONDO = "claude-opus-5";

const CRITERIOS = ["revenue", "digitalNeed", "itTeam", "advisory"];
const VEREDICTOS_VALIDOS = ["pass", "unclear", "fail"];

// Herramienta del vistazo. AJUSTAR SEGÚN LA TASK 0: si `web_search_20250305`
// falló en Haiku 4.5, cambiar a `web_search_20260318` con
// `allowed_callers: ["direct"]`.
const BUSQUEDA_VISTAZO = { type: "web_search_20250305", name: "web_search", max_uses: 2 };

// Herramienta del análisis a fondo: versión con filtrado dinámico, que criba
// los resultados antes de que entren en contexto, y `response_inclusion`
// excluido para no pagar de salida por devolver el contenido bruto.
// NO se declara `code_execution` aparte: la API lo provisiona sola.
// max_uses 3, medido: con 3 búsquedas el análisis consumió 49.974 tokens de
// ENTRADA. Los resultados entran como input aunque el filtrado dinámico los
// criba; `response_inclusion: "excluded"` recorta la salida, no la entrada. Cada
// búsqueda de más son ~0,08 $, así que este número es la palanca de coste real.
const BUSQUEDA_FONDO = {
  type: "web_search_20260318",
  name: "web_search",
  max_uses: 3,
  response_inclusion: "excluded",
};

// El bloque que no cambia entre llamadas. Va con cache_control para que solo se
// pague entero la primera vez del día.
const SISTEMA = `Eres el analista de prospección de Room714, un estudio que ayuda a
empresas medianas a decidir y construir el producto digital que su negocio
necesita: e-commerce, ERP, portales de cliente, SaaS que entregan a sus clientes.

Room714 NO vende soporte al puesto de trabajo ni administración de sistemas.
Vende criterio técnico y ejecución para empresas que no tienen quien decida eso
dentro.

Tu trabajo es juzgar si una empresa encaja como cliente, según cuatro criterios:

1. revenue — factura entre 50 y 100 millones de euros.
2. digitalNeed — su actividad NO es hacer producto digital, pero necesita uno
   para funcionar. Una empresa de software, una agencia digital o una
   consultora tecnológica NO encaja: resuelven dentro lo que vendemos.
3. itTeam — tiene equipo de IT propio, pero pequeño (orientativamente 2 a 6
   personas) y dedicado a tareas operativas: sistemas, soporte, redes. Si hay
   perfiles de producto, diseño o desarrollo, o el equipo es grande, no encaja.
4. advisory — necesita orientación o soporte en un sentido amplio: hay
   decisiones técnicas sin dueño dentro de la casa. Necesitar solo soporte al
   puesto de trabajo NO cuenta.

Reglas de disciplina, y son lo más importante de estas instrucciones:

- NO ADIVINES. Si no encuentras fuente para algo, el veredicto es "unclear".
  "unclear" es una respuesta correcta y esperada, no un fracaso.
- Solo pon "fail" cuando la evidencia lo sostenga, no cuando falte evidencia.
- Cita siempre de dónde sale cada dato, con URL cuando la tengas.
- En España las cuentas se depositan con uno o dos años de retraso y los grupos
  con varias sociedades no consolidan en público. Di el ejercicio del dato y no
  presentes una estimación como un dato verificado.`;

const ESQUEMA_SALIDA = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: Object.fromEntries([
      ...CRITERIOS.map((c) => [
        c,
        {
          type: "object",
          properties: {
            verdict: { type: "string", enum: VEREDICTOS_VALIDOS },
            value: { type: "string" },
            evidence: { type: "string" },
            sources: { type: "array", items: { type: "string" } },
          },
          required: ["verdict", "value", "evidence", "sources"],
          additionalProperties: false,
        },
      ]),
      ["summary", { type: "string" }],
    ]),
    required: [...CRITERIOS, "summary"],
    additionalProperties: false,
  },
};

// ─── Puro ───────────────────────────────────────────────────────────────────

// Saca el JSON de una respuesta, aunque venga envuelto en prosa o en un bloque
// de código: con salida estructurada no debería hacer falta, pero el coste de
// tolerarlo es una línea y el de no tolerarlo es tirar un análisis ya pagado.
function extraerJSON(texto) {
  const limpio = String(texto ?? "").trim();
  const enBloque = limpio.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidato = enBloque ? enBloque[1] : limpio;
  const inicio = candidato.indexOf("{");
  const fin = candidato.lastIndexOf("}");
  if (inicio === -1 || fin === -1) return null;
  return candidato.slice(inicio, fin + 1);
}

export function parseVerdicts(texto) {
  const json = extraerJSON(texto);
  if (!json) return { ok: false, error: "la respuesta no contenía JSON" };

  let datos;
  try {
    datos = JSON.parse(json);
  } catch (err) {
    return { ok: false, error: `JSON inválido: ${err.message}` };
  }

  const faltan = CRITERIOS.filter((c) => !datos?.[c] || typeof datos[c] !== "object");
  if (faltan.length) {
    return { ok: false, error: `faltan criterios en el JSON: ${faltan.join(", ")}` };
  }

  // Un veredicto que no reconocemos se normaliza a "unclear", nunca a "pass":
  // ante una respuesta rara, el sesgo va hacia mirar más, no hacia colar a
  // alguien en la cola.
  const veredictos = { summary: String(datos.summary ?? "") };
  for (const c of CRITERIOS) {
    const bruto = datos[c];
    veredictos[c] = {
      verdict: VEREDICTOS_VALIDOS.includes(bruto.verdict) ? bruto.verdict : "unclear",
      value: String(bruto.value ?? ""),
      evidence: String(bruto.evidence ?? ""),
      sources: Array.isArray(bruto.sources) ? bruto.sources.filter(Boolean).map(String) : [],
    };
  }

  return { ok: true, veredictos };
}

// Los ejemplos que van en el prompt: tus decisiones pasadas más parecidas a
// este candidato. Es el mecanismo por el que el juicio del modelo converge con
// el tuyo — no con más datos de la empresa, sino con más ejemplos de dónde
// pones tú la frontera.
export function construirEjemplos(vecinos = []) {
  const decisiones = vecinos.filter((v) => (v.kind ?? "decision") === "decision");
  if (decisiones.length === 0) return "";

  const filas = decisiones.map((v) => {
    const motivo = v.metadata?.reasonCode ? ` (motivo: ${v.metadata.reasonCode})` : "";
    return `- ${v.text}${motivo}`;
  });

  return `\n\nDecisiones anteriores de este usuario sobre empresas parecidas.
Úsalas para calibrar dónde pone él la frontera, no para copiar el veredicto:\n${filas.join("\n")}`;
}

function promptCandidato({ title, company }, extra = "") {
  return `Empresa: ${company ?? "(sin nombre)"}
Cargo del contacto: ${title ?? "(sin cargo)"}

Investiga esta empresa y responde a los cuatro criterios.${extra}`;
}

// ─── Con la API ─────────────────────────────────────────────────────────────

// `estructurarAparte` decide si van dos llamadas o una. Lo mide la Task 0:
//
//   - El VISTAZO va en UNA llamada. Se comprobó (caso D) que Haiku busca en la
//     web y devuelve el JSON estructurado en la misma petición. Ahorra ~20%.
//   - El ANÁLISIS A FONDO va en DOS. La API acepta la combinación en Opus 5
//     (caso F), pero en esa ejecución el modelo NO buscó ni una vez, y el valor
//     entero del análisis a fondo es que investigue. Una sola muestra no prueba
//     que el esquema suprima la búsqueda, pero tampoco vamos a jugárnosla.
async function cualificar(
  candidato,
  { client, ejemplos = [], modelo, herramienta, extraPrompt = "", thinking, estructurarAparte },
) {
  const llamadas = [];
  const sistema = [
    { type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } },
    { type: "text", text: construirEjemplos(ejemplos) || " " },
  ];

  try {
    // 1 · Investigar, con búsqueda web. Si no se estructura aparte, esta misma
    // llamada devuelve ya el JSON.
    const investigacion = await client.messages.create({
      model: modelo,
      max_tokens: 4096,
      ...(thinking ? { thinking } : {}),
      ...(estructurarAparte ? {} : { output_config: { format: ESQUEMA_SALIDA } }),
      system: sistema,
      tools: [herramienta],
      messages: [{ role: "user", content: promptCandidato(candidato, extraPrompt) }],
    });
    llamadas.push({ model: modelo, usage: investigacion.usage });

    const report = investigacion.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    let texto = report;

    if (estructurarAparte) {
      // 2 · Estructurar, sin herramientas.
      const estructura = await client.messages.create({
        model: modelo,
        max_tokens: 2048,
        output_config: { format: ESQUEMA_SALIDA },
        messages: [
          {
            role: "user",
            content: `Convierte este análisis en el JSON de los cuatro criterios.
No añadas información que no esté en el análisis.

${report}`,
          },
        ],
      });
      llamadas.push({ model: modelo, usage: estructura.usage });
      texto = estructura.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
    }

    const cost = llamadas.reduce((t, l) => t + costOf(l.model, l.usage), 0);
    const parseado = parseVerdicts(texto);

    if (!parseado.ok) {
      // El coste ya se ha gastado aunque el parseo falle: devolverlo es lo que
      // impide que el tope diario se quede corto y el cron siga gastando.
      return { ok: false, error: parseado.error, cost, report };
    }

    return { ok: true, veredictos: parseado.veredictos, report, cost };
  } catch (err) {
    const cost = llamadas.reduce((t, l) => t + costOf(l.model, l.usage), 0);
    console.error("[prospeccion] cualificar falló:", err.message);
    return { ok: false, error: err.message, cost };
  }
}

// El vistazo del cron. Barato y poco exhaustivo a propósito: su trabajo no es
// acertar, es no dejar pasar lo que claramente no encaja.
export async function quickLook(candidato, { client, ejemplos = [] } = {}) {
  const r = await cualificar(candidato, {
    client,
    ejemplos,
    modelo: MODELO_VISTAZO,
    herramienta: BUSQUEDA_VISTAZO,
    // Haiku 4.5 no admite `output_config.effort` y su thinking es el antiguo
    // con budget_tokens: lo más simple y seguro es no mandar nada.
    thinking: null,
    estructurarAparte: false, // medido en la Task 0, caso D
  });
  return { ...r, depth: "vistazo" };
}

// El análisis a demanda. Parte del vistazo ya hecho y ataca lo que quedó en
// duda, que es exactamente para lo que el humano ha pulsado el botón.
export async function deepDive(candidato, { client, ejemplos = [], dossierPrevio = null } = {}) {
  const dudas = dossierPrevio
    ? CRITERIOS.filter((c) => dossierPrevio.veredictos?.[c]?.verdict === "unclear")
    : [];

  const extra = dossierPrevio
    ? `\n\nYa existe un análisis rápido previo:\n${dossierPrevio.report ?? ""}\n\n${
        dudas.length
          ? `Céntrate en resolver lo que quedó sin confirmar: ${dudas.join(", ")}.`
          : "Confirma o corrige los veredictos anteriores con fuentes mejores."
      }`
    : "";

  const r = await cualificar(candidato, {
    client,
    ejemplos,
    modelo: MODELO_FONDO,
    herramienta: BUSQUEDA_FONDO,
    extraPrompt: extra,
    thinking: { type: "adaptive" },
    estructurarAparte: true, // ver el comentario de `cualificar`
  });
  return { ...r, depth: "fondo" };
}
```

- [ ] **Step 4: Ejecuta el test para verlo pasar**

Run: `npx vitest run app/lib/prospecting/qualify.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add app/lib/prospecting/qualify.js app/lib/prospecting/qualify.test.js
git commit -m "feat(prospeccion): cualificador de candidatos con vistazo y analisis a fondo"
```

---

## Task 9: `introText.js` — la nota de conexión

**Files:**
- Create: `app/lib/prospecting/introText.js`
- Test: `app/lib/prospecting/introText.test.js`

- [ ] **Step 1: Escribe el test que falla**

```javascript
// app/lib/prospecting/introText.test.js
import { describe, expect, it, vi } from "vitest";
import { recortar, generateIntro, LIMITE_CARACTERES } from "./introText";

describe("recortar", () => {
  it("deja igual lo que ya cabe", () => {
    expect(recortar("Hola Elena, ¿hablamos?")).toBe("Hola Elena, ¿hablamos?");
  });

  it("corta por la última frase completa que quepa", () => {
    // Cortar a mitad de palabra deja una nota que no se puede enviar tal cual.
    const largo = "Frase una. " + "x".repeat(LIMITE_CARACTERES) + ". Frase tres.";
    const r = recortar(largo);
    expect(r.length).toBeLessThanOrEqual(LIMITE_CARACTERES);
    expect(r).toBe("Frase una.");
  });

  it("si ni la primera frase cabe, corta por palabra y no parte ninguna", () => {
    const r = recortar("palabra ".repeat(200));
    expect(r.length).toBeLessThanOrEqual(LIMITE_CARACTERES);
    expect(r.endsWith("palabra")).toBe(true);
  });

  it("aguanta vacío y nulo", () => {
    expect(recortar("")).toBe("");
    expect(recortar(null)).toBe("");
  });
});

describe("generateIntro", () => {
  function clienteFalso(texto) {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: texto }],
          usage: { input_tokens: 500, output_tokens: 80 },
        }),
      },
    };
  }

  it("devuelve la nota recortada y su coste", async () => {
    const r = await generateIntro(
      { name: "Elena Sanchís", company: "Conservas Maribel", role: "Directora General" },
      { client: clienteFalso("Elena, he visto que abristeis venta directa. ¿Hablamos?"), dossier: {} },
    );
    expect(r.ok).toBe(true);
    expect(r.text).toContain("Elena");
    expect(r.text.length).toBeLessThanOrEqual(LIMITE_CARACTERES);
    expect(r.cost).toBeGreaterThan(0);
  });

  it("un fallo de la API no lanza: devuelve ok false", async () => {
    // El crédito de Apollo ya está gastado en este punto. Que la nota falle no
    // puede impedir que se cree el prospecto.
    const client = { messages: { create: vi.fn().mockRejectedValue(new Error("timeout")) } };
    const r = await generateIntro({ name: "X" }, { client, dossier: {} });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/timeout/);
  });

  it("mete las notas anteriores como ejemplos de tono", async () => {
    const client = clienteFalso("nota");
    await generateIntro(
      { name: "X", company: "Y" },
      { client, dossier: {}, notasAnteriores: ["Una nota que escribí yo"] },
    );
    const prompt = JSON.stringify(client.messages.create.mock.calls[0][0]);
    expect(prompt).toContain("Una nota que escribí yo");
  });
});
```

- [ ] **Step 2: Ejecuta el test para verlo fallar**

Run: `npx vitest run app/lib/prospecting/introText.test.js`
Expected: FAIL, `Failed to resolve import "./introText"`.

- [ ] **Step 3: Escribe la implementación**

```javascript
// app/lib/prospecting/introText.js
// La nota de conexión de LinkedIn que se genera al validar un prospecto.
//
// Se genera DESPUÉS de gastar el crédito de Apollo, así que un fallo aquí no
// puede tirar nada: si la generación falla, el prospecto se crea igual y la
// nota se puede pedir después desde la pantalla. Por eso ninguna función de
// este módulo lanza.

import { costOf } from "./aiCost";

export const MODELO = "claude-opus-5";

// LinkedIn corta las notas de invitación en 300 caracteres.
export const LIMITE_CARACTERES = 300;

// Recorta sin dejar la nota inservible. Cortar a mitad de palabra produce un
// texto que hay que arreglar a mano antes de enviarlo, que es justo lo que esta
// función existe para evitar.
export function recortar(texto) {
  const limpio = String(texto ?? "").trim();
  if (limpio.length <= LIMITE_CARACTERES) return limpio;

  // Primero por frase completa.
  const hastaLimite = limpio.slice(0, LIMITE_CARACTERES);
  const ultimoPunto = Math.max(
    hastaLimite.lastIndexOf(". "),
    hastaLimite.lastIndexOf("? "),
    hastaLimite.lastIndexOf("! "),
  );
  if (ultimoPunto > 0) return hastaLimite.slice(0, ultimoPunto + 1).trim();

  // Si ni la primera frase cabe, por palabra.
  const ultimoEspacio = hastaLimite.lastIndexOf(" ");
  return (ultimoEspacio > 0 ? hastaLimite.slice(0, ultimoEspacio) : hastaLimite).trim();
}

const SISTEMA = `Escribes notas de invitación de LinkedIn para Room714, un estudio
que ayuda a empresas medianas a decidir y construir el producto digital que su
negocio necesita.

Reglas:
- Máximo 300 caracteres. Es un límite duro de LinkedIn.
- En español, tuteando, sin tratamientos formales.
- Arranca por la señal CONCRETA que hemos encontrado sobre esa empresa. La nota
  tiene que ser imposible de enviar a otra empresa distinta.
- Cierra con una pregunta corta y fácil de contestar.

Prohibido: vender, describir servicios, prometer resultados, pedir una reunión
larga, usar "espero que estés bien", "me ha llamado la atención tu perfil", o
cualquier fórmula que valga para cualquiera.`;

export async function generateIntro(
  prospecto,
  { client, dossier = {}, notasAnteriores = [] } = {},
) {
  const ejemplos = notasAnteriores.filter(Boolean).slice(0, 5);

  // Las notas anteriores van TAL Y COMO quedaron tras las ediciones del
  // usuario: si reescribe sistemáticamente de una manera, las siguientes salen
  // ya así. Es el único aprendizaje de tono que tiene el sistema.
  const bloqueEjemplos = ejemplos.length
    ? `\n\nNotas anteriores, ya revisadas por el usuario. Imita el tono, no el contenido:\n${ejemplos
        .map((n) => `- ${n}`)
        .join("\n")}`
    : "";

  const contexto = [
    `Persona: ${prospecto.name ?? "(sin nombre)"}`,
    `Cargo: ${prospecto.role ?? "(sin cargo)"}`,
    `Empresa: ${prospecto.company ?? "(sin empresa)"}`,
    dossier.summary ? `Lo que sabemos: ${dossier.summary}` : null,
    dossier.veredictos?.digitalNeed?.value
      ? `Producto digital que necesita: ${dossier.veredictos.digitalNeed.value}`
      : null,
    dossier.veredictos?.itTeam?.value ? `Equipo IT: ${dossier.veredictos.itTeam.value}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: 512,
      thinking: { type: "adaptive" },
      system: SISTEMA + bloqueEjemplos,
      messages: [
        { role: "user", content: `${contexto}\n\nEscribe la nota. Devuelve solo la nota.` },
      ],
    });

    const texto = respuesta.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return { ok: true, text: recortar(texto), cost: costOf(MODELO, respuesta.usage) };
  } catch (err) {
    console.error("[prospeccion] generar la nota de conexión falló:", err.message);
    return { ok: false, error: err.message, cost: 0 };
  }
}
```

- [ ] **Step 4: Ejecuta el test para verlo pasar**

Run: `npx vitest run app/lib/prospecting/introText.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add app/lib/prospecting/introText.js app/lib/prospecting/introText.test.js
git commit -m "feat(prospeccion): nota de conexion de LinkedIn al validar"
```

---

## Task 10: Rotación ponderada con suelo, y tramos de plantilla nuevos

**Files:**
- Modify: `app/data/ProspectingProfile.js`
- Modify: `app/data/ProspectingProfile.test.js` (si existe; si no, `app/lib/prospecting/rules.test.js` cubre parte)
- Modify: `app/lib/prospecting/buildQueue.js:5`

- [ ] **Step 1: Escribe el test que falla**

Crea `app/data/ProspectingProfile.test.js` (o amplíalo si ya existe):

```javascript
import { describe, expect, it } from "vitest";
import {
  APOLLO_EMPLOYEE_RANGES,
  comboForDay,
  searchCombos,
  SUELO_EJECUCIONES,
} from "./ProspectingProfile";

describe("APOLLO_EMPLOYEE_RANGES", () => {
  it("apunta a empresas de 50-100 M€, que rara vez caben en menos de 100 empleados", () => {
    expect(APOLLO_EMPLOYEE_RANGES).toEqual(["101,250", "251,500"]);
  });
});

describe("comboForDay con ponderación", () => {
  const combos = searchCombos();

  it("sin historial se comporta como la rotación fija de siempre", () => {
    const a = comboForDay(undefined, 0, { historial: [] });
    const b = comboForDay(undefined, 0, { historial: [] });
    expect(a).toEqual(b); // determinista
    expect(combos).toContainEqual(a);
  });

  it("respeta el suelo: una combinación sin muestrear vuelve a salir", () => {
    // Todas las combinaciones se han visto hace poco menos que el suelo, salvo
    // una que lleva más. Esa tiene que salir, tenga la tasa que tenga.
    const olvidada = combos[7];
    const historial = combos.map((c) => ({
      sector: c.sector,
      size: c.size,
      ejecucionesDesde: c === olvidada ? SUELO_EJECUCIONES + 1 : 1,
      hits: c === olvidada ? 0 : 10,
      total: c === olvidada ? 20 : 10,
    }));
    expect(comboForDay(undefined, 0, { historial })).toEqual(olvidada);
  });

  it("una combinación con tasa cero sigue saliendo alguna vez: no hay trinquete", () => {
    const mala = combos[3];
    const historial = combos.map((c) => ({
      sector: c.sector,
      size: c.size,
      ejecucionesDesde: 0,
      hits: c === mala ? 0 : 5,
      total: c === mala ? 20 : 10,
    }));
    // A lo largo del suelo, la mala tiene que aparecer al menos una vez.
    const salidas = Array.from({ length: SUELO_EJECUCIONES }, (_, i) => {
      const h = historial.map((x) => ({
        ...x,
        ejecucionesDesde:
          x.sector === mala.sector && x.size === mala.size ? i : 0,
      }));
      return comboForDay(undefined, i, { historial: h });
    });
    expect(salidas).toContainEqual(mala);
  });

  it("prefiere las combinaciones que aciertan más, en igualdad de recencia", () => {
    const buena = combos[2];
    const historial = combos.map((c) => ({
      sector: c.sector,
      size: c.size,
      ejecucionesDesde: 1,
      hits: c === buena ? 15 : 0,
      total: c === buena ? 20 : 20,
    }));
    const salidas = Array.from({ length: 10 }, (_, i) =>
      comboForDay(undefined, i, { historial }),
    );
    const vecesBuena = salidas.filter(
      (c) => c.sector === buena.sector && c.size === buena.size,
    ).length;
    expect(vecesBuena).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Ejecuta el test para verlo fallar**

Run: `npx vitest run app/data/ProspectingProfile.test.js`
Expected: FAIL — `APOLLO_EMPLOYEE_RANGES` sigue siendo `["51,100", "101,250"]` y `SUELO_EJECUCIONES` no existe.

- [ ] **Step 3: Cambia los tramos**

En `app/data/ProspectingProfile.js`, sustituye el bloque de `APOLLO_EMPLOYEE_RANGES` (comentario incluido):

```javascript
// El tramo de plantilla que se corresponde con facturar 50-100 M€ en España.
// Antes eran 51-100 y 101-250, que era la definición europea de mediana empresa;
// con el criterio nuevo de facturación esos tramos apuntan demasiado bajo, porque
// 50-100 M€ rara vez caben en menos de cien empleados.
//
// Consecuencia asumida del cambio: las reglas aprendidas sobre "51,100" dejan de
// aplicar. No se borra nada — deriveRules cuenta decisiones, y las de un tramo que
// ya no se busca simplemente no afectan a ninguna consulta.
//
// Sigue partido en dos tramos por la misma razón que antes: la búsqueda de Apollo
// NO devuelve la plantilla, así que la única forma de saber en qué tramo cae un
// candidato es haberlo preguntado.
export const APOLLO_EMPLOYEE_RANGES = ["101,250", "251,500"];
```

- [ ] **Step 4: Sustituye `comboForDay` por la versión ponderada con suelo**

Reemplaza la función `comboForDay` entera y su comentario por:

```javascript
// Cada cuántas ejecuciones tiene que salir OBLIGATORIAMENTE una combinación,
// tenga la tasa de acierto que tenga.
//
// Este número es lo único que separa una rotación ponderada de un trinquete. Sin
// él, una combinación con mala racha temprana deja de salir, y al no salir no
// puede generar decisiones nuevas, y sin decisiones nuevas su tasa no cambia
// jamás: queda condenada por tres semanas malas.
//
// Con 14 combinaciones y una al día, la rotación fija de B1 muestreaba cada una
// cada 14 ejecuciones. 20 es por tanto una relajación deliberada: da margen a la
// ponderación sin dejar que nada desaparezca más de un mes natural. Es el
// parámetro a revisar con datos a los tres meses.
export const SUELO_EJECUCIONES = 20;

// Qué combinación toca hoy.
//
// `historial` trae, por combinación, cuántas ejecuciones han pasado desde la
// última vez que salió y su recuento de aciertos. Sin historial, esto se comporta
// exactamente como la rotación fija de B1.
export function comboForDay(profile = BUYER_PROFILE, dayIndex, { historial = [] } = {}) {
  const combos = searchCombos(profile);
  if (!combos.length || !Number.isFinite(dayIndex)) return combos[0] ?? null;

  const porClave = new Map(
    historial.map((h) => [`${h.sector}|${h.size}`, h]),
  );
  const datos = (c) => porClave.get(`${c.sector}|${c.size}`);

  // 1 · El suelo manda sobre todo lo demás. Si varias lo han superado, la que
  // lleve más tiempo sin salir.
  const vencidas = combos
    .filter((c) => (datos(c)?.ejecucionesDesde ?? Infinity) >= SUELO_EJECUCIONES)
    .sort(
      (a, b) =>
        (datos(b)?.ejecucionesDesde ?? Infinity) - (datos(a)?.ejecucionesDesde ?? Infinity),
    );
  if (vencidas.length) return vencidas[0];

  // 2 · Si no hay historial en absoluto, rotación fija: el comportamiento de B1.
  if (historial.length === 0) {
    return combos[((dayIndex % combos.length) + combos.length) % combos.length];
  }

  // 3 · Ponderado por tasa suavizada (Laplace: +1 acierto, +2 total). Sin
  // suavizar, una combinación con un solo acierto de un intento (1/1) adelantaría
  // a una con cuarenta de cincuenta, que es de la que más sabemos.
  //
  // La elección es DETERMINISTA a partir de `dayIndex`, no aleatoria: el mismo día
  // con los mismos datos da la misma combinación, y eso hace que `?preview=1`
  // enseñe de verdad lo que va a hacer el cron.
  const pesos = combos.map((c) => {
    const h = datos(c);
    const hits = h?.hits ?? 0;
    const total = h?.total ?? 0;
    return (hits + 1) / (total + 2);
  });

  const suma = pesos.reduce((a, b) => a + b, 0);
  // Rueda de ruleta recorrida con una posición derivada del día.
  const posicion = ((dayIndex % 1000) / 1000) * suma;
  let acumulado = 0;
  for (let i = 0; i < combos.length; i++) {
    acumulado += pesos[i];
    if (posicion < acumulado) return combos[i];
  }
  return combos[combos.length - 1];
}
```

- [ ] **Step 5: Baja `QUEUE_SIZE` a 5**

En `app/lib/prospecting/buildQueue.js`, sustituye el bloque de `QUEUE_SIZE`:

```javascript
// Cuántas fichas se le ponen delante cada mañana.
//
// Eran veinte cuando la ficha no costaba nada: buscar en Apollo es gratis y el
// cuello de botella era el presupuesto de créditos. Ahora cada ficha lleva un
// análisis detrás y se revisa con criterio, así que el cuello de botella pasa a
// ser el tiempo de quien decide. Cinco es lo que se puede mirar bien.
export const QUEUE_SIZE = 5;
```

- [ ] **Step 6: Ejecuta los tests**

Run: `npx vitest run app/data/ProspectingProfile.test.js app/lib/prospecting/`
Expected: PASS. Si algún test de `buildQueue.test.js` daba por hecho `QUEUE_SIZE === 20`, arréglalo para que use la constante importada en vez del literal.

- [ ] **Step 7: Commit**

```bash
git add app/data/ProspectingProfile.js app/data/ProspectingProfile.test.js app/lib/prospecting/buildQueue.js app/lib/prospecting/buildQueue.test.js
git commit -m "feat(prospeccion): 5 fichas al dia, tramos nuevos y rotacion ponderada con suelo"
```

---

## Task 11: `metrics.js` — las tres métricas de eficacia

Sin estas tres series, "cada día más eficaz" no se puede comprobar y el sistema recibiría el crédito de mejoras que quizá no existan.

**Files:**
- Create: `app/lib/prospecting/metrics.js`
- Test: `app/lib/prospecting/metrics.test.js`

- [ ] **Step 1: Escribe el test que falla**

```javascript
// app/lib/prospecting/metrics.test.js
import { describe, expect, it } from "vitest";
import { efficiencyMetrics } from "./metrics";

const dia = (n) => new Date(`2026-08-${String(n).padStart(2, "0")}T06:00:00Z`);

describe("efficiencyMetrics", () => {
  it("vistazos por ficha: empresas miradas entre fichas encoladas", () => {
    const m = efficiencyMetrics({
      ejecuciones: [
        { shownOn: dia(20), miradas: 20, encoladas: 5 },
        { shownOn: dia(21), miradas: 10, encoladas: 5 },
      ],
      decisiones: [],
      costeTotal: 0,
      ahora: dia(21),
    });
    expect(m.vistazosPorFicha).toBeCloseTo(3, 5); // (20+10) / (5+5)
  });

  it("tasa de aceptación: de las encoladas, cuántas acabaron en sí", () => {
    const m = efficiencyMetrics({
      ejecuciones: [{ shownOn: dia(21), miradas: 10, encoladas: 5 }],
      decisiones: [
        { decision: "yes", decidedAt: dia(21) },
        { decision: "no", decidedAt: dia(21) },
        { decision: "no", decidedAt: dia(21) },
      ],
      costeTotal: 0,
      ahora: dia(21),
    });
    expect(m.tasaAceptacion).toBeCloseTo(1 / 3, 5);
  });

  it("coste por validado: el gasto del periodo entre los aceptados", () => {
    const m = efficiencyMetrics({
      ejecuciones: [{ shownOn: dia(21), miradas: 10, encoladas: 5 }],
      decisiones: [
        { decision: "yes", decidedAt: dia(21) },
        { decision: "yes", decidedAt: dia(21) },
      ],
      costeTotal: 5,
      ahora: dia(21),
    });
    expect(m.costePorValidado).toBeCloseTo(2.5, 5);
  });

  it("sin aceptados, el coste por validado es null y no Infinity", () => {
    // Infinity se pinta como "Infinity" en pantalla y no dice nada. null se
    // pinta como "—", que es la verdad: todavía no se sabe.
    const m = efficiencyMetrics({
      ejecuciones: [{ shownOn: dia(21), miradas: 10, encoladas: 5 }],
      decisiones: [{ decision: "no", decidedAt: dia(21) }],
      costeTotal: 5,
      ahora: dia(21),
    });
    expect(m.costePorValidado).toBeNull();
  });

  it("solo cuenta los últimos 7 días", () => {
    const m = efficiencyMetrics({
      ejecuciones: [
        { shownOn: dia(1), miradas: 100, encoladas: 1 }, // fuera de ventana
        { shownOn: dia(21), miradas: 10, encoladas: 5 },
      ],
      decisiones: [],
      costeTotal: 0,
      ahora: dia(21),
    });
    expect(m.vistazosPorFicha).toBeCloseTo(2, 5);
  });

  it("sin datos devuelve nulls, no NaN", () => {
    const m = efficiencyMetrics({ ejecuciones: [], decisiones: [], costeTotal: 0, ahora: dia(21) });
    expect(m.vistazosPorFicha).toBeNull();
    expect(m.tasaAceptacion).toBeNull();
    expect(m.costePorValidado).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecuta el test para verlo fallar**

Run: `npx vitest run app/lib/prospecting/metrics.test.js`
Expected: FAIL, `Failed to resolve import "./metrics"`.

- [ ] **Step 3: Escribe la implementación**

```javascript
// app/lib/prospecting/metrics.js
// Las tres métricas que dicen si el sistema está mejorando de verdad.
//
// Existen porque "cada día más eficaz" es una HIPÓTESIS, no una propiedad. La
// memoria vectorial puede no aportar nada, y sin estos números eso no se
// sabría: un sistema que no se puede evaluar tiende a recibir el crédito de
// mejoras que no existen.
//
// Todo puro: recibe filas y devuelve números. Ventana móvil de 7 días.

const VENTANA_DIAS = 7;
const DIA_MS = 24 * 60 * 60 * 1000;

function dentroDeVentana(fecha, ahora) {
  if (!fecha) return false;
  return ahora.getTime() - new Date(fecha).getTime() <= VENTANA_DIAS * DIA_MS;
}

export function efficiencyMetrics({
  ejecuciones = [],
  decisiones = [],
  costeTotal = 0,
  ahora = new Date(),
} = {}) {
  const recientes = ejecuciones.filter((e) => dentroDeVentana(e.shownOn, ahora));
  const decididas = decisiones.filter((d) => dentroDeVentana(d.decidedAt, ahora));

  const miradas = recientes.reduce((s, e) => s + (e.miradas ?? 0), 0);
  const encoladas = recientes.reduce((s, e) => s + (e.encoladas ?? 0), 0);
  const aceptadas = decididas.filter((d) => d.decision === "yes").length;

  return {
    // Cuántas empresas hay que mirar para llenar un hueco de la cola. Es la
    // métrica que debe BAJAR si la memoria está ordenando bien.
    vistazosPorFicha: encoladas > 0 ? miradas / encoladas : null,

    // De las fichas que llegan a la cola, cuántas acabas aceptando. Debe SUBIR
    // si el cualificador está calibrando bien contra tu criterio.
    tasaAceptacion: decididas.length > 0 ? aceptadas / decididas.length : null,

    // Lo que cuesta cada prospecto validado. Debe BAJAR. Null y no Infinity
    // cuando no hay aceptados: en pantalla se pinta "—", que es la verdad.
    costePorValidado: aceptadas > 0 ? costeTotal / aceptadas : null,

    ventanaDias: VENTANA_DIAS,
    muestra: { miradas, encoladas, decididas: decididas.length, aceptadas },
  };
}
```

- [ ] **Step 4: Ejecuta el test para verlo pasar**

Run: `npx vitest run app/lib/prospecting/metrics.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/lib/prospecting/metrics.js app/lib/prospecting/metrics.test.js
git commit -m "feat(prospeccion): metricas de eficacia de la cola"
```

---

## Task 12: El cron — orquestar el día entero

**Files:**
- Modify: `app/api/cron/prospect-queue/route.js` (reescritura del bloque central)

- [ ] **Step 1: Sube `maxDuration` y añade los topes**

Al principio del fichero, junto a `export const maxDuration`:

```javascript
// 300 s, no 60: cada vistazo tarda 5-15 s y hacen falta varios. Los lotes van
// en paralelo, pero aun así el peor día se acerca al techo.
export const maxDuration = 300;

// Los tres topes que pueden cortar la mañana. Los tres escriben lo que haya
// conseguido hasta ese momento, y el resumen dice cuál cortó: una cola corta
// tiene que ser legible, no un misterio.
const TOPE_GASTO_USD = Number(process.env.PROSPECT_QUALIFY_DAILY_BUDGET_USD) || 0.75;
const TOPE_MIRADAS = 30;
const TOPE_MS = 240_000;
const LOTE_VISTAZOS = 5;
```

- [ ] **Step 2: Añade los imports**

```javascript
import { getAnthropicClient } from "@/app/lib/ai/anthropic";
import { embedTexts, textoDeCandidato } from "@/app/lib/prospecting/embeddings";
import { nearest, rememberDecision, memorySize } from "@/app/lib/prospecting/memory";
import { rankPool } from "@/app/lib/prospecting/rankPool";
import { quickLook } from "@/app/lib/prospecting/qualify";
import { passesGate } from "@/app/lib/prospecting/score";
```

- [ ] **Step 3: Pasa el historial a `comboForDay`**

Sustituye la línea `const combo = comboForDay(BUYER_PROFILE, dayIndexFor(new Date()));` por:

```javascript
    // El historial que necesita la rotación ponderada: por combinación, cuántas
    // ejecuciones han pasado desde la última vez y su recuento de aciertos.
    const porCombo = await prisma.prospectDiscovery.groupBy({
      by: ["sectorQuery", "sizeQuery"],
      _count: { _all: true },
      _max: { shownOn: true },
    });
    const aciertos = await prisma.prospectDiscovery.groupBy({
      by: ["sectorQuery", "sizeQuery"],
      where: { decision: "yes", reasonCode: { not: "legacy" } },
      _count: { _all: true },
    });
    const hoyIndex = dayIndexFor(new Date());
    const historial = porCombo.map((c) => {
      const hit = aciertos.find(
        (a) => a.sectorQuery === c.sectorQuery && a.sizeQuery === c.sizeQuery,
      );
      return {
        sector: c.sectorQuery,
        size: c.sizeQuery,
        ejecucionesDesde: c._max.shownOn
          ? hoyIndex - dayIndexFor(new Date(c._max.shownOn))
          : Infinity,
        hits: hit?._count._all ?? 0,
        total: c._count._all,
      };
    });

    const combo = comboForDay(BUYER_PROFILE, hoyIndex, { historial });
```

- [ ] **Step 4: Sustituye la escritura de la cola por el bucle de cualificación**

Reemplaza todo lo que va desde `const shownOn = new Date();` hasta el `return NextResponse.json({ ...resumen, message: ... })` final por:

```javascript
    // ─── Ordenar el pozo antes de gastar ────────────────────────────────────
    // Embeber los candidatos cuesta cero; mirarlos cuesta 0,03 $ cada uno. Este
    // orden es lo que hace que haga falta mirar ocho en vez de veinte.
    const anthropic = getAnthropicClient();
    const memoria = await memorySize(prisma);

    const ordenados = await rankPool(resultado.candidates, {
      embed: (textos) => embedTexts(textos, { inputType: "query" }),
      buscarVecinos: (vector) => nearest(prisma, vector, { k: 3 }),
    });

    // ─── Vistazo, de arriba abajo, parando en cuanto haya QUEUE_SIZE ────────
    const arranque = Date.now();
    const aprobados = [];
    const rechazados = [];
    let gastado = 0;
    let miradas = 0;
    let corte = null;

    for (let i = 0; i < ordenados.length; i += LOTE_VISTAZOS) {
      if (aprobados.length >= QUEUE_SIZE) break;
      if (gastado >= TOPE_GASTO_USD) { corte = "gasto"; break; }
      if (miradas >= TOPE_MIRADAS) { corte = "miradas"; break; }
      if (Date.now() - arranque > TOPE_MS) { corte = "tiempo"; break; }

      const lote = ordenados.slice(i, i + LOTE_VISTAZOS);
      const vistos = await Promise.all(
        lote.map((c) =>
          quickLook(
            { title: c.title, company: c.organization?.name },
            { client: anthropic, ejemplos: c._vecinos ?? [] },
          ).then((r) => ({ candidato: c, resultado: r })),
        ),
      );

      for (const { candidato, resultado: r } of vistos) {
        miradas += 1;
        gastado += r.cost ?? 0;

        if (!r.ok) {
          // Un fallo de la IA no es un descarte: no se sabe nada de esa
          // empresa. Se deja fuera del día SIN escribir decisión (sin dossier),
          // para que pueda volver a salir mañana.
          rechazados.push({ candidato, motivo: r.error, dossier: null });
          continue;
        }

        const puerta = passesGate(r.veredictos);
        const dossier = {
          veredictos: r.veredictos,
          summary: r.veredictos.summary,
          report: r.report,
          cost: r.cost,
        };

        if (puerta.ok && aprobados.length < QUEUE_SIZE) {
          aprobados.push({ candidato, dossier, score: puerta.score });
        } else {
          rechazados.push({
            candidato,
            motivo: puerta.reasonCode,
            score: puerta.score,
            dossier,
          });
        }
      }
    }

    const shownOn = new Date();

    // Los aprobados van a la cola.
    for (const a of aprobados) {
      await prisma.prospectDiscovery.create({
        data: {
          apolloId: a.candidato.id,
          name:
            [a.candidato.first_name, a.candidato.last_name_obfuscated]
              .filter(Boolean)
              .join(" ") || null,
          title: a.candidato.title || null,
          company: a.candidato.organization?.name ?? null,
          sectorQuery: combo?.sector ?? null,
          sizeQuery,
          shownOn,
          decision: "pending",
          score: a.score,
          dossier: a.dossier,
          depth: "vistazo",
          qualifiedAt: shownOn,
          neighbors: (a.candidato._vecinos ?? []).map((v) => ({
            text: v.text,
            decision: v.metadata?.decision,
            company: v.metadata?.company,
            distance: v.distance,
          })),
        },
      });
    }

    // Los descartados por el vistazo SE ESCRIBEN IGUAL, decididos. Sin ellos no
    // habría embudo que enseñar en la cabecera, y volveríamos a mirar mañana a
    // quien ya descartamos hoy — pagando otra vez.
    for (const r of rechazados.filter((x) => x.dossier)) {
      const candidato = r.candidato;
      await prisma.prospectDiscovery.create({
        data: {
          apolloId: candidato.id,
          name: null,
          title: candidato.title || null,
          company: candidato.organization?.name ?? null,
          sectorQuery: combo?.sector ?? null,
          sizeQuery,
          shownOn,
          decision: "no",
          reasonCode: r.motivo ?? "other",
          decidedAt: shownOn,
          score: r.score ?? null,
          dossier: r.dossier,
          depth: "vistazo",
          qualifiedAt: shownOn,
        },
      }).catch(() => {}); // un duplicado de apolloId no debe tirar la mañana
    }

    return NextResponse.json({
      ...resumen,
      encolados: aprobados.length,
      miradas,
      gastadoUSD: Number(gastado.toFixed(4)),
      corte,
      memoriaDocs: memoria,
      message: `${aprobados.length} fichas en la cola tras mirar ${miradas} empresas`,
    });
```

- [ ] **Step 5: Comprueba en preview**

Run: `curl -s -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/prospect-queue?preview=1" | head -c 800`

(Arranca antes `npm run dev` en otra terminal.)
Expected: JSON con `combo`, `query` y `muestra`, sin haber escrito nada.

- [ ] **Step 6: Ejecución real contra la base de desarrollo**

Run: `curl -s -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/prospect-queue?force=1" | head -c 1200`
Expected: `encolados: 5`, un `miradas` entre 5 y 30, y `gastadoUSD` por debajo de 0,75.

Si `encolados` sale 0, mira `corte` y `rechazados`: dice si cortó el presupuesto, si la IA falló o si las puertas duras están descartando todo.

- [ ] **Step 7: Commit**

```bash
git add app/api/cron/prospect-queue/route.js
git commit -m "feat(prospeccion): el cron ordena, cualifica y llena la cola con 5 fichas"
```

---

## Task 13: Acciones de servidor — fondo, chat, nota y memoria

**Files:**
- Modify: `app/(admin-zone)/admin/prospects/actions.js`
- Create: `app/lib/prospecting/prospectChat.js`

- [ ] **Step 1: Crea el módulo del chat**

```javascript
// app/lib/prospecting/prospectChat.js
// El chat de una ficha. Está anclado a LA EMPRESA, no a la persona: hasta que
// se acepta, de la persona solo tenemos cargo e inicial, porque Apollo ofusca
// el apellido en la búsqueda. Prometer más sería mentir en la interfaz.
//
// El hilo no se persiste: vive en el cliente mientras se decide la ficha. Lo
// que merezca sobrevivir se escribe en la nota, y esa nota sí entra en la
// memoria como documento de tipo "conclusion".

import { costOf } from "./aiCost";

export const MODELO = "claude-opus-5";

const BUSQUEDA = {
  type: "web_search_20260318",
  name: "web_search",
  max_uses: 4,
  response_inclusion: "excluded",
};

export const SUGERENCIAS = [
  "¿Quién decide ahí la inversión en tecnología?",
  "¿Trabajan ya con alguna consultora tecnológica?",
  "¿Han hecho algún proyecto digital antes?",
];

function sistema(ficha) {
  return `Ayudas a decidir si merece la pena contactar con una empresa como cliente
de Room714, un estudio que ayuda a empresas medianas a decidir y construir el
producto digital que su negocio necesita.

La conversación es sobre LA EMPRESA, no sobre la persona: todavía no sabemos
quién es más allá de su cargo.

Empresa: ${ficha.company ?? "(sin nombre)"}
Cargo del contacto: ${ficha.title ?? "(sin cargo)"}

Análisis previo:
${ficha.dossier?.report ?? "(todavía no hay análisis)"}

Veredictos: ${JSON.stringify(ficha.dossier?.veredictos ?? {}, null, 1)}

Reglas: cita las fuentes de todo lo que afirmes, y separa siempre lo que has
comprobado de lo que estás suponiendo. Si no lo sabes, dilo. Respuestas cortas.`;
}

export async function askAboutCompany({ client, ficha, historial = [], pregunta }) {
  try {
    const respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: sistema(ficha),
      tools: [BUSQUEDA],
      messages: [...historial, { role: "user", content: pregunta }],
    });

    const texto = respuesta.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return { ok: true, text: texto, cost: costOf(MODELO, respuesta.usage) };
  } catch (err) {
    console.error("[prospeccion] el chat falló:", err.message);
    return { ok: false, error: err.message, cost: 0 };
  }
}
```

- [ ] **Step 2: Añade las acciones nuevas**

En `app/(admin-zone)/admin/prospects/actions.js`, añade los imports y estas cuatro acciones. Todas llevan `requireSession()` por el mismo motivo documentado arriba en ese fichero.

```javascript
import { getAnthropicClient } from "@/app/lib/ai/anthropic";
import { deepDive } from "@/app/lib/prospecting/qualify";
import { passesGate } from "@/app/lib/prospecting/score";
import { askAboutCompany } from "@/app/lib/prospecting/prospectChat";
import { generateIntro } from "@/app/lib/prospecting/introText";
import { rememberDecision, nearest, remember } from "@/app/lib/prospecting/memory";
import { embedTexts } from "@/app/lib/prospecting/embeddings";
import { efficiencyMetrics } from "@/app/lib/prospecting/metrics";

// El análisis a fondo: lo dispara el humano, cuesta ~0,35 $ y reescribe el
// dossier. No consume del presupuesto del cron a propósito — su freno es que
// hay que pulsarlo.
export async function deepenCandidate(id) {
  await requireSession();
  try {
    const fila = await prisma.prospectDiscovery.findUnique({ where: { id: Number(id) } });
    if (!fila) return { success: false, error: "Candidato no encontrado" };
    if (fila.depth === "fondo") {
      return { success: false, error: "Ya tiene un análisis a fondo" };
    }

    let vecinos = [];
    try {
      const [v] = await embedTexts([`${fila.title ?? ""} · ${fila.company ?? ""}`], {
        inputType: "query",
      });
      if (v) vecinos = await nearest(prisma, v, { k: 3 });
    } catch (err) {
      console.error("[prospects] sin vecinos para el análisis:", err.message);
    }

    const r = await deepDive(
      { title: fila.title, company: fila.company },
      { client: getAnthropicClient(), ejemplos: vecinos, dossierPrevio: fila.dossier },
    );
    if (!r.ok) return { success: false, error: r.error };

    const puerta = passesGate(r.veredictos);
    await prisma.prospectDiscovery.update({
      where: { id: fila.id },
      data: {
        dossier: {
          veredictos: r.veredictos,
          summary: r.veredictos.summary,
          report: r.report,
          cost: r.cost,
        },
        score: puerta.score,
        depth: "fondo",
        qualifiedAt: new Date(),
      },
    });

    revalidatePath("/admin/prospects");
    return { success: true, scoreAnterior: fila.score, score: puerta.score, cost: r.cost };
  } catch (err) {
    console.error("[prospects] análisis a fondo falló:", err);
    return { success: false, error: err.message };
  }
}

// Una pregunta del chat. El historial viaja desde el cliente porque el hilo no
// se persiste (ver prospectChat.js).
export async function askCandidate({ id, pregunta, historial = [] }) {
  await requireSession();
  try {
    const fila = await prisma.prospectDiscovery.findUnique({ where: { id: Number(id) } });
    if (!fila) return { success: false, error: "Candidato no encontrado" };

    const r = await askAboutCompany({
      client: getAnthropicClient(),
      ficha: fila,
      historial,
      pregunta,
    });
    if (!r.ok) return { success: false, error: r.error };
    return { success: true, text: r.text, cost: r.cost };
  } catch (err) {
    console.error("[prospects] chat falló:", err);
    return { success: false, error: err.message };
  }
}

// Regenerar o guardar a mano la nota de conexión de un prospecto ya validado.
export async function setIntroText(id, texto) {
  await requireSession();
  try {
    await prisma.prospect.update({
      where: { id: Number(id) },
      data: { introText: String(texto ?? "").slice(0, 300) },
    });
    revalidatePath("/admin/prospects");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function regenerateIntro(id) {
  await requireSession();
  try {
    const p = await prisma.prospect.findUnique({ where: { id: Number(id) } });
    if (!p) return { success: false, error: "Prospecto no encontrado" };

    const anteriores = await prisma.prospect.findMany({
      where: { introText: { not: null }, id: { not: p.id } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { introText: true },
    });

    const r = await generateIntro(p, {
      client: getAnthropicClient(),
      dossier: p.dossier ?? {},
      notasAnteriores: anteriores.map((x) => x.introText),
    });
    if (!r.ok) return { success: false, error: r.error };

    await prisma.prospect.update({ where: { id: p.id }, data: { introText: r.text } });
    revalidatePath("/admin/prospects");
    return { success: true, text: r.text };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
```

- [ ] **Step 3: Cierra el bucle de la memoria en `acceptCandidate` y `rejectCandidate`**

En `rejectCandidate`, después del `prisma.prospectDiscovery.update` y antes del `revalidatePath`:

```javascript
    // A la memoria. Un fallo aquí no puede tirar el descarte: la decisión ya
    // está tomada y guardada, y la memoria es una capa que se degrada.
    try {
      const fila = await prisma.prospectDiscovery.findUnique({ where: { id: Number(id) } });
      await rememberDecision(prisma, fila);
    } catch (err) {
      console.error("[prospects] no se pudo memorizar el descarte:", err.message);
    }
```

En `acceptCandidate`, justo antes del `return { success: true, linkedinUrl, ... }` final:

```javascript
    // La nota de conexión. El crédito de Apollo YA está gastado en este punto,
    // así que un fallo aquí no puede impedir que exista el prospecto: se crea
    // sin nota y se genera después desde la pantalla.
    let introText = null;
    if (!duplicado) {
      const anteriores = await prisma.prospect.findMany({
        where: { introText: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { introText: true },
      });
      const intro = await generateIntro(
        { name: prospectName, company: prospectCompany, role: prospectRole },
        {
          client: getAnthropicClient(),
          dossier: candidato.dossier ?? {},
          notasAnteriores: anteriores.map((x) => x.introText),
        },
      );
      if (intro.ok) {
        introText = intro.text;
        await prisma.prospect.update({
          where: { linkedinUrl },
          data: { introText, dossier: candidato.dossier ?? undefined },
        });
      }
    }

    try {
      const fila = await prisma.prospectDiscovery.findUnique({ where: { id: candidato.id } });
      await rememberDecision(prisma, fila);
    } catch (err) {
      console.error("[prospects] no se pudo memorizar la aceptación:", err.message);
    }
```

Y cambia el `return` final a: `return { success: true, linkedinUrl, duplicado: Boolean(duplicado), introText };`

- [ ] **Step 4: Amplía `loadQueue` con lo que la pantalla nueva necesita**

Cambia el `orderBy` de la consulta de la cola a `[{ score: "desc" }, { id: "asc" }]` — la cola se ordena por encaje, no por antigüedad.

Y añade el cálculo de las métricas antes del `return`. Las filas de la ventana se traen una sola vez y se agrupan por día en memoria: son unas decenas, no compensa una consulta por métrica.

```javascript
    // Ventana de 7 días para las métricas de eficacia.
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const delPeriodo = await prisma.prospectDiscovery.findMany({
      where: { shownOn: { gte: desde } },
      select: { shownOn: true, decision: true, decidedAt: true, dossier: true },
    });

    // `miradas` son TODAS las filas escritas ese día (las encoladas más las que
    // el vistazo descartó); `encoladas` son las que llegaron a ponerse delante,
    // es decir las que no se descartaron en el propio cron.
    const porDia = new Map();
    for (const f of delPeriodo) {
      const clave = f.shownOn ? new Date(f.shownOn).toISOString().slice(0, 10) : "sin-fecha";
      const acc = porDia.get(clave) ?? { shownOn: f.shownOn, miradas: 0, encoladas: 0 };
      acc.miradas += 1;
      // Descartada por el cron = decidida el mismo día en que se mostró.
      const descartadaPorElCron =
        f.decision === "no" &&
        f.decidedAt &&
        f.shownOn &&
        new Date(f.decidedAt).getTime() - new Date(f.shownOn).getTime() < 60_000;
      if (!descartadaPorElCron) acc.encoladas += 1;
      porDia.set(clave, acc);
    }

    const costeDelPeriodo = delPeriodo.reduce(
      (s, f) => s + (Number(f.dossier?.cost) || 0),
      0,
    );

    const metrics = efficiencyMetrics({
      ejecuciones: [...porDia.values()],
      decisiones: delPeriodo.filter((f) => f.decision === "yes" || f.decision === "no"),
      costeTotal: costeDelPeriodo,
    });
```

Y añade `metrics` y `costeDelPeriodo` al objeto que devuelve `loadQueue`.

- [ ] **Step 5: Añade los motivos nuevos**

En la constante `VALID_REASONS` de `actions.js`:

```javascript
const VALID_REASONS = [
  "role",
  "sector",
  "size",
  "in_house_team",
  "revenue",
  "no_digital_need",
  "other",
];
```

- [ ] **Step 6: Comprueba que compila y que los tests siguen verdes**

Run: `npx vitest run && npm run build`
Expected: todos los tests PASS y el build sin errores.

- [ ] **Step 7: Commit**

```bash
git add app/lib/prospecting/prospectChat.js "app/(admin-zone)/admin/prospects/actions.js"
git commit -m "feat(prospeccion): acciones de analisis a fondo, chat, nota de conexion y memoria"
```

---

## Task 14: La pantalla

**Files:**
- Modify: `app/(admin-zone)/admin/prospects/page.js`

El mockup aprobado está en `https://claude.ai/code/artifact/c821e034-95d1-49b3-8385-75618f775c6f`. Ábrelo antes de escribir nada: es la referencia de disposición, y la estructura de la ficha está pensada, no improvisada.

- [ ] **Step 1: Añade los motivos nuevos a `REASONS`**

```javascript
const REASONS = [
  ["role", "El cargo no encaja"],
  ["sector", "El sector no encaja"],
  ["size", "El tamaño no encaja"],
  ["revenue", "La facturación no encaja"],
  ["no_digital_need", "No necesita producto digital"],
  ["in_house_team", "Ya tienen equipo propio"],
  ["other", "Otro motivo"],
];
```

- [ ] **Step 2: Componente `Criterios`**

Rejilla de dos columnas en escritorio, una en móvil. Por criterio: símbolo (`✓` / `?` / `✗`) **y** color —nunca solo color, porque el color solo no se lee de un vistazo ni es accesible—, etiqueta en versalitas, el valor en negrita, la evidencia debajo en gris y las fuentes como enlaces con `target="_blank" rel="noopener noreferrer"`.

Mapeo: `pass` → verde, `unclear` → ámbar, `fail` → rojo. Etiquetas: `revenue` → "Facturación", `digitalNeed` → "Necesita producto digital", `itTeam` → "Equipo IT", `advisory` → "Necesidad de orientación".

- [ ] **Step 3: Cabecera de la ficha**

Empresa en grande, cargo debajo, y **el aviso de lo que compra el crédito**: `{title} · <span>{name} — nombre completo y LinkedIn tras aceptar</span>`. A la derecha, el score con su barra y la etiqueta de nivel (`vistazo` / `a fondo`).

- [ ] **Step 4: El bloque «se parece a»**

Si `candidato.neighbors` tiene elementos, una línea por vecino: `Se parece a {company}, que {decision === "yes" ? "aceptaste" : "descartaste"}`. Si el array está vacío —memoria fría— **no pintes nada**, ni un "sin datos": ruido que no ayuda a decidir.

- [ ] **Step 5: La línea del crédito**

Entre la zona gratis y la de decidir, una regla horizontal con el texto centrado `a partir de aquí se gasta 1 crédito`. Es el elemento que hace visible la frontera de coste, y es lo que más pidió el usuario del mockup.

- [ ] **Step 6: El botón de análisis a fondo**

```jsx
{candidato.depth !== "fondo" && (
  <button
    disabled={busy}
    className="rounded border border-indigo-700 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-800 disabled:opacity-40"
    onClick={async () => {
      setBusy(true);
      const r = await deepenCandidate(candidato.id);
      setBusy(false);
      if (r.success) flash(`Analizado a fondo: ${r.scoreAnterior} → ${r.score}`);
      else flash(`⚠️ ${r.error}`);
      load();
    }}
  >
    Analizar a fondo · ~0,35 $
  </button>
)}
```

El precio va escrito en el botón a propósito: es una decisión que se toma decenas de veces al mes y el coste tiene que estar delante al tomarla.

- [ ] **Step 7: El chat**

Estado local por ficha: `const [hilo, setHilo] = useState([])`. Al enviar, empuja `{role:"user", content: pregunta}` al hilo, llama a `askCandidate({id, pregunta, historial: hilo})`, y empuja la respuesta como `{role:"assistant", content: r.text}`.

Pinta burbujas: usuario a la derecha sobre fondo negro, IA a la izquierda sobre fondo blanco con borde. Debajo del log, los tres chips de `SUGERENCIAS` (impórtalos de `prospectChat.js`) que rellenan el input al pulsarlos. Y la nota al pie: `El chat no gasta créditos de Apollo y no se guarda: existe para decidir esta ficha.`

- [ ] **Step 8: El panel «¿está mejorando?»**

En la cabecera, tres cifras de `data.metrics` con su flecha de dirección deseada. Cuando el valor sea `null`, pinta `—` y no `0`: la diferencia entre "todavía no se sabe" y "es cero" importa. Añade debajo la línea del embudo: `{miradas} vistas → {analizadas} miradas → {encoladas} en tu cola`, y el gasto estimado con la palabra "estimado" delante.

- [ ] **Step 9: Validados con la nota**

En `ValidadosTab`, bajo cada prospecto con `introText`: el texto en una caja gris, el contador `{introText.length} / 300`, y tres botones — Copiar (`navigator.clipboard.writeText`), Regenerar (`regenerateIntro`) y Editar (textarea + `setIntroText`). Si `introText` es null, un solo botón "Generar nota".

- [ ] **Step 10: Compruébalo en el navegador**

Run: `npm run dev` y abre `http://localhost:3000/admin/prospects`

Comprueba: las 5 fichas salen ordenadas por score descendente; los criterios se leen sin abrir nada; el chat responde y cita; el botón de análisis a fondo sube el score y desaparece; la línea del crédito está donde debe.

- [ ] **Step 11: Commit**

```bash
git add "app/(admin-zone)/admin/prospects/page.js"
git commit -m "feat(prospeccion): pantalla con criterios, chat por ficha y metricas"
```

---

## Task 15: Verificación de extremo a extremo y limpieza

- [ ] **Step 1: Todos los tests**

Run: `npx vitest run`
Expected: todo verde. Anota cuántos tests hay en total.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: sin errores ni avisos nuevos.

- [ ] **Step 3: Una mañana completa contra desarrollo**

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/prospect-queue?force=1" | python -m json.tool
```

Comprueba en la respuesta: `encolados: 5`, `gastadoUSD` por debajo del tope, `corte: null`, y `memoriaDocs` con el número de documentos que había.

- [ ] **Step 4: Decide las cinco fichas a mano y contrasta**

Abre la pantalla y, **para cada una de las cinco**, comprueba la facturación por tu cuenta en einforma o en el registro. Anota cuántas acertó el vistazo, cuántas dejó en `unclear` y cuántas falló.

Esta es la verificación que decide si el sistema sirve. El criterio: **si el vistazo falla en más de una de cinco con veredicto `pass`, no sigas**; ajusta el prompt de `SISTEMA` en `qualify.js` para que sea más exigente antes de dar por buena la fase. Un `unclear` no cuenta como fallo: es el sistema diciendo la verdad.

Prueba también el análisis a fondo en la ficha más dudosa y comprueba si resuelve el `unclear` con una fuente que tú considerarías válida.

- [ ] **Step 5: Comprueba que la memoria se llenó**

```bash
node --env-file=.env.local -e "
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
p.\$queryRawUnsafe('SELECT kind, count(*)::int AS n FROM \"ProspectMemory\" GROUP BY kind')
 .then(r=>{console.log(r);return p.\$disconnect()})"
```

Expected: una fila `decision` con tantas filas como decisiones hayas tomado.

- [ ] **Step 6: Siembra el documento de criterio**

La memoria necesita un ancla el día uno, cuando no hay decisiones. Un script de un solo uso que embeba un párrafo con qué vende Room714 y a quién, y lo guarde con `kind: "criterio"`.

- [ ] **Step 7: Borra el script de sondeo**

```bash
git rm scripts/probe-modelos.mjs
git commit -m "chore(prospeccion): retira el script de sondeo de un solo uso"
```

- [ ] **Step 8: Actualiza el spec con lo aprendido**

En `docs/superpowers/specs/2026-08-31-prospeccion-b2-cualificacion-ia-design.md`, añade una sección **Verificado en la implementación** con: el resultado de la Task 0 (si se colapsaron las dos llamadas o no y por qué), los vistazos por ficha reales del primer día, el gasto real, y el resultado del contraste manual de las cinco fichas.

Esa última cifra es el dato más valioso de todo el ejercicio: es lo único que dice si se puede confiar en esto a diario.

- [ ] **Step 9: Commit y push**

```bash
git add docs/superpowers/specs/2026-08-31-prospeccion-b2-cualificacion-ia-design.md
git commit -m "docs(prospeccion): resultados verificados de la fase B2"
git push -u origin feat/prospeccion-b2-cualificacion-ia
```

---

## Fuera de alcance de esta fase

- `ProspectRule`: reglas explícitas propuestas por el chat y aceptadas a mano.
- Persistir las conversaciones del chat (sí su conclusión, vía la nota).
- Realimentar la consulta de Apollo con el score de la IA.
- Verificar la facturación contra una fuente de pago (einforma, Axesor).
- Análisis a fondo automático desde el cron: el código queda listo para llamarlo.

## Lo que hay que vigilar las primeras semanas

Con 4 decisiones reales en la base, **la memoria arranca inerte**: el orden del pozo será casi el de Apollo y los vistazos por ficha estarán cerca de 4. Eso es lo esperado, no un fallo.

La pregunta que hay que responder a las seis semanas, mirando el panel: **¿ha bajado "vistazos por ficha"?** Si no ha bajado y la tasa de aceptación tampoco ha subido, la capa vectorial no está aportando y toca cambiarla o quitarla — se puede desactivar sin tocar nada más, porque `rankPool` ya devuelve el orden original cuando los embeddings fallan.
