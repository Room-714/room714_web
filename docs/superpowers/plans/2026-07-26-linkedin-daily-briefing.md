# Briefing diario de tareas de LinkedIn — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar cada día laborable, a las 08:00 de Madrid, un correo con la lista cerrada de tareas manuales de LinkedIn, donde cada tarea se pueda ejecutar sin abrir nada más que el propio correo.

**Architecture:** Una tabla de slots (`linkedinSchedule.js`) es la única fuente de verdad sobre qué canal publica cada variante y qué acción le toca al otro canal. Una función pura (`buildDailyTasks`) convierte las variantes del día en tareas; un cron delgado consulta, construye y envía por Resend. Como a las 08:00 el post aún no existe en LinkedIn, los enlaces del correo apuntan a un redirector propio que resuelve al post real cuando Make ha devuelto su URL vía callback.

**Tech Stack:** Next.js 16 (App Router, rutas `route.js`), Prisma 6 + PostgreSQL, Resend 6, crons de Vercel, vitest (nuevo).

**Spec:** [`docs/superpowers/specs/2026-07-26-linkedin-daily-briefing-design.md`](../specs/2026-07-26-linkedin-daily-briefing-design.md)

---

## Estructura de ficheros

| Fichero | Estado | Responsabilidad |
|---|---|---|
| `app/lib/time/madrid.js` | modificado | Primitivas de zona horaria: hora, día de la semana, rango del día natural, etiquetas. |
| `app/lib/time/linkedinSchedule.js` | modificado | Tabla de slots: fechas, canal y acción cruzada. Sin efectos. |
| `app/lib/linkedin/dailyTasks.js` | nuevo | `buildDailyTasks()`: datos ya consultados → `{ tasks, incidents }`. Función pura. |
| `app/lib/linkedin/postUrl.js` | nuevo | `linkedInUrlFrom()`: valida y normaliza la URL que devuelve Make. Función pura. |
| `app/lib/notifications/dailyBriefing.js` | nuevo | Render del HTML y envío por Resend. |
| `app/api/cron/daily-briefing/route.js` | nuevo | Auth, guard horario, consultas, orquestación, `?preview=1`. |
| `app/api/webhooks/linkedin-published/route.js` | nuevo | Callback de Make: guarda `linkedinPostUrl`. |
| `app/api/go/variant/[id]/route.js` | nuevo | Redirección al post o al canal de respaldo. |
| `app/lib/ai/generator.js` | modificado | Campo `cross_note` en el esquema y bloque de instrucciones en el prompt. |
| `app/lib/ai/orchestrator.js` | modificado | Pasa `crossActions` al generador y persiste `crossNote`. |
| `prisma/schema.prisma` | modificado | `linkedinPostUrl` y `crossNote` en `LinkedInVariant`. |
| `vercel.json` | modificado | Dos entradas de cron para el briefing. |
| `vitest.config.mjs` | nuevo | Configuración de tests, alias `@`. |

Los tests van junto al código que prueban, con sufijo `.test.js`. No son rutas de Next (solo lo son `page.js` y `route.js`), así que conviven sin problema dentro de `app/`.

**Nota sobre el directorio de trabajo:** el repositorio git es `my-app/`, no la carpeta padre. Todos los comandos de este plan se ejecutan desde `my-app/`.

---

### Task 1: Rama de trabajo y herramienta de tests

`main` es la rama de despliegue: un push a `main` publica en producción. El trabajo va en una rama aparte.

Se cierra la tarea con un test de caracterización del comportamiento que ya existe (`channelForVariant`). Sirve para dos cosas: demostrar que el arnés de tests funciona antes de escribir nada nuevo, y dejar fijado el reparto actual para que la refactorización de la Task 2 no pueda cambiarlo sin que salte un test.

**Files:**
- Create: `vitest.config.mjs`
- Create: `app/lib/time/linkedinSchedule.test.js`
- Modify: `package.json`

- [ ] **Step 1: Crear la rama**

```bash
git checkout -b feat/linkedin-daily-briefing
```

Los tres ficheros ya modificados (`route.js`, `linkedinSchedule.js`, `madrid.js` del campo `canal`) viajan con la rama sin necesidad de hacer nada: `git checkout -b` conserva los cambios sin commitear.

- [ ] **Step 2: Instalar vitest**

```bash
npm install -D vitest
```

- [ ] **Step 3: Crear `vitest.config.mjs`**

Extensión `.mjs` a propósito: `package.json` no declara `"type": "module"`, y así el fichero es ESM sin ambigüedad y `import.meta.url` funciona. El alias replica el de `jsconfig.json` (`"@/*": ["./*"]`).

```js
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["app/**/*.test.js"],
  },
});
```

- [ ] **Step 4: Añadir el script de test**

En `package.json`, dentro de `"scripts"`, junto a `"lint": "eslint"`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 5: Escribir el test de caracterización**

Crear `app/lib/time/linkedinSchedule.test.js`:

```js
import { describe, expect, it } from "vitest";
import {
  channelForVariant,
  variantScheduleFor,
} from "./linkedinSchedule";

// Lunes 27 de julio de 2026, 10:00 Madrid (CEST = UTC+2).
const LUNES = new Date("2026-07-27T08:00:00Z");
// Miércoles 29 de julio de 2026, 10:00 Madrid.
const MIERCOLES = new Date("2026-07-29T08:00:00Z");

describe("variantScheduleFor", () => {
  it("programa el mismo día, el siguiente y dos días después por la tarde", () => {
    const [v1, v2, v3] = variantScheduleFor(LUNES);
    expect(v1.toISOString()).toBe("2026-07-27T08:00:00.000Z");
    expect(v2.toISOString()).toBe("2026-07-28T08:00:00.000Z");
    expect(v3.toISOString()).toBe("2026-07-29T14:00:00.000Z");
  });
});

describe("channelForVariant", () => {
  it("reparte el post del lunes en personal, empresa, empresa", () => {
    const canales = [1, 2, 3].map((variant) =>
      channelForVariant({ postPublishDate: LUNES, variant }),
    );
    expect(canales).toEqual(["personal", "empresa", "empresa"]);
  });

  it("reparte el post del miércoles en personal, empresa, personal", () => {
    const canales = [1, 2, 3].map((variant) =>
      channelForVariant({ postPublishDate: MIERCOLES, variant }),
    );
    expect(canales).toEqual(["personal", "empresa", "personal"]);
  });

  it("mantiene 3 y 3 en la semana completa", () => {
    const semana = [
      ...[1, 2, 3].map((v) => channelForVariant({ postPublishDate: LUNES, variant: v })),
      ...[1, 2, 3].map((v) => channelForVariant({ postPublishDate: MIERCOLES, variant: v })),
    ];
    expect(semana.filter((c) => c === "personal")).toHaveLength(3);
    expect(semana.filter((c) => c === "empresa")).toHaveLength(3);
  });

  it("aplica el reparto del lunes si el post cae en un día no previsto", () => {
    const viernes = new Date("2026-07-31T08:00:00Z");
    expect(channelForVariant({ postPublishDate: viernes, variant: 1 })).toBe("personal");
    expect(channelForVariant({ postPublishDate: viernes, variant: 3 })).toBe("empresa");
  });

  it("resuelve el mismo día de la semana en horario de invierno", () => {
    // Lunes 5 de enero de 2026, 10:00 Madrid (CET = UTC+1).
    const lunesInvierno = new Date("2026-01-05T09:00:00Z");
    expect(channelForVariant({ postPublishDate: lunesInvierno, variant: 2 })).toBe("empresa");
  });
});
```

- [ ] **Step 6: Ejecutar los tests**

Run: `npm test`
Expected: PASS, 6 tests en 1 fichero. Si falla la resolución del import, revisar que `vitest.config.mjs` esté en la raíz de `my-app/`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.mjs app/lib/time/linkedinSchedule.test.js app/lib/time/linkedinSchedule.js app/lib/time/madrid.js app/api/cron/publish-linkedin/route.js
git commit -m "test: añade vitest y fija el reparto de canales por slot" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: La tabla de slots absorbe la acción cruzada

La acción del otro canal no es función del número de variante (la v3 del lunes no lleva ninguna y la del miércoles sí), exactamente igual que pasaba con el canal. Va en la misma tabla.

**Files:**
- Modify: `app/lib/time/linkedinSchedule.js`
- Test: `app/lib/time/linkedinSchedule.test.js`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `app/lib/time/linkedinSchedule.test.js`, y añadir `crossActionsFor` y `slotFor` al import de la cabecera del fichero:

```js
describe("crossActionsFor", () => {
  it("da recompartición, comentario y nada al post del lunes", () => {
    expect(crossActionsFor(LUNES)).toEqual([
      "reshare_company",
      "comment_personal",
      null,
    ]);
  });

  it("da nada, comentario y recompartición al post del miércoles", () => {
    expect(crossActionsFor(MIERCOLES)).toEqual([
      null,
      "comment_personal",
      "reshare_company",
    ]);
  });
});

describe("slotFor", () => {
  it("devuelve canal y acción cruzada juntos", () => {
    expect(slotFor({ postPublishDate: LUNES, variant: 1 })).toEqual({
      canal: "personal",
      cross: "reshare_company",
    });
    expect(slotFor({ postPublishDate: MIERCOLES, variant: 3 })).toEqual({
      canal: "personal",
      cross: "reshare_company",
    });
  });

  it("cae en el primer slot del lunes si la variante está fuera de rango", () => {
    expect(slotFor({ postPublishDate: LUNES, variant: 9 })).toEqual({
      canal: "personal",
      cross: "reshare_company",
    });
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL con `crossActionsFor is not a function` (y `slotFor is not a function`).

- [ ] **Step 3: Reemplazar el bloque de reparto**

En `app/lib/time/linkedinSchedule.js`, sustituir todo lo que hay desde el comentario `// ─── Reparto perfil personal / página de empresa ───` hasta el final del fichero por:

```js
// ─── Reparto perfil personal / página de empresa ───────────────────────────
// Único sitio donde se decide qué cuenta publica cada variante y qué le toca
// hacer al otro canal. El Router de Make solo filtra por el campo `canal` del
// payload y el briefing diario lee `cross`, así que cambiar el reparto es
// cambiar esta tabla.
//
// Con dos posts por semana (Lunes y Miércoles), los 6 slots quedan 3 y 3:
//   L 10:00  art.1 v1  personal  → Room714 lo recomparte
//   M 10:00  art.1 v2  empresa   → José comenta desde su perfil
//   X 10:00  art.2 v1  personal  → —
//   X 16:00  art.1 v3  empresa   → —
//   J 10:00  art.2 v2  empresa   → José comenta desde su perfil
//   V 16:00  art.2 v3  personal  → Room714 lo recomparte
//
// Ojo a la asimetría de v3: es intencionada. Es lo que equilibra la semana y
// evita que el miércoles las dos publicaciones salgan por la misma cuenta.
const SLOTS_BY_PUBLISH_WEEKDAY = {
  Mon: [
    { canal: "personal", cross: "reshare_company" },
    { canal: "empresa", cross: "comment_personal" },
    { canal: "empresa", cross: null },
  ],
  Wed: [
    { canal: "personal", cross: null },
    { canal: "empresa", cross: "comment_personal" },
    { canal: "personal", cross: "reshare_company" },
  ],
};

// Si un post cae en un día no previsto (recuperación manual, cambio de
// calendario), aplicamos el reparto del lunes en vez de fallar: perder el
// equilibrio de la semana es preferible a no publicar.
const FALLBACK_SLOTS = SLOTS_BY_PUBLISH_WEEKDAY.Mon;

function slotsFor(postPublishDate) {
  const weekday = getMadridWeekday(postPublishDate);
  return SLOTS_BY_PUBLISH_WEEKDAY[weekday] || FALLBACK_SLOTS;
}

export function slotFor({ postPublishDate, variant }) {
  return slotsFor(postPublishDate)[variant - 1] || FALLBACK_SLOTS[0];
}

export function channelForVariant({ postPublishDate, variant }) {
  return slotFor({ postPublishDate, variant }).canal;
}

// Las tres acciones cruzadas en el orden de las variantes. Lo consume el
// orquestador para decirle al generador qué sugerencia escribir en cada una.
export function crossActionsFor(postPublishDate) {
  return slotsFor(postPublishDate).map((slot) => slot.cross);
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test`
Expected: PASS, 10 tests. Los de `channelForVariant` de la Task 1 siguen en verde: el reparto no ha cambiado, solo su representación.

- [ ] **Step 5: Commit**

```bash
git add app/lib/time/linkedinSchedule.js app/lib/time/linkedinSchedule.test.js
git commit -m "feat: la tabla de slots incluye la accion del otro canal" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Primitivas de tiempo de Madrid

El cron necesita tres cosas que hoy no existen: el rango UTC del día natural de Madrid (para consultar las variantes de hoy), la hora de una variante formateada (`"10:00"`), y una etiqueta de fecha para el asunto (`"lunes 27"`).

**Files:**
- Modify: `app/lib/time/madrid.js`
- Test: `app/lib/time/madrid.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `app/lib/time/madrid.test.js`:

```js
import { describe, expect, it } from "vitest";
import {
  formatMadridDateLabel,
  formatMadridTime,
  getMadridWeekday,
  madridDayRange,
} from "./madrid";

describe("getMadridWeekday", () => {
  it("devuelve el día natural de Madrid, no el de UTC", () => {
    // 22:30 UTC del domingo son las 00:30 del lunes en Madrid.
    expect(getMadridWeekday(new Date("2026-07-26T22:30:00Z"))).toBe("Mon");
  });
});

describe("formatMadridTime", () => {
  it("formatea en horario de verano", () => {
    expect(formatMadridTime(new Date("2026-07-27T08:00:00Z"))).toBe("10:00");
    expect(formatMadridTime(new Date("2026-07-29T14:00:00Z"))).toBe("16:00");
  });

  it("formatea en horario de invierno", () => {
    expect(formatMadridTime(new Date("2026-01-05T09:00:00Z"))).toBe("10:00");
  });
});

describe("madridDayRange", () => {
  it("cubre el día natural de Madrid en verano (UTC+2)", () => {
    const { start, end } = madridDayRange(new Date("2026-07-27T09:30:00Z"));
    expect(start.toISOString()).toBe("2026-07-26T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-27T21:59:59.999Z");
  });

  it("cubre el día natural de Madrid en invierno (UTC+1)", () => {
    const { start, end } = madridDayRange(new Date("2026-01-05T09:30:00Z"));
    expect(start.toISOString()).toBe("2026-01-04T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-05T22:59:59.999Z");
  });

  it("incluye una publicación de las 16:00 de ese mismo día", () => {
    const { start, end } = madridDayRange(new Date("2026-07-31T06:00:00Z"));
    const publicacion = new Date("2026-07-31T14:00:00Z"); // 16:00 Madrid
    expect(publicacion >= start && publicacion <= end).toBe(true);
  });
});

describe("formatMadridDateLabel", () => {
  it("devuelve día de la semana y número", () => {
    expect(formatMadridDateLabel(new Date("2026-07-27T08:00:00Z"))).toBe("lunes 27");
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL con `formatMadridTime is not a function`.

- [ ] **Step 3: Implementar los helpers**

Añadir al final de `app/lib/time/madrid.js` (debajo de `getMadridWeekday`, dejando `nextMadridSlot` donde está):

```js
// Hora de Madrid en formato "HH:MM".
export function formatMadridTime(date) {
  const { hour, minute } = getMadridParts(date);
  return `${hour}:${minute}`;
}

// Etiqueta corta para asuntos de correo: "lunes 27".
export function formatMadridDateLabel(date = new Date()) {
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === "weekday").value;
  const day = parts.find((p) => p.type === "day").value;
  return `${weekday} ${day}`;
}

// Desplazamiento de Madrid respecto a UTC, en milisegundos, en ese instante.
function madridOffsetMs(date) {
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName").value; // "GMT+02:00"

  const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000;
}

// Primer y último instante (en UTC) del día natural de Madrid al que pertenece
// `date`. Se usa para filtrar por fecha en Prisma, que compara instantes.
//
// El desplazamiento se toma en `date`, así que un día de cambio de hora podría
// desviar el rango una hora. No afecta: los cambios ocurren de madrugada en
// domingo y este cálculo solo lo usa el cron de lunes a viernes.
export function madridDayRange(date = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // "2026-07-27"

  const [year, month, day] = ymd.split("-").map(Number);
  const offset = madridOffsetMs(date);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offset);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test`
Expected: PASS, 17 tests en 2 ficheros.

- [ ] **Step 5: Commit**

```bash
git add app/lib/time/madrid.js app/lib/time/madrid.test.js
git commit -m "feat: helpers de rango de dia y formato de hora en Madrid" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Dos columnas nuevas en `LinkedInVariant`

**Files:**
- Modify: `prisma/schema.prisma:49-67`

- [ ] **Step 1: Añadir los campos**

En el modelo `LinkedInVariant`, después de `imageQuery`:

```prisma
  imageQuery   String?
  crossNote       String?   @db.Text  // sugerencia de comentario o recompartición
  linkedinPostUrl String?             // URL del post publicado, la devuelve Make
  scheduledFor DateTime
```

- [ ] **Step 2: Aplicar el esquema**

El proyecto no usa migraciones (no hay `prisma/migrations`), así que el esquema se aplica directamente. **Esto toca la base de datos de producción**, porque `.env.local` apunta a producción. Son dos columnas anulables: la operación no reescribe filas ni bloquea la tabla, y el código actual las ignora.

Run: `npx prisma db push`
Expected: `Your database is now in sync with your Prisma schema.` y dos columnas añadidas.

- [ ] **Step 3: Regenerar el cliente**

Run: `npx prisma generate`
Expected: `Generated Prisma Client`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: columnas crossNote y linkedinPostUrl en LinkedInVariant" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `buildDailyTasks` — tareas de las variantes del día

Función pura: recibe datos ya consultados y devuelve `{ tasks, incidents }`. No toca base de datos ni red, que es lo que permite cubrir los seis slots de la semana con tests rápidos.

Esta tarea cubre las variantes; la Task 6 añade el blog, las incidencias y el orden.

**Files:**
- Create: `app/lib/linkedin/dailyTasks.js`
- Test: `app/lib/linkedin/dailyTasks.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `app/lib/linkedin/dailyTasks.test.js`:

```js
import { describe, expect, it } from "vitest";
import { buildDailyTasks } from "./dailyTasks";

const SITE = "https://www.room714.com";

// Lunes 27 y miércoles 29 de julio de 2026, 10:00 Madrid.
const LUNES = new Date("2026-07-27T08:00:00Z");
const MIERCOLES = new Date("2026-07-29T08:00:00Z");

function variante({ id = 1, variant = 1, postDate = LUNES, scheduledFor, ...rest }) {
  return {
    id,
    variant,
    text: "Texto de la variante",
    hashtags: ["#IA", "#UX"],
    crossNote: "Sugerencia generada",
    scheduledFor: scheduledFor ?? postDate,
    post: {
      id: 10,
      date: postDate,
      translations: [{ lang: "es", slug: "mi-post", title: "Mi post" }],
    },
    ...rest,
  };
}

function kinds(tasks) {
  return tasks.map((t) => t.kind);
}

describe("buildDailyTasks — variantes del día", () => {
  it("lunes: revisar, primer comentario y recompartir desde la página", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: LUNES })],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["review_own", "first_comment", "reshare_company"]);
  });

  it("martes: solo comentar desde el perfil", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        variante({
          variant: 2,
          postDate: LUNES,
          scheduledFor: new Date("2026-07-28T08:00:00Z"),
        }),
      ],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["comment_personal"]);
  });

  it("miércoles: dos publicaciones y ninguna acción cruzada", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        // Deriv. 1 del artículo nuevo, 10:00, canal personal.
        variante({ id: 1, variant: 1, postDate: MIERCOLES }),
        // Deriv. 3 del artículo del lunes, 16:00, canal empresa.
        variante({
          id: 2,
          variant: 3,
          postDate: LUNES,
          scheduledFor: new Date("2026-07-29T14:00:00Z"),
        }),
      ],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["review_own", "first_comment"]);
  });

  it("viernes: la v3 del miércoles es tuya y la recomparte la página", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        variante({
          variant: 3,
          postDate: MIERCOLES,
          scheduledFor: new Date("2026-07-31T14:00:00Z"),
        }),
      ],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["review_own", "first_comment", "reshare_company"]);
  });

  it("la tarea de revisión trae todo lo necesario para ejecutarla", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: LUNES })],
      siteUrl: SITE,
    });
    const review = tasks.find((t) => t.kind === "review_own");
    expect(review.when).toBe("before");
    expect(review.time).toBe("10:00");
    expect(review.text).toBe("Texto de la variante");
    expect(review.hashtags).toEqual(["#IA", "#UX"]);
    expect(review.articleUrl).toBe(`${SITE}/es/blog/mi-post`);
    expect(review.voiceHint).toContain("primera persona");
  });

  it("las acciones cruzadas enlazan al redirector y llevan la sugerencia", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ id: 42, variant: 1, postDate: LUNES })],
      siteUrl: SITE,
    });
    const reshare = tasks.find((t) => t.kind === "reshare_company");
    expect(reshare.when).toBe("after");
    expect(reshare.suggestion).toBe("Sugerencia generada");
    expect(reshare.linkUrl).toBe(`${SITE}/api/go/variant/42`);
  });

  it("mantiene la tarea aunque no haya sugerencia generada", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: LUNES, crossNote: null })],
      siteUrl: SITE,
    });
    const reshare = tasks.find((t) => t.kind === "reshare_company");
    expect(reshare).toBeDefined();
    expect(reshare.suggestion).toBeNull();
  });

  it("omite el primer comentario si Make ya lo publica", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: LUNES })],
      siteUrl: SITE,
      firstCommentAutomated: true,
    });
    expect(kinds(tasks)).toEqual(["review_own", "reshare_company"]);
  });

  it("ignora variantes sin traducción española", () => {
    const sinEs = variante({ variant: 1, postDate: LUNES });
    sinEs.post.translations = [{ lang: "en", slug: "my-post", title: "My post" }];
    const { tasks } = buildDailyTasks({ todayVariants: [sinEs], siteUrl: SITE });
    expect(tasks).toEqual([]);
  });

  it("devuelve listas vacías si no hay nada hoy", () => {
    const { tasks, incidents } = buildDailyTasks({ siteUrl: SITE });
    expect(tasks).toEqual([]);
    expect(incidents).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL, no se puede resolver `./dailyTasks`.

- [ ] **Step 3: Implementar**

Crear `app/lib/linkedin/dailyTasks.js`:

```js
import { slotFor } from "@/app/lib/time/linkedinSchedule";
import { formatMadridTime } from "@/app/lib/time/madrid";

const VOICE_JOSE =
  'Voz José: primera persona, opinión con riesgo, referencia a lo que ves en tus propios proyectos. Sin el "nosotros" corporativo ni tono de nota de prensa.';

// Construye las tareas manuales del día a partir de datos ya consultados.
// Función pura a propósito: es lo que permite probar los seis slots de la
// semana sin base de datos.
//
// Devuelve dos listas separadas porque son cosas distintas: `tasks` es lo que
// hay que hacer hoy, `incidents` es lo que no salió ayer y solo se informa.
export function buildDailyTasks({
  todayVariants = [],
  yesterdayUnsent = [],
  blogPost = null,
  siteUrl,
  firstCommentAutomated = false,
}) {
  const tasks = [];

  for (const variant of todayVariants) {
    const translationEs = variant.post?.translations?.find((t) => t.lang === "es");
    if (!translationEs) continue;

    const articleUrl = `${siteUrl}/es/blog/${translationEs.slug}`;
    const linkUrl = `${siteUrl}/api/go/variant/${variant.id}`;
    const time = formatMadridTime(variant.scheduledFor);
    const slot = slotFor({
      postPublishDate: variant.post.date,
      variant: variant.variant,
    });

    if (slot.canal === "personal") {
      tasks.push({
        id: `review-${variant.id}`,
        kind: "review_own",
        when: "before",
        time,
        channel: "personal",
        title: `Revisa el texto que sale a tu nombre a las ${time}`,
        articleTitle: translationEs.title,
        text: variant.text,
        hashtags: variant.hashtags || [],
        voiceHint: VOICE_JOSE,
        articleUrl,
      });

      if (!firstCommentAutomated) {
        tasks.push({
          id: `first-comment-${variant.id}`,
          kind: "first_comment",
          when: "after",
          time,
          channel: "personal",
          title: "Publica el enlace al artículo como primer comentario",
          articleTitle: translationEs.title,
          articleUrl,
          linkUrl,
        });
      }
    }

    if (slot.cross === "reshare_company") {
      tasks.push({
        id: `reshare-${variant.id}`,
        kind: "reshare_company",
        when: "after",
        time,
        channel: "empresa",
        title: "Recomparte el post desde la página de Room714",
        articleTitle: translationEs.title,
        suggestion: variant.crossNote || null,
        articleUrl,
        linkUrl,
      });
    }

    if (slot.cross === "comment_personal") {
      tasks.push({
        id: `comment-${variant.id}`,
        kind: "comment_personal",
        when: "after",
        time,
        channel: "personal",
        title: "Comenta desde tu perfil en el post de Room714",
        articleTitle: translationEs.title,
        suggestion: variant.crossNote || null,
        articleUrl,
        linkUrl,
      });
    }
  }

  return { tasks, incidents: [] };
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test`
Expected: PASS, 27 tests en 3 ficheros.

- [ ] **Step 5: Commit**

```bash
git add app/lib/linkedin/dailyTasks.js app/lib/linkedin/dailyTasks.test.js
git commit -m "feat: buildDailyTasks genera las tareas de las variantes del dia" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `buildDailyTasks` — blog, incidencias y orden

**Files:**
- Modify: `app/lib/linkedin/dailyTasks.js`
- Test: `app/lib/linkedin/dailyTasks.test.js`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `app/lib/linkedin/dailyTasks.test.js`:

```js
describe("buildDailyTasks — blog, incidencias y orden", () => {
  it("añade la revisión del artículo que se publica hoy", () => {
    const { tasks } = buildDailyTasks({
      blogPost: {
        id: 77,
        date: LUNES,
        translations: [{ lang: "es", slug: "articulo-nuevo", title: "Artículo nuevo" }],
      },
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["blog_review"]);
    expect(tasks[0].articleUrl).toBe(`${SITE}/es/blog/articulo-nuevo`);
    expect(tasks[0].adminUrl).toBe(`${SITE}/admin?postId=77`);
  });

  it("no añade nada de blog si hoy no se publica artículo", () => {
    const { tasks } = buildDailyTasks({ blogPost: null, siteUrl: SITE });
    expect(tasks).toEqual([]);
  });

  it("informa de las variantes de ayer que no llegaron a publicarse", () => {
    const { tasks, incidents } = buildDailyTasks({
      yesterdayUnsent: [
        {
          id: 5,
          variant: 2,
          scheduledFor: new Date("2026-07-28T08:00:00Z"),
          post: {
            id: 10,
            date: LUNES,
            translations: [{ lang: "es", slug: "mi-post", title: "Mi post" }],
          },
        },
      ],
      siteUrl: SITE,
    });
    expect(tasks).toEqual([]);
    expect(kinds(incidents)).toEqual(["not_published"]);
    expect(incidents[0].title).toContain("no llegó a publicarse");
  });

  it("ordena por hora, y a igual hora lo previo antes que lo posterior", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        // 16:00, canal empresa, sin acción cruzada → no genera tareas.
        variante({
          id: 2,
          variant: 3,
          postDate: LUNES,
          scheduledFor: new Date("2026-07-29T14:00:00Z"),
        }),
        // 10:00, canal personal → revisar (antes) + primer comentario (después).
        variante({ id: 1, variant: 1, postDate: MIERCOLES }),
      ],
      blogPost: {
        id: 77,
        date: MIERCOLES,
        translations: [{ lang: "es", slug: "articulo-nuevo", title: "Artículo nuevo" }],
      },
      siteUrl: SITE,
    });
    expect(tasks.map((t) => [t.time, t.when])).toEqual([
      ["10:00", "before"],
      ["10:00", "before"],
      ["10:00", "after"],
    ]);
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL — `expected [] to deep equal [ 'blog_review' ]`.

- [ ] **Step 3: Implementar**

En `app/lib/linkedin/dailyTasks.js`, sustituir la línea `return { tasks, incidents: [] };` por:

```js
  if (blogPost) {
    const translationEs = blogPost.translations?.find((t) => t.lang === "es");
    if (translationEs) {
      tasks.push({
        id: `blog-${blogPost.id}`,
        kind: "blog_review",
        when: "before",
        time: formatMadridTime(blogPost.date),
        channel: null,
        title: "Artículo nuevo hoy en la web",
        articleTitle: translationEs.title,
        articleUrl: `${siteUrl}/es/blog/${translationEs.slug}`,
        adminUrl: `${siteUrl}/admin?postId=${blogPost.id}`,
      });
    }
  }

  // Ayer quedó algo sin publicar. El motivo no se persiste (el cron de
  // publicación solo lo escribe en consola), así que informamos del hecho.
  const incidents = yesterdayUnsent.map((variant) => {
    const translationEs = variant.post?.translations?.find((t) => t.lang === "es");
    return {
      id: `not-published-${variant.id}`,
      kind: "not_published",
      when: "before",
      time: formatMadridTime(variant.scheduledFor),
      channel: null,
      title: `La derivación ${variant.variant} de ayer no llegó a publicarse`,
      articleTitle: translationEs?.title || `Post ${variant.post?.id ?? "?"}`,
    };
  });

  const WHEN_ORDER = { before: 0, after: 1 };
  tasks.sort(
    (a, b) =>
      a.time.localeCompare(b.time) || WHEN_ORDER[a.when] - WHEN_ORDER[b.when],
  );

  return { tasks, incidents };
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test`
Expected: PASS, 31 tests en 3 ficheros.

- [ ] **Step 5: Commit**

```bash
git add app/lib/linkedin/dailyTasks.js app/lib/linkedin/dailyTasks.test.js
git commit -m "feat: buildDailyTasks anade blog, incidencias y orden" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Normalizar la URL que devuelve Make

Pieza pura y con seguridad de por medio: lo que llegue por el callback acaba siendo el destino de una redirección alojada en `room714.com`. Sin validar el host, el redirector se convierte en un open redirect en el dominio de la empresa, que es material de phishing.

**Files:**
- Create: `app/lib/linkedin/postUrl.js`
- Test: `app/lib/linkedin/postUrl.test.js`

- [ ] **Step 1: Escribir el test que falla**

Crear `app/lib/linkedin/postUrl.test.js`:

```js
import { describe, expect, it } from "vitest";
import { linkedInUrlFrom } from "./postUrl";

describe("linkedInUrlFrom", () => {
  it("construye la URL del feed a partir de un URN de share", () => {
    expect(linkedInUrlFrom({ postUrn: "urn:li:share:7123456789" })).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:7123456789/",
    );
  });

  it("acepta también ugcPost y activity", () => {
    expect(linkedInUrlFrom({ postUrn: "urn:li:ugcPost:7123456789" })).toBe(
      "https://www.linkedin.com/feed/update/urn:li:ugcPost:7123456789/",
    );
    expect(linkedInUrlFrom({ postUrn: "urn:li:activity:7123456789" })).toBe(
      "https://www.linkedin.com/feed/update/urn:li:activity:7123456789/",
    );
  });

  it("acepta una URL de linkedin ya formada", () => {
    const url = "https://www.linkedin.com/feed/update/urn:li:share:7123456789/";
    expect(linkedInUrlFrom({ postUrl: url })).toBe(url);
  });

  it("rechaza hosts que no son de linkedin", () => {
    expect(linkedInUrlFrom({ postUrl: "https://evil.example.com/phishing" })).toBeNull();
    expect(linkedInUrlFrom({ postUrl: "https://linkedin.com.evil.example/x" })).toBeNull();
  });

  it("rechaza esquemas que no son https", () => {
    expect(linkedInUrlFrom({ postUrl: "http://www.linkedin.com/feed" })).toBeNull();
    expect(
      linkedInUrlFrom({ postUrl: "javascript:alert(document.domain)" }),
    ).toBeNull();
  });

  it("rechaza URNs con formato inesperado y entradas vacías", () => {
    expect(linkedInUrlFrom({ postUrn: "urn:li:share:no-numerico" })).toBeNull();
    expect(linkedInUrlFrom({ postUrn: "cualquier cosa" })).toBeNull();
    expect(linkedInUrlFrom({})).toBeNull();
    expect(linkedInUrlFrom({ postUrl: "" })).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL, no se puede resolver `./postUrl`.

- [ ] **Step 3: Implementar**

Crear `app/lib/linkedin/postUrl.js`:

```js
// Hosts admitidos como destino. Cualquier otro se descarta: esta URL acaba
// siendo el destino de la redirección de /api/go/variant/[id], y aceptar
// hosts arbitrarios convertiría esa ruta en un open redirect.
const ALLOWED_HOSTS = new Set(["www.linkedin.com", "linkedin.com"]);

const URN_PATTERN = /^urn:li:(share|ugcPost|activity):\d+$/;

// Normaliza lo que devuelve Make tras publicar. Acepta el URN que da la API de
// LinkedIn o una URL ya formada. Devuelve null si no se puede confiar en ella.
export function linkedInUrlFrom({ postUrl, postUrn } = {}) {
  if (postUrn) {
    const urn = String(postUrn).trim();
    if (!URN_PATTERN.test(urn)) return null;
    return `https://www.linkedin.com/feed/update/${urn}/`;
  }

  if (!postUrl) return null;

  let parsed;
  try {
    parsed = new URL(String(postUrl).trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return null;
  return parsed.toString();
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test`
Expected: PASS, 37 tests en 4 ficheros.

- [ ] **Step 5: Commit**

```bash
git add app/lib/linkedin/postUrl.js app/lib/linkedin/postUrl.test.js
git commit -m "feat: normaliza y valida la URL de post que devuelve Make" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Callback de Make

**Files:**
- Create: `app/api/webhooks/linkedin-published/route.js`

- [ ] **Step 1: Implementar la ruta**

No lleva test automatizado: es una capa fina sobre `linkedInUrlFrom` (ya cubierto) y Prisma. Se verifica a mano en el Step 2.

```js
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { linkedInUrlFrom } from "@/app/lib/linkedin/postUrl";

export const maxDuration = 30;

// Callback que dispara Make al final de cada ruta del Router, después de
// publicar. Guarda la URL del post para que el briefing diario pueda enlazar
// directamente a él en vez de al perfil o a la página.
export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.MAKE_CALLBACK_SECRET ||
    authHeader !== `Bearer ${process.env.MAKE_CALLBACK_SECRET}`
  ) {
    return new Response("No autorizado", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const variantId = Number(body.variant_id);

  if (!Number.isInteger(variantId) || variantId <= 0) {
    return NextResponse.json(
      { error: "variant_id ausente o no es un entero positivo" },
      { status: 400 },
    );
  }

  const url = linkedInUrlFrom({
    postUrl: body.post_url,
    postUrn: body.post_urn,
  });
  if (!url) {
    return NextResponse.json(
      { error: "post_url / post_urn ausente, mal formado o de un host no permitido" },
      { status: 400 },
    );
  }

  const variant = await prisma.linkedInVariant.findUnique({
    where: { id: variantId },
    select: { id: true },
  });
  if (!variant) {
    return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
  }

  await prisma.linkedInVariant.update({
    where: { id: variantId },
    data: { linkedinPostUrl: url },
  });

  return NextResponse.json({ ok: true, url });
}
```

- [ ] **Step 2: Verificar a mano contra el servidor de desarrollo**

En una terminal: `npm run dev`. En otra, sustituyendo `<SECRET>` por el valor de `MAKE_CALLBACK_SECRET` (Task 13) y `<ID>` por el id de una variante real:

```bash
curl -s -X POST http://localhost:3000/api/webhooks/linkedin-published \
  -H "Authorization: Bearer <SECRET>" -H "Content-Type: application/json" \
  -d '{"variant_id": <ID>, "post_urn": "urn:li:share:7123456789"}'
```

Expected: `{"ok":true,"url":"https://www.linkedin.com/feed/update/urn:li:share:7123456789/"}`

Y que el host se rechaza:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhooks/linkedin-published \
  -H "Authorization: Bearer <SECRET>" -H "Content-Type: application/json" \
  -d '{"variant_id": <ID>, "post_url": "https://evil.example.com/x"}'
```

Expected: `400`

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/linkedin-published/route.js
git commit -m "feat: callback de Make que guarda la URL del post publicado" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Redirector del correo

El correo sale a las 08:00 y el post no existe hasta las 10:00, así que los enlaces no pueden apuntar al post: apuntan aquí, y esta ruta resuelve en el momento del clic.

**Files:**
- Create: `app/api/go/variant/[id]/route.js`

- [ ] **Step 1: Implementar la ruta**

```js
import { prisma } from "@/app/lib/prisma";
import { channelForVariant } from "@/app/lib/time/linkedinSchedule";

export const maxDuration = 30;

const PROFILE_FALLBACK = "https://www.linkedin.com/in/";
const COMPANY_FALLBACK = "https://www.linkedin.com/company/";

// Redirección que se resuelve en el momento del clic. El briefing sale a las
// 08:00, cuando el post todavía no existe en LinkedIn; si para cuando se pulsa
// Make ya ha devuelto la URL vía callback, se cae en el post exacto, y si no,
// en el perfil o la página.
//
// Ruta pública a propósito: se pulsa desde un cliente de correo, sin sesión. No
// expone nada, el destino es una URL pública de LinkedIn.
export async function GET(_request, { params }) {
  const { id } = await params;

  // Solo IDs decimales positivos; Number("") o "0x10" colarían valores raros.
  if (!/^\d+$/.test(id)) {
    return Response.redirect(
      process.env.LINKEDIN_COMPANY_URL || COMPANY_FALLBACK,
      302,
    );
  }

  const variant = await prisma.linkedInVariant.findUnique({
    where: { id: Number(id) },
    select: {
      variant: true,
      linkedinPostUrl: true,
      post: { select: { date: true } },
    },
  });

  let target = variant?.linkedinPostUrl;

  if (!target) {
    const canal = variant
      ? channelForVariant({
          postPublishDate: variant.post.date,
          variant: variant.variant,
        })
      : "empresa";
    target =
      canal === "personal"
        ? process.env.LINKEDIN_PROFILE_URL || PROFILE_FALLBACK
        : process.env.LINKEDIN_COMPANY_URL || COMPANY_FALLBACK;
  }

  // 302 y sin caché: un cliente de correo que precargue el enlace a las 08:00
  // no debe dejar congelado el redirect al perfil de por vida.
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
```

- [ ] **Step 2: Verificar a mano**

Con `npm run dev` levantado y `<ID>` el de la variante que actualizaste en la Task 8:

```bash
curl -s -o /dev/null -D - http://localhost:3000/api/go/variant/<ID> | grep -i -E "^(HTTP|location|cache-control)"
```

Expected: `HTTP/1.1 302`, `location: https://www.linkedin.com/feed/update/urn:li:share:7123456789/`, `cache-control: no-store, max-age=0`

Y con una variante sin URL guardada, que caiga en el respaldo del canal que le toque:

```bash
curl -s -o /dev/null -D - http://localhost:3000/api/go/variant/999999 | grep -i location
```

Expected: `location:` con el valor de `LINKEDIN_COMPANY_URL`

- [ ] **Step 3: Commit**

```bash
git add "app/api/go/variant/[id]/route.js"
git commit -m "feat: redirector que resuelve al post de LinkedIn en el clic" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Render y envío del correo

**Files:**
- Create: `app/lib/notifications/dailyBriefing.js`
- Test: `app/lib/notifications/dailyBriefing.test.js`

- [ ] **Step 1: Escribir el test que falla**

Se prueba el render, no el envío. Lo que importa: que el texto de la variante se escape (viene de un modelo de lenguaje y acaba dentro de HTML), y que una tarea sin sugerencia no reviente ni deje un hueco mudo.

Crear `app/lib/notifications/dailyBriefing.test.js`:

```js
import { describe, expect, it } from "vitest";
import { renderBriefingHtml } from "./dailyBriefing";

const TASK_REVIEW = {
  id: "review-1",
  kind: "review_own",
  when: "before",
  time: "10:00",
  channel: "personal",
  title: "Revisa el texto que sale a tu nombre a las 10:00",
  articleTitle: "Mi post",
  text: "Primera línea\n\nSegunda línea",
  hashtags: ["#IA", "#UX"],
  voiceHint: "Voz José: primera persona.",
  articleUrl: "https://www.room714.com/es/blog/mi-post",
};

describe("renderBriefingHtml", () => {
  it("incluye el texto íntegro, los hashtags y el recordatorio de voz", () => {
    const html = renderBriefingHtml({ tasks: [TASK_REVIEW], incidents: [], dateLabel: "lunes 27" });
    expect(html).toContain("Primera línea");
    expect(html).toContain("#IA #UX");
    expect(html).toContain("Voz José");
    expect(html).toContain("lunes 27");
  });

  it("escapa el HTML que venga en el texto de la variante", () => {
    const html = renderBriefingHtml({
      tasks: [{ ...TASK_REVIEW, text: '<script>alert("x")</script>' }],
      incidents: [],
      dateLabel: "lunes 27",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("avisa cuando una acción cruzada no tiene sugerencia", () => {
    const html = renderBriefingHtml({
      tasks: [
        {
          id: "reshare-1",
          kind: "reshare_company",
          when: "after",
          time: "10:00",
          channel: "empresa",
          title: "Recomparte el post desde la página de Room714",
          articleTitle: "Mi post",
          suggestion: null,
          articleUrl: "https://www.room714.com/es/blog/mi-post",
          linkUrl: "https://www.room714.com/api/go/variant/1",
        },
      ],
      incidents: [],
      dateLabel: "lunes 27",
    });
    expect(html).toContain("Sin sugerencia generada");
    expect(html).toContain("https://www.room714.com/api/go/variant/1");
  });

  it("lista las incidencias de ayer", () => {
    const html = renderBriefingHtml({
      tasks: [],
      incidents: [
        {
          id: "not-published-5",
          kind: "not_published",
          when: "before",
          time: "10:00",
          channel: null,
          title: "La derivación 2 de ayer no llegó a publicarse",
          articleTitle: "Mi post",
        },
      ],
      dateLabel: "martes 28",
    });
    expect(html).toContain("no llegó a publicarse");
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test`
Expected: FAIL, no se puede resolver `./dailyBriefing`.

- [ ] **Step 3: Implementar**

Crear `app/lib/notifications/dailyBriefing.js`:

```js
import { Resend } from "resend";

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

function block(inner) {
  return `<div style="border:1px solid #eaeaea;border-radius:10px;padding:16px;margin:0 0 14px;">${inner}</div>`;
}

function eyebrow(text) {
  return `<div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#888;">${esc(text)}</div>`;
}

function heading(text) {
  return `<h3 style="margin:6px 0 8px;font-size:16px;color:#111;">${esc(text)}</h3>`;
}

function button(href, label) {
  return `<a href="${esc(href)}" style="background:#000;color:#fff;padding:9px 16px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:bold;display:inline-block;margin:4px 8px 0 0;">${esc(label)}</a>`;
}

// Caja copiable: texto tal cual, respetando saltos de línea.
function copyBox(text) {
  return `<pre style="white-space:pre-wrap;word-wrap:break-word;background:#f6f6f6;border-radius:6px;padding:12px;margin:8px 0;font-family:inherit;font-size:14px;line-height:1.5;color:#222;">${esc(text)}</pre>`;
}

function timing(task) {
  const canal =
    task.channel === "personal"
      ? " · tu perfil"
      : task.channel === "empresa"
        ? " · página Room714"
        : "";
  const momento =
    task.when === "before"
      ? `Antes de las ${task.time}`
      : `A partir de las ${task.time}`;
  return `${momento}${canal}`;
}

export function renderTaskHtml(task) {
  switch (task.kind) {
    case "review_own":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">Artículo: ${esc(task.articleTitle)}</p>
        ${copyBox(task.text)}
        <p style="margin:0 0 10px;font-size:13px;color:#444;">${esc((task.hashtags || []).join(" "))}</p>
        <p style="margin:0;font-size:13px;color:#8a5a00;background:#fff8e6;padding:10px;border-radius:6px;">${esc(task.voiceHint)}</p>
      `);

    case "first_comment":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">El cuerpo del post va sin enlace; el enlace vive en el primer comentario.</p>
        ${copyBox(task.articleUrl)}
        ${button(task.linkUrl, "Ir al post")}
      `);

    case "reshare_company":
    case "comment_personal":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">Artículo: ${esc(task.articleTitle)}</p>
        ${
          task.suggestion
            ? copyBox(task.suggestion)
            : `<p style="margin:10px 0;font-size:13px;color:#999;font-style:italic;">Sin sugerencia generada para esta variante — escríbelo a mano.</p>`
        }
        ${button(task.linkUrl, "Ir al post")}
      `);

    case "blog_review":
      return block(`
        ${eyebrow(timing(task))}
        ${heading(task.title)}
        <p style="margin:0 0 4px;font-size:15px;color:#111;"><strong>${esc(task.articleTitle)}</strong></p>
        ${button(task.articleUrl, "Ver artículo")}${button(task.adminUrl, "Editar en el admin")}
      `);

    case "not_published":
      return block(`
        ${eyebrow(`Ayer a las ${task.time}`)}
        ${heading(task.title)}
        <p style="margin:0;color:#666;font-size:13px;">${esc(task.articleTitle)}. Revisa el escenario de Make o resetea la variante para que el cron la reintente.</p>
      `);

    default:
      return "";
  }
}

export function renderBriefingHtml({ tasks = [], incidents = [], dateLabel }) {
  const incidentsHtml = incidents.length
    ? `<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#b00020;margin:26px 0 12px;">No salió ayer</h2>${incidents.map(renderTaskHtml).join("")}`
    : "";

  return `
<div style="font-family: sans-serif; color: #333; max-width: 640px;">
  <h2 style="border-bottom:1px solid #eee;padding-bottom:10px;margin:0 0 6px;">Tus tareas de LinkedIn — ${esc(dateLabel)}</h2>
  <p style="margin:0 0 20px;color:#666;font-size:13px;">${tasks.length} ${tasks.length === 1 ? "tarea" : "tareas"}. Todo lo que necesitas está en este correo.</p>
  ${tasks.map(renderTaskHtml).join("")}
  ${incidentsHtml}
  <p style="margin-top:28px;font-size:12px;color:#999;">Las publicaciones salen solas vía Make. Esto es solo lo que tienes que hacer tú.</p>
</div>
  `.trim();
}

export async function sendDailyBriefingEmail({ tasks, incidents, dateLabel }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to =
    process.env.BRIEFING_EMAIL ||
    process.env.DRAFT_REVIEW_EMAIL ||
    "joseantonio.cesfranjo@room714.com";

  if (!apiKey) {
    console.warn("RESEND_API_KEY no configurada, saltando briefing");
    return { success: false, skipped: true };
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: "Room 714 <onboarding@resend.dev>",
      to: [to],
      subject: `Tus ${tasks.length} tareas de LinkedIn — ${dateLabel}`,
      html: renderBriefingHtml({ tasks, incidents, dateLabel }),
    });

    if (error) {
      console.error("Resend error (briefing):", error);
      return { success: false, error };
    }
    return { success: true };
  } catch (error) {
    console.error("dailyBriefing email error:", error);
    return { success: false, error: error.message };
  }
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test`
Expected: PASS, 41 tests en 5 ficheros.

- [ ] **Step 5: Commit**

```bash
git add app/lib/notifications/dailyBriefing.js app/lib/notifications/dailyBriefing.test.js
git commit -m "feat: render y envio del correo de briefing diario" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Ruta del cron y programación

**Files:**
- Create: `app/api/cron/daily-briefing/route.js`
- Modify: `vercel.json`

- [ ] **Step 1: Implementar la ruta**

```js
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import {
  formatMadridDateLabel,
  isMadridHour,
  madridDayRange,
} from "@/app/lib/time/madrid";
import { buildDailyTasks } from "@/app/lib/linkedin/dailyTasks";
import { sendDailyBriefingEmail } from "@/app/lib/notifications/dailyBriefing";

export const maxDuration = 60;

const TARGET_HOUR = 8;
const SITE = "https://www.room714.com";
const DAY_MS = 24 * 60 * 60 * 1000;

// Briefing diario de tareas manuales de LinkedIn.
//
// A las 08:00 y no a las 07:00: el cron `generate` corre a las 07:00 Madrid los
// lunes y miércoles y crea el post de ESE MISMO día con sus tres variantes
// (nextMadridSlot(10) devuelve las 10:00 de la jornada en curso). A las 07:00
// todavía no existirían justo los días con más tareas.
//
// Vercel programa en UTC, así que hay dos entradas en vercel.json (una por cada
// horario estacional) y aquí se descarta la que no toca. Eso resuelve de paso
// la idempotencia: de las dos ejecuciones solo una pasa el guard.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  // Modo preview: construye las tareas y las devuelve en JSON, sin enviar
  // correo y sin comprobar la hora.
  const preview = new URL(request.url).searchParams.get("preview") === "1";

  if (!preview && !isMadridHour(TARGET_HOUR)) {
    return NextResponse.json({
      message: "Saltado: no es la hora correcta en Madrid",
      targetHour: `${TARGET_HOUR}:00 Madrid`,
    });
  }

  const now = new Date();
  const { start, end } = madridDayRange(now);
  const yesterdayStart = new Date(start.getTime() - DAY_MS);

  try {
    const [todayVariants, yesterdayUnsent, blogPost] = await Promise.all([
      prisma.linkedInVariant.findMany({
        where: { scheduledFor: { gte: start, lte: end } },
        include: { post: { include: { translations: true } } },
        orderBy: { scheduledFor: "asc" },
      }),
      prisma.linkedInVariant.findMany({
        where: { sent: false, scheduledFor: { gte: yesterdayStart, lt: start } },
        include: { post: { include: { translations: true } } },
        orderBy: { scheduledFor: "asc" },
      }),
      prisma.post.findFirst({
        where: { published: true, date: { gte: start, lte: end } },
        include: { translations: true },
      }),
    ]);

    const { tasks, incidents } = buildDailyTasks({
      todayVariants,
      yesterdayUnsent,
      blogPost,
      siteUrl: process.env.NEXTAUTH_URL || SITE,
      firstCommentAutomated: process.env.FIRST_COMMENT_AUTOMATED === "true",
    });

    const dateLabel = formatMadridDateLabel(now);

    if (preview) {
      return NextResponse.json({
        mode: "preview",
        message: "Preview: nada enviado",
        dateLabel,
        tasks,
        incidents,
      });
    }

    // Día sin nada que hacer (festivo, generación fallida): no se envía correo.
    if (tasks.length === 0 && incidents.length === 0) {
      return NextResponse.json({
        message: "Sin tareas hoy, no se envía briefing",
        dateLabel,
        sent: false,
      });
    }

    const result = await sendDailyBriefingEmail({ tasks, incidents, dateLabel });

    return NextResponse.json({
      message: "Briefing diario procesado",
      dateLabel,
      taskCount: tasks.length,
      incidentCount: incidents.length,
      sent: result.success === true,
      skipped: result.skipped === true,
    });
  } catch (err) {
    console.error("❌ Error en cron daily-briefing:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Programar el cron**

En `vercel.json`, añadir dentro del array `"crons"`, después de la última entrada de `publish-linkedin`:

```json
    {
      "path": "/api/cron/daily-briefing",
      "schedule": "0 6 * * 1-5"
    },
    {
      "path": "/api/cron/daily-briefing",
      "schedule": "0 7 * * 1-5"
    }
```

06:00 UTC son las 08:00 de Madrid en horario de verano y 07:00 UTC en invierno. El guard `isMadridHour(8)` descarta la sobrante.

- [ ] **Step 3: Verificar el preview a mano**

Con `npm run dev` levantado:

```bash
curl -s "http://localhost:3000/api/cron/daily-briefing?preview=1" \
  -H "Authorization: Bearer <CRON_SECRET>" | head -60
```

Expected: JSON con `"mode":"preview"`, `dateLabel`, y un array `tasks`. Si hoy no hay variantes programadas, `tasks` estará vacío: no es un fallo. Para ver contenido, comprobar en el admin qué día tiene variantes o esperar a la verificación de la Task 15.

- [ ] **Step 4: Pasar el linter**

Run: `npx eslint app/api/cron/daily-briefing/route.js app/lib/linkedin app/lib/notifications/dailyBriefing.js "app/api/go/variant/[id]/route.js" app/api/webhooks/linkedin-published/route.js`
Expected: sin salida (exit 0).

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/daily-briefing/route.js vercel.json
git commit -m "feat: cron del briefing diario a las 08:00 de Madrid" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: El generador escribe la sugerencia

La mejor sugerencia la escribe el modelo cuando aún tiene el artículo entero en contexto, o sea en la generación de los lunes y miércoles, no a las 08:00 con solo el texto de la variante delante. Va en la llamada que ya se hace, así que no añade coste ni un punto de fallo al cron.

`cross_note` se declara **opcional** en el esquema de la herramienta: así los otros caminos de generación (`generatePostFromIdea`, que no conoce los slots) siguen funcionando sin producir sugerencias fuera de contexto.

**Files:**
- Modify: `app/lib/ai/generator.js:61-95` (esquema), `:146` y `:199` (prompt), `:421-424` (firma)
- Modify: `app/lib/ai/orchestrator.js:16` (import), `:61` (llamada), `:129-139` (persistencia)

- [ ] **Step 1: Añadir el campo al esquema de la herramienta**

En `app/lib/ai/generator.js`, dentro de `linkedin_variants.items.properties`, después de `image_query`:

```js
            cross_note: {
              type: "string",
              description:
                "Texto sugerido para la ACCIÓN CRUZADA de esta variante, si la tiene (te la indico en el prompt). Máximo 2 frases. Si la variante no tiene acción cruzada, cadena vacía.",
            },
```

`required` se deja como está (`["angle", "text", "hashtags", "image_query"]`): el campo es opcional.

- [ ] **Step 2: Añadir el bloque de instrucciones al prompt**

En `app/lib/ai/generator.js`, justo antes de `function buildUserPrompt`:

```js
const CROSS_ACTION_BRIEF = {
  comment_personal:
    "COMENTARIO DE JOSÉ. Esta variante la publica la página de Room714, y José comenta debajo desde su perfil personal. Escribe en cross_note ese comentario: 1-2 frases en primera persona que APORTEN un dato, un matiz o un contraejemplo que no esté en el post. Prohibido el elogio genérico tipo 'gran reflexión'.",
  reshare_company:
    "RECOMPARTICIÓN DE ROOM714. Esta variante la publica José desde su perfil, y la página de Room714 la recomparte. Escribe en cross_note la línea con la que la página lo comparte: 1-2 frases en voz corporativa de Room714, que enmarquen por qué el tema importa. NO repitas el hook del post.",
};

function buildCrossNotesBlock(crossActions) {
  if (!crossActions || crossActions.every((a) => !a)) return "";

  const lines = crossActions.map((action, i) => {
    const n = i + 1;
    return action
      ? `- Variante ${n}: ${CROSS_ACTION_BRIEF[action]}`
      : `- Variante ${n}: sin acción cruzada. Deja cross_note como cadena vacía.`;
  });

  return `

## ACCIONES CRUZADAS (campo cross_note de cada variante)

Cada variante se publica en una sola cuenta, y algunas llevan una acción en la otra cuenta. Rellena cross_note según lo que le toque a cada una:

${lines.join("\n")}`;
}
```

- [ ] **Step 3: Colgar el bloque del prompt y de la firma**

En `app/lib/ai/generator.js`, cambiar la firma de `buildUserPrompt` (línea 146):

```js
function buildUserPrompt({ category, trending, recentPosts, crossActions }) {
```

Y en el `return` de esa función, cambiar la última línea para que quede:

```js
Llama al tool create_blog_post con los campos correspondientes.${buildCrossNotesBlock(crossActions)}`;
```

Y en `generatePostDraft` (línea 421):

```js
export async function generatePostDraft({ category, trending, recentPosts, crossActions }) {
  const userPrompt = buildUserPrompt({ category, trending, recentPosts, crossActions });
  return generateViaCreateBlogPostTool({ userPrompt, recentPosts });
}
```

- [ ] **Step 4: Pasar las acciones y persistir el resultado**

En `app/lib/ai/orchestrator.js`, ampliar el import de la línea 16:

```js
import { crossActionsFor, variantScheduleFor } from "@/app/lib/time/linkedinSchedule";
```

Cambiar la llamada de la línea 61:

```js
  const draft = await generatePostDraft({
    category,
    trending,
    recentPosts,
    crossActions: crossActionsFor(publishDate),
  });
```

Y en el `create` de las variantes (línea 130), añadir el campo:

```js
      linkedinVariants: {
        create: variants.map((v, idx) => ({
          variant: idx + 1,
          angle: v.angle,
          text: v.text,
          hashtags: v.hashtags || [],
          imageBlobUrl: variantImages[idx],
          imageQuery: v.image_query,
          crossNote: v.cross_note?.trim() || null,
          scheduledFor: variantSchedules[idx],
        })),
      },
```

`?.trim() || null` cubre los tres casos de degradación: campo ausente, cadena vacía y variante sin acción cruzada. Si falta, el correo omite la línea de sugerencia y la tarea sigue en pie.

- [ ] **Step 5: Verificar que el conjunto sigue en pie**

Run: `npm test`
Expected: PASS, 41 tests (esta tarea no añade tests: lo que cambia es un prompt, y su resultado se comprueba generando de verdad en la Task 15).

Run: `npx eslint app/lib/ai/generator.js app/lib/ai/orchestrator.js`
Expected: sin salida (exit 0).

- [ ] **Step 6: Commit**

```bash
git add app/lib/ai/generator.js app/lib/ai/orchestrator.js
git commit -m "feat: el generador escribe la sugerencia de accion cruzada" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Variables de entorno

**Files:**
- Modify: `.env.local` (local, no versionado)
- Panel de Vercel (producción)

- [ ] **Step 1: Generar el secreto del callback**

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Guardar el valor: lo necesitan tanto `.env.local` como Vercel como el módulo HTTP de Make (Task 14).

- [ ] **Step 2: Añadir las variables a `.env.local`**

Sustituyendo los valores de ejemplo por los reales:

```
MAKE_CALLBACK_SECRET=<el hex generado en el Step 1>
LINKEDIN_PROFILE_URL=https://www.linkedin.com/in/tu-perfil/recent-activity/all/
LINKEDIN_COMPANY_URL=https://www.linkedin.com/company/room714/posts/
BRIEFING_EMAIL=joseantonio.cesfranjo@room714.com
```

Las URLs de respaldo apuntan a la pestaña de publicaciones a propósito: si Make aún no ha devuelto la URL del post, ahí el post del día es el primero de la lista.

`FIRST_COMMENT_AUTOMATED` no se define: por defecto la tarea del primer comentario aparece. Solo se añade con valor `true` si algún día Make pasa a publicar el comentario solo.

- [ ] **Step 3: Añadir las mismas variables en Vercel**

En el panel del proyecto → Settings → Environment Variables, las cuatro, para el entorno Production. Sin esto el cron desplegado enviará enlaces de respaldo al perfil genérico y el callback devolverá 401 a Make.

---

### Task 14: Configuración en Make

Dos cambios en el escenario, ambos en el Router. El primero es el filtro de canal que quedó pendiente; el segundo es el callback nuevo.

**Requisito previo:** las Tasks 1-13 desplegadas en producción (Task 15, Step 1), porque el módulo HTTP llama a una URL que tiene que existir.

- [ ] **Step 1: Filtrar la ruta del perfil personal**

Abrir el escenario en Make. Pulsar sobre la línea de puntos entre el Router y el módulo **Create a User Image Post** (el icono de la llave inglesa).

- Label: `Solo personal`
- Condition: campo izquierdo `canal` (se elige del payload del webhook, en la lista de variables disponibles)
- Operador: `Text operators: Equal to`
- Campo derecho: `personal`

Guardar con **OK**.

- [ ] **Step 2: Filtrar la ruta de la página de empresa**

Lo mismo en la línea que va al módulo **Create a Company Image Post**:

- Label: `Solo empresa`
- Condition: `canal` · `Equal to` · `empresa`

Guardar con **OK**.

- [ ] **Step 3: Añadir el módulo de callback a la ruta personal**

Al final de la ruta personal, después de **Create a User Image Post**, añadir un módulo **HTTP → Make a request**:

- URL: `https://www.room714.com/api/webhooks/linkedin-published`
- Method: `POST`
- Headers: uno solo → Name `Authorization`, Value `Bearer <MAKE_CALLBACK_SECRET>` (el hex de la Task 13, Step 1)
- Body type: `Raw`
- Content type: `JSON (application/json)`
- Request content:

```json
{
  "variant_id": {{1.variant_id}},
  "post_urn": "{{2.id}}"
}
```

`{{1.variant_id}}` es el campo `variant_id` que ya viaja en el payload del webhook (lo pone `buildWebhookPayload`); el `1` es el número del módulo del webhook. `{{2.id}}` es el identificador que devuelve el módulo de LinkedIn; el `2` es su número. **Ambos números hay que cogerlos de la burbuja de cada módulo en el lienzo, no darlos por buenos** — cambian según el orden en que se montó el escenario. Se eligen pinchando en el campo y seleccionando la variable de la lista, que es la forma segura de no equivocarse.

- Marcar **Evaluate all states as errors** como desactivado, para que un fallo del callback no tumbe la ejecución: si no llega la URL, el correo enlaza al perfil y la tarea se hace igual.

- [ ] **Step 4: Añadir el mismo módulo a la ruta de empresa**

Idéntico al Step 3, al final de la ruta de **Create a Company Image Post**, ajustando el número del módulo de LinkedIn en `{{N.id}}`.

- [ ] **Step 5: Probar el escenario**

Con **Run once** en Make y un disparo real del cron (o reenviando un payload de prueba con `canal: "personal"`), comprobar que:

- Solo se ejecuta una de las dos rutas del Router (la del canal del payload).
- El módulo HTTP devuelve `200` con cuerpo `{"ok":true,"url":"https://www.linkedin.com/feed/update/..."}`.

Si devuelve `401`, el secreto de la cabecera no coincide con `MAKE_CALLBACK_SECRET` en Vercel. Si devuelve `400`, revisar que `variant_id` llega como número y no como texto vacío.

---

### Task 15: Verificación de punta a punta

- [ ] **Step 1: Desplegar**

```bash
git checkout main
git merge --no-ff feat/linkedin-daily-briefing
git push origin main
```

Un push a `main` despliega. Comprobar en el panel de Vercel que el build termina en verde y que los dos crons nuevos aparecen listados.

- [ ] **Step 2: Comprobar el preview en producción**

```bash
curl -s "https://www.room714.com/api/cron/daily-briefing?preview=1" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expected: JSON con las tareas del día. Un martes o jueves debería traer una única tarea `comment_personal`; un lunes o miércoles, `review_own` + `first_comment` + `blog_review`.

- [ ] **Step 3: Provocar un envío real**

El preview no manda correo. Para recibirlo sin esperar al cron, lanzar la ruta sin `preview` **dentro de la hora 8 de Madrid** (el guard `isMadridHour(8)` rechaza el resto del día):

```bash
curl -s "https://www.room714.com/api/cron/daily-briefing" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expected: `{"message":"Briefing diario procesado", ..., "sent":true}` y el correo en la bandeja.

Fuera de esa hora la respuesta será `Saltado: no es la hora correcta en Madrid`, que también es una comprobación válida de que el guard funciona.

- [ ] **Step 4: Verificar la sugerencia generada**

Después de la primera generación posterior al despliegue (lunes o miércoles a las 07:00), comprobar que las variantes traen `crossNote`:

```bash
curl -s "https://www.room714.com/api/cron/publish-linkedin?preview=1" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

O directamente en el briefing del día siguiente: la tarea de comentar debe llevar su texto sugerido en vez del aviso "Sin sugerencia generada".

Las variantes generadas **antes** del despliegue no la tendrán. Es lo esperado y está documentado en el spec.

- [ ] **Step 5: Verificar el enlace de un clic**

En el correo del día, pulsar **Ir al post** después de las 10:00. Debe abrir el post concreto en LinkedIn, no el perfil ni la página. Si abre el perfil, el callback de Make no llegó: revisar el historial de ejecuciones del escenario (Task 14, Step 5).

---

## Notas de revisión

Repasado contra el spec, sección por sección:

- Las decisiones 1 a 9 tienen tarea asignada. La decisión 5 (anatomía del correo) se reparte entre las Tasks 5, 6 y 10; la decisión 3 (enlaces) entre las Tasks 7, 8 y 9.
- **Una desviación respecto al spec:** `buildDailyTasks` devuelve `{ tasks, incidents }` en vez de una lista única. Las incidencias de ayer son informativas y no tareas de hoy, y separarlas evita colarlas en el orden cronológico del día. El campo `kind: "not_published"` se mantiene tal como estaba especificado.
- La sección "Configuración en Make" del spec es la Task 14, con los pasos concretos de la interfaz.
- Los nombres cruzan bien entre tareas: `slotFor`/`crossActionsFor` (Task 2) se consumen en las Tasks 5 y 12; `linkedInUrlFrom` (Task 7) en la Task 8; `buildDailyTasks` (Tasks 5-6) y `sendDailyBriefingEmail` (Task 10) en la Task 11; `madridDayRange`/`formatMadridTime`/`formatMadridDateLabel` (Task 3) en las Tasks 5, 6, 10 y 11.
