# Calendario de publicación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Concentrar toda la publicación automática en la franja 07:30–08:00 de Madrid, y generar las tomas de LinkedIn a las 08:30 a partir del artículo ya revisado en vez de del borrador.

**Architecture:** Hoy `generatePostDraft` devuelve artículo y 3 variantes de LinkedIn en una sola llamada, y el orquestador las guarda juntas. Se parte en dos: el cron de las 06:00 genera solo el artículo (visible a las 07:30), y un cron nuevo de las 08:30 lee el artículo tal y como haya quedado en base de datos y genera sus tomas. El calendario de tomas pasa de 6 huecos semanales a 5 (3 del artículo del lunes: L, M, V; 2 del artículo del miércoles: X, J) y vive entero en `linkedinSchedule.js` como una tabla de datos.

**Tech Stack:** Next.js 16 (App Router), Prisma 6 + PostgreSQL, Anthropic SDK, vitest, crones de Vercel.

**Spec:** `docs/superpowers/specs/2026-08-29-calendario-publicacion-design.md`

---

## Contexto que el implementador necesita

**Zonas horarias.** Vercel programa los crones en **UTC**; el negocio piensa en **Madrid**, que es UTC+1 en invierno (CET) y UTC+2 en verano (CEST). El proyecto ya resuelve esto con un patrón fijo: **dos entradas de cron por horario** (una para cada estación) y un **guard de hora Madrid** dentro de la ruta que descarta la ejecución que no toca. Nunca se calcula un desfase a mano.

**El artículo se hace visible solo.** `Post.date` es la hora de publicación y el blog filtra `date <= now`. El cron `/api/cron/publish` no publica: marca `published_sent` y avisa a la Google Indexing API. Cambiar la hora de publicación es cambiar `Post.date`.

**Orden de ejecución, y la ventana en que la rama está rota.** Las tareas 4, 5 y 6 añaden código nuevo sin tocar el existente; la 7 es la que corta el cordón, y por eso cambia generador y orquestador en el mismo commit.

Pero **desde la Tarea 2 hasta la 7 la rama no es desplegable**, y conviene decirlo claro en vez de descubrirlo:

- La Tarea 2 deja `variantScheduleFor` devolviendo 2 fechas para un artículo de miércoles, mientras `create_blog_post` sigue exigiendo exactamente 3 variantes. El orquestador programa la tercera con `scheduledFor: undefined`, y como en `prisma/schema.prisma` ese campo es obligatorio, `prisma.post.create` lanza y **el artículo del miércoles no llega a crearse**. Lo arregla la Tarea 7.
- La Tarea 2 también deja en rojo dos tests de `app/lib/linkedin/dailyTasks.test.js`, escritos contra el calendario de seis huecos. Los arregla la Tarea 9.

Nada de esto afecta a producción mientras el trabajo viva en `feat/calendario-publicacion`. La regla es simple: **no hacer push hasta que hayan aterrizado la 7 y la 9**, y comprobar antes que `npx vitest run` está entero en verde.

**Comandos.** Tests: `npx vitest run <ruta>`. Todo: `npx vitest run`. Se ejecutan desde `my-app/`.

---

## Estructura de ficheros

| Fichero | Responsabilidad | Acción |
|---|---|---|
| `app/lib/time/madrid.js` | Aritmética de la zona horaria de Madrid | Modificar: `nextMadridSlot` acepta minutos |
| `app/lib/time/linkedinSchedule.js` | Cuándo sale cada toma, por qué canal y con qué acción cruzada | Reescribir la tabla y el cálculo |
| `app/lib/ai/generator.js` | Llamadas al modelo que producen contenido | Modificar: quitar variantes de `create_blog_post`; añadir `generateLinkedInTakes` |
| `app/lib/ai/orchestrator.js` | Orquestación: leer BD, llamar al generador, escribir BD | Modificar: publicar a las 7:30, no crear variantes; añadir `generateTakesForToday` |
| `app/api/cron/generate-linkedin/route.js` | Disparador de las 08:30 | Crear |
| `app/api/cron/generate/route.js` | Disparador de las 06:00 | Modificar: hora objetivo |
| `app/api/cron/publish/route.js` | Marcado e indexación del artículo | Modificar: hora AUTO |
| `app/lib/linkedin/dailyTasks.js` | Tareas manuales del briefing | Modificar: quitar la revisión previa |
| `app/lib/notifications/draftReady.js` | Correo de borrador listo | Modificar: textos de hora |
| `vercel.json` | Programación de crones | Modificar |

---

## Task 1: `nextMadridSlot` acepta minutos

El artículo pasa a publicarse a las **07:30**, y el helper actual solo sabe devolver horas en punto.

**Files:**
- Modify: `app/lib/time/madrid.js:95-115`
- Test: `app/lib/time/madrid.test.js`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `app/lib/time/madrid.test.js`. Ojo: `nextMadridSlot` lee `new Date()` por dentro, así que hay que congelar el reloj.

```javascript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextMadridSlot } from "./madrid";

describe("nextMadridSlot", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve las 07:30 de Madrid del mismo día en horario de verano", () => {
    // Lunes 27 de julio de 2026, 06:00 Madrid (CEST = UTC+2) → 04:00 UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T04:00:00Z"));

    const slot = nextMadridSlot(7, 30);

    expect(slot.toISOString()).toBe("2026-07-27T05:30:00.000Z");
  });

  it("devuelve las 07:30 de Madrid del mismo día en horario de invierno", () => {
    // Lunes 5 de enero de 2026, 06:00 Madrid (CET = UTC+1) → 05:00 UTC.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T05:00:00Z"));

    const slot = nextMadridSlot(7, 30);

    expect(slot.toISOString()).toBe("2026-01-05T06:30:00.000Z");
  });

  it("salta al siguiente día laborable si la hora ya pasó", () => {
    // Viernes 31 de julio de 2026, 09:00 Madrid: las 07:30 ya pasaron.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T07:00:00Z"));

    const slot = nextMadridSlot(7, 30);

    // Lunes 3 de agosto, 07:30 Madrid (CEST).
    expect(slot.toISOString()).toBe("2026-08-03T05:30:00.000Z");
  });

  it("sigue funcionando sin minutos, como antes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T04:00:00Z"));

    expect(nextMadridSlot(10).toISOString()).toBe("2026-07-27T08:00:00.000Z");
  });
});
```

El fichero ya importa de `vitest`; ajusta la línea de import existente en lugar de duplicarla, y añade `nextMadridSlot` al import de `./madrid` que ya hay arriba.

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `npx vitest run app/lib/time/madrid.test.js`
Expected: FAIL. Los tres primeros casos devuelven las 07:00 en punto, no las 07:30.

- [ ] **Step 3: Implementar**

Sustituir `nextMadridSlot` en `app/lib/time/madrid.js`:

```javascript
// Próximo instante en que Madrid marque `targetHour:targetMinute` en un día
// laborable. El bucle recorre horas UTC porque los desfases de Madrid son de
// hora entera: el minuto de Madrid y el minuto UTC coinciden siempre, así que
// fijarlo aquí no altera la comprobación de la hora.
export function nextMadridSlot(targetHour, targetMinute = 0) {
  const now = new Date();
  const targetStr = String(targetHour).padStart(2, "0");

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    for (let utcHour = 0; utcHour < 24; utcHour++) {
      const candidate = new Date(now);
      candidate.setUTCDate(candidate.getUTCDate() + dayOffset);
      candidate.setUTCHours(utcHour, targetMinute, 0, 0);

      if (candidate <= now) continue;

      const { hour, weekday } = getMadridParts(candidate);
      if (hour === targetStr && !["Sat", "Sun"].includes(weekday)) {
        return candidate;
      }
    }
  }
  throw new Error(
    `nextMadridSlot: no se encontró slot para ${targetHour}:${String(targetMinute).padStart(2, "0")}`,
  );
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `npx vitest run app/lib/time/madrid.test.js`
Expected: PASS, todos los casos.

- [ ] **Step 5: Commit**

```bash
git add app/lib/time/madrid.js app/lib/time/madrid.test.js
git commit -m "feat(time): nextMadridSlot acepta minutos para la franja de las 7:30"
```

---

## Task 2: Reescribir el calendario de tomas

De 3 variantes por artículo a un plan por día de publicación: el artículo del lunes lleva 3 tomas (L, M, V) y el del miércoles 2 (X, J).

**Files:**
- Modify: `app/lib/time/linkedinSchedule.js` (reescritura completa)
- Test: `app/lib/time/linkedinSchedule.test.js` (reescritura completa)

- [ ] **Step 1: Escribir los tests que fallan**

Sustituir **todo** el contenido de `app/lib/time/linkedinSchedule.test.js`:

```javascript
import { describe, expect, it } from "vitest";
import {
  channelForVariant,
  crossActionsFor,
  jitterMinutesFor,
  slotFor,
  takeCountFor,
  variantScheduleFor,
} from "./linkedinSchedule";

// Los artículos se publican a las 07:30 de Madrid.
// Lunes 27 de julio de 2026 (CEST = UTC+2) → 05:30 UTC.
const LUNES = new Date("2026-07-27T05:30:00Z");
// Miércoles 29 de julio de 2026, 07:30 Madrid.
const MIERCOLES = new Date("2026-07-29T05:30:00Z");

const MIN_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

describe("takeCountFor", () => {
  it("da tres tomas al artículo del lunes y dos al del miércoles", () => {
    expect(takeCountFor(LUNES)).toBe(3);
    expect(takeCountFor(MIERCOLES)).toBe(2);
  });

  it("cae en el plan del lunes si el artículo sale un día no previsto", () => {
    const viernes = new Date("2026-07-31T05:30:00Z");
    expect(takeCountFor(viernes)).toBe(3);
  });
});

describe("variantScheduleFor", () => {
  it("reparte el artículo del lunes en lunes, martes y viernes", () => {
    const [t1, t2, t3] = variantScheduleFor(LUNES);
    const base = LUNES.getTime();

    // Toma 1: mismo día a las 08:35 (65 min después del artículo), +0..+8.
    const off1 = (t1.getTime() - (base + 65 * MIN_MS)) / MIN_MS;
    expect(off1).toBeGreaterThanOrEqual(0);
    expect(off1).toBeLessThanOrEqual(8);

    // Toma 2: martes a las 07:30, +0..+28.
    const off2 = (t2.getTime() - (base + DAY_MS)) / MIN_MS;
    expect(off2).toBeGreaterThanOrEqual(0);
    expect(off2).toBeLessThanOrEqual(28);

    // Toma 3: viernes a las 07:30, +0..+28.
    const off3 = (t3.getTime() - (base + 4 * DAY_MS)) / MIN_MS;
    expect(off3).toBeGreaterThanOrEqual(0);
    expect(off3).toBeLessThanOrEqual(28);
  });

  it("reparte el artículo del miércoles en miércoles y jueves", () => {
    const fechas = variantScheduleFor(MIERCOLES);
    expect(fechas).toHaveLength(2);

    const base = MIERCOLES.getTime();
    const off1 = (fechas[0].getTime() - (base + 65 * MIN_MS)) / MIN_MS;
    const off2 = (fechas[1].getTime() - (base + DAY_MS)) / MIN_MS;
    expect(off1).toBeGreaterThanOrEqual(0);
    expect(off1).toBeLessThanOrEqual(8);
    expect(off2).toBeGreaterThanOrEqual(0);
    expect(off2).toBeLessThanOrEqual(28);
  });

  it("ninguna toma se sale de su franja de publicación", () => {
    const todas = [
      ...variantScheduleFor(LUNES),
      ...variantScheduleFor(MIERCOLES),
    ];
    for (const fecha of todas) {
      const minutos = fecha.getUTCHours() * 60 + fecha.getUTCMinutes();
      // En CEST: la franja de mañana es 05:30-05:58 UTC y la de después de
      // la revisión 06:35-06:43 UTC.
      const enFranjaManana = minutos >= 5 * 60 + 30 && minutos <= 5 * 60 + 58;
      const enFranjaRevision = minutos >= 6 * 60 + 35 && minutos <= 6 * 60 + 43;
      expect(enFranjaManana || enFranjaRevision).toBe(true);
    }
  });

  it("es determinista: el mismo artículo produce siempre el mismo horario", () => {
    const a = variantScheduleFor(LUNES).map((d) => d.toISOString());
    const b = variantScheduleFor(new Date(LUNES)).map((d) => d.toISOString());
    expect(a).toEqual(b);
  });

  it("mantiene el orden entre tomas", () => {
    const [t1, t2, t3] = variantScheduleFor(LUNES);
    expect(t1.getTime()).toBeLessThan(t2.getTime());
    expect(t2.getTime()).toBeLessThan(t3.getTime());
  });

  it("la toma del lunes no pisa la del martes ni la del miércoles", () => {
    const [, martes, viernes] = variantScheduleFor(LUNES);
    const [miercoles, jueves] = variantScheduleFor(MIERCOLES);
    const orden = [martes, miercoles, jueves, viernes].map((d) => d.getTime());
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  it("el jitter varía entre artículos y entre tomas", () => {
    const offsets = [LUNES, MIERCOLES].flatMap((fecha) =>
      [0, 1, 2].map((idx) => jitterMinutesFor(fecha, idx)),
    );
    expect(new Set(offsets).size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run app/lib/time/linkedinSchedule.test.js`
Expected: FAIL con `takeCountFor is not a function` y desajustes de ventana.

- [ ] **Step 3: Reescribir el módulo**

Sustituir **todo** el contenido de `app/lib/time/linkedinSchedule.js`:

```javascript
// Calendario de las tomas de LinkedIn de un artículo.
//
// Supuesto de entrada: el artículo se publica a las 07:30 de Madrid, un lunes
// o un miércoles. Todo lo de aquí se calcula como desplazamiento respecto a esa
// fecha, así que si cambia la hora de publicación hay que revisar TAKE_PLAN.
//
// La semana queda así:
//   L 08:35  art.1 toma 1  personal  → Room714 recomparte
//   M 07:30  art.1 toma 2  empresa   → José comenta desde su perfil
//   X 08:35  art.2 toma 1  personal  → Room714 recomparte
//   J 07:30  art.2 toma 2  empresa   → José comenta desde su perfil
//   V 07:30  art.1 toma 3  personal  → Room714 recomparte
//
// Por qué la toma 1 sale a las 08:35 y no en la franja de las 07:30: se genera
// a las 08:30, a partir del artículo que se acaba de revisar a mano. No puede
// existir antes. Es la única excepción del calendario y es deliberada.
//
// Por qué se puede sumar milisegundos sin preocuparse del cambio de hora: las
// tomas de un artículo van de lunes a viernes y los cambios de horario ocurren
// en domingo de madrugada, así que ninguna suma cruza uno.
import { getMadridWeekday } from "./madrid";

const MIN_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// El plan completo, en un solo sitio: cuándo sale cada toma respecto al
// artículo, con cuánto margen aleatorio, por qué cuenta y qué le deja que hacer
// a la otra. Cambiar la estrategia de publicación es cambiar esta tabla.
//
// `offsetMin` es la distancia en minutos desde la publicación del artículo
// (07:30): 65 son las 08:35 del mismo día, 1440 las 07:30 del día siguiente y
// 5760 las 07:30 del viernes.
//
// `jitter` evita que las cinco publicaciones semanales caigan siempre en el
// mismo minuto exacto, que es lo que delata a un robot. La ventana de la toma 1
// es corta a propósito: el briefing sale a las 08:50 y tiene que encontrarla ya
// publicada.
const TAKE_PLAN = {
  Mon: [
    { offsetMin: 65, jitter: { min: 0, max: 8 }, canal: "personal", cross: "reshare_company" },
    { offsetMin: 1440, jitter: { min: 0, max: 28 }, canal: "empresa", cross: "comment_personal" },
    { offsetMin: 5760, jitter: { min: 0, max: 28 }, canal: "personal", cross: "reshare_company" },
  ],
  Wed: [
    { offsetMin: 65, jitter: { min: 0, max: 8 }, canal: "personal", cross: "reshare_company" },
    { offsetMin: 1440, jitter: { min: 0, max: 28 }, canal: "empresa", cross: "comment_personal" },
  ],
};

// Si un artículo cae en un día no previsto (recuperación manual, cambio de
// calendario), se aplica el plan del lunes en vez de fallar: perder el
// equilibrio de la semana es preferible a quedarse sin publicar.
const FALLBACK_PLAN = TAKE_PLAN.Mon;

function planFor(postPublishDate) {
  const weekday = getMadridWeekday(postPublishDate);
  return TAKE_PLAN[weekday] || FALLBACK_PLAN;
}

// FNV-1a de 32 bits. No necesitamos calidad criptográfica: solo dispersión
// estable entre ejecuciones y entornos (nada de Math.random, que rompería los
// tests y daría horarios distintos en cada despliegue).
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function jitterMinutesFor(postPublishDate, takeIndex) {
  const plan = planFor(postPublishDate);
  const window = (plan[takeIndex] || plan[0]).jitter;
  const seed = hash32(`${postPublishDate.toISOString()}#t${takeIndex + 1}`);
  return window.min + (seed % (window.max - window.min + 1));
}

// Cuántas tomas de LinkedIn lleva el artículo de esa fecha. Lo consume el
// generador para pedirle al modelo exactamente ese número.
export function takeCountFor(postPublishDate) {
  return planFor(postPublishDate).length;
}

export function variantScheduleFor(postPublishDate) {
  const base = postPublishDate.getTime();
  return planFor(postPublishDate).map(
    (take, idx) =>
      new Date(
        base +
          take.offsetMin * MIN_MS +
          jitterMinutesFor(postPublishDate, idx) * MIN_MS,
      ),
  );
}

export function slotFor({ postPublishDate, variant }) {
  const plan = planFor(postPublishDate);
  return plan[variant - 1] || plan[0];
}

export function channelForVariant({ postPublishDate, variant }) {
  return slotFor({ postPublishDate, variant }).canal;
}

// Las acciones cruzadas en el orden de las tomas. Lo consume el generador para
// decirle al modelo qué sugerencia escribir en cada una.
export function crossActionsFor(postPublishDate) {
  return planFor(postPublishDate).map((take) => take.cross);
}

// `DAY_MS` queda a la vista para quien lea TAKE_PLAN y quiera comprobar que
// 1440 y 5760 son un día y cuatro días en minutos.
export const DAY_MINUTES = DAY_MS / MIN_MS;
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx vitest run app/lib/time/linkedinSchedule.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/time/linkedinSchedule.js app/lib/time/linkedinSchedule.test.js
git commit -m "feat(linkedin): calendario de 5 tomas semanales en la franja de las 7:30"
```

---

## Task 3: Tests del reparto de canal y acciones cruzadas

Separado de la tarea anterior para que el reparto personal/empresa quede blindado por su cuenta: es la parte que se va a querer tocar y la que no debe romperse sin avisar.

**Files:**
- Test: `app/lib/time/linkedinSchedule.test.js` (añadir)

- [ ] **Step 1: Escribir los tests**

Añadir al final de `app/lib/time/linkedinSchedule.test.js`:

```javascript
describe("channelForVariant", () => {
  it("saca el artículo del lunes por personal, empresa y personal", () => {
    const canales = [1, 2, 3].map((variant) =>
      channelForVariant({ postPublishDate: LUNES, variant }),
    );
    expect(canales).toEqual(["personal", "empresa", "personal"]);
  });

  it("saca el artículo del miércoles por personal y empresa", () => {
    const canales = [1, 2].map((variant) =>
      channelForVariant({ postPublishDate: MIERCOLES, variant }),
    );
    expect(canales).toEqual(["personal", "empresa"]);
  });

  it("deja la semana en 3 personal y 2 empresa", () => {
    const semana = [
      ...[1, 2, 3].map((v) =>
        channelForVariant({ postPublishDate: LUNES, variant: v }),
      ),
      ...[1, 2].map((v) =>
        channelForVariant({ postPublishDate: MIERCOLES, variant: v }),
      ),
    ];
    expect(semana.filter((c) => c === "personal")).toHaveLength(3);
    expect(semana.filter((c) => c === "empresa")).toHaveLength(2);
  });

  it("resuelve el día de la semana en horario de invierno", () => {
    // Lunes 5 de enero de 2026, 07:30 Madrid (CET = UTC+1).
    const lunesInvierno = new Date("2026-01-05T06:30:00Z");
    expect(
      channelForVariant({ postPublishDate: lunesInvierno, variant: 2 }),
    ).toBe("empresa");
  });
});

describe("crossActionsFor", () => {
  it("da tres acciones al artículo del lunes", () => {
    expect(crossActionsFor(LUNES)).toEqual([
      "reshare_company",
      "comment_personal",
      "reshare_company",
    ]);
  });

  it("da dos al del miércoles", () => {
    expect(crossActionsFor(MIERCOLES)).toEqual([
      "reshare_company",
      "comment_personal",
    ]);
  });

  it("deja exactamente una acción cruzada por día de la semana", () => {
    const semana = [...crossActionsFor(LUNES), ...crossActionsFor(MIERCOLES)];
    expect(semana).toHaveLength(5);
    expect(semana.every(Boolean)).toBe(true);
  });
});

describe("slotFor", () => {
  it("devuelve canal y acción cruzada juntos", () => {
    expect(slotFor({ postPublishDate: LUNES, variant: 1 })).toMatchObject({
      canal: "personal",
      cross: "reshare_company",
    });
    expect(slotFor({ postPublishDate: MIERCOLES, variant: 2 })).toMatchObject({
      canal: "empresa",
      cross: "comment_personal",
    });
  });

  it("cae en la primera toma si la variante está fuera de rango", () => {
    expect(slotFor({ postPublishDate: MIERCOLES, variant: 9 })).toMatchObject({
      canal: "personal",
      cross: "reshare_company",
    });
  });
});
```

Se usa `toMatchObject` y no `toEqual` porque los objetos del plan llevan además `offsetMin` y `jitter`: al consumidor solo le importan `canal` y `cross`.

- [ ] **Step 2: Ejecutar y ver que pasa**

Run: `npx vitest run app/lib/time/linkedinSchedule.test.js`
Expected: PASS. La implementación de la Task 2 ya cubre estos casos; estos tests fijan el contrato.

- [ ] **Step 3: Commit**

```bash
git add app/lib/time/linkedinSchedule.test.js
git commit -m "test(linkedin): fija el reparto 3 personal / 2 empresa de la semana"
```

---

## Task 4: `generateLinkedInTakes`

Función nueva y aditiva: nadie la llama todavía, así que no puede romper nada.

**Files:**
- Modify: `app/lib/ai/generator.js` (añadir al final)
- Test: `app/lib/ai/generator.test.js` (añadir)

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final de `app/lib/ai/generator.test.js`. Se prueban las dos piezas puras: el prompt y la validación.

```javascript
import { buildTakesPrompt, validateTakes } from "./generator";

describe("buildTakesPrompt", () => {
  const base = {
    articleTitle: "El impuesto de lujo de la deuda técnica",
    articleContentEs: "<p>Un párrafo del artículo.</p><h2>Sección</h2>",
    articleUrl: "https://www.room714.com/es/blog/impuesto-de-lujo",
    count: 3,
    crossActions: ["reshare_company", "comment_personal", "reshare_company"],
  };

  it("pide exactamente el número de tomas que se le indica", () => {
    expect(buildTakesPrompt(base)).toContain("exactamente 3 tomas");
    expect(buildTakesPrompt({ ...base, count: 2 })).toContain(
      "exactamente 2 tomas",
    );
  });

  it("incluye el título y el contenido del artículo", () => {
    const prompt = buildTakesPrompt(base);
    expect(prompt).toContain("El impuesto de lujo de la deuda técnica");
    expect(prompt).toContain("Un párrafo del artículo.");
  });

  it("describe la acción cruzada de cada toma", () => {
    const prompt = buildTakesPrompt(base);
    expect(prompt).toContain("Toma 1:");
    expect(prompt).toContain("Toma 3:");
  });

  it("no habla de acciones cruzadas si no hay ninguna", () => {
    const prompt = buildTakesPrompt({
      ...base,
      crossActions: [null, null, null],
    });
    expect(prompt).not.toContain("ACCIONES CRUZADAS");
  });
});

describe("validateTakes", () => {
  const take = {
    angle: "data",
    text: "Un post de LinkedIn suficientemente largo para pasar por bueno.",
    hashtags: ["#IA", "#UX"],
    image_query: "abstract industrial texture",
    cross_note: "Sugerencia",
  };

  it("acepta el número exacto de tomas", () => {
    const data = { takes: [take, take] };
    expect(validateTakes(data, 2).takes).toHaveLength(2);
  });

  it("rechaza si vienen de menos", () => {
    expect(() => validateTakes({ takes: [take] }, 3)).toThrow(
      /exactamente 3 tomas/,
    );
  });

  it("rechaza si vienen de más", () => {
    expect(() => validateTakes({ takes: [take, take, take] }, 2)).toThrow(
      /exactamente 2 tomas/,
    );
  });

  it("rechaza una toma sin texto", () => {
    const rota = { ...take, text: "" };
    expect(() => validateTakes({ takes: [take, rota] }, 2)).toThrow(
      /takes\[1\] incompleto/,
    );
  });

  it("rechaza una toma sin hashtags en array", () => {
    const rota = { ...take, hashtags: "#IA" };
    expect(() => validateTakes({ takes: [rota] }, 1)).toThrow(
      /takes\[0\] incompleto/,
    );
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run app/lib/ai/generator.test.js`
Expected: FAIL con `buildTakesPrompt is not a function`.

- [ ] **Step 3: Implementar**

Añadir al final de `app/lib/ai/generator.js`:

```javascript
/* ─── Tomas de LinkedIn ──────────────────────────────────────────────────────
 * Se generan APARTE del artículo y DESPUÉS de él, a las 08:30, leyendo el
 * texto tal y como haya quedado tras la revisión manual. Antes salían en la
 * misma llamada que el artículo, del borrador sin revisar.
 * ────────────────────────────────────────────────────────────────────────── */

const TAKES_TOOL = {
  name: "create_linkedin_takes",
  description:
    "Escribe las tomas de LinkedIn de un artículo ya publicado de Room 714.",
  input_schema: {
    type: "object",
    properties: {
      takes: {
        type: "array",
        description:
          "Tomas de post nativo de LinkedIn en español sobre el mismo artículo, cada una desde un ángulo distinto. NO son traducciones ni resúmenes: son tomas distintas sobre el mismo tema.",
        items: {
          type: "object",
          properties: {
            angle: {
              type: "string",
              enum: ["data", "polemica", "conclusion"],
              description:
                "Ángulo del que tira la toma. 'data': empieza con un número o hecho concreto. 'polemica': afirmación contraintuitiva o crítica con el sector. 'conclusion': lección práctica que se llevan a la oficina.",
            },
            text: {
              type: "string",
              description:
                "Post nativo de LinkedIn en español (1000-1800 chars). Empieza con un HOOK punzante en la primera línea (lo que se ve antes del 'ver más'). Tono coloquial-profesional. 3-5 párrafos cortos separados por doble salto de línea. SIN enlaces. SIN hashtags al final (van en otro campo). Termina con una pregunta o invitación a comentar. El hook debe ser ÚNICO en cada toma.",
            },
            hashtags: {
              type: "array",
              items: { type: "string" },
              description:
                "3-5 hashtags (formato #SinEspacios). Mezcla específicos (#JTBD, #ProductoDigital) con generales (#IA, #UX). Sin acentos.",
            },
            image_query: {
              type: "string",
              description:
                "Frase corta en inglés (3-6 palabras) para buscar UNA imagen en Unsplash que ilustre ESTA toma. Las image_query de un mismo artículo deben ser distintas entre sí para que las publicaciones no parezcan copia. Fotografía abstracta o profesional, NO ilustración obvia del tema.",
            },
            cross_note: {
              type: "string",
              description:
                "Texto sugerido para la ACCIÓN CRUZADA de esta toma (te la indico en el prompt). Máximo 2 frases. Si no tiene acción cruzada, cadena vacía.",
            },
          },
          required: ["angle", "text", "hashtags", "image_query"],
        },
      },
    },
    required: ["takes"],
  },
};

// Exportada para poder probarla; el flujo normal entra por generateLinkedInTakes.
export function buildTakesPrompt({
  articleTitle,
  articleContentEs,
  articleUrl,
  count,
  crossActions = [],
}) {
  const crossBlock = crossActions.some(Boolean)
    ? `

## ACCIONES CRUZADAS (campo cross_note de cada toma)

Cada toma se publica en una sola cuenta y lleva una acción en la otra. Rellena cross_note según lo que le toque a cada una:

${crossActions
  .slice(0, count)
  .map((action, i) =>
    action
      ? `- Toma ${i + 1}: ${CROSS_ACTION_BRIEF[action]}`
      : `- Toma ${i + 1}: sin acción cruzada. Deja cross_note como cadena vacía.`,
  )
  .join("\n")}`
    : "";

  return `Este artículo acaba de publicarse en el blog de Room 714. Escribe **exactamente ${count} tomas** de LinkedIn que apunten a él desde ángulos distintos.

## Artículo

**Título:** ${articleTitle}

**URL:** ${articleUrl}

**Contenido:**

${articleContentEs}

## Tu tarea

1. Lee el artículo y quédate con sus ${count} ideas más fuertes: una por toma.
2. Escribe cada toma como post nativo de LinkedIn con la voz de Room 714 — la misma del artículo: crítica, pragmática, con analogías concretas y sin tono de nota de prensa.
3. Cada toma tiene que sostenerse sola: quien lea solo esa debe llevarse una idea completa, no un anzuelo vacío.
4. Los hooks de las ${count} tomas tienen que ser claramente distintos entre sí. Se publican en días diferentes de la misma semana y las lee la misma gente.
5. NO metas la URL en el texto: el enlace va aparte.

Llama al tool create_linkedin_takes con las ${count} tomas.${crossBlock}`;
}

// Exportada para poder probarla.
export function validateTakes(data, count) {
  if (!Array.isArray(data?.takes) || data.takes.length !== count) {
    throw new Error(
      `takes debe ser un array con exactamente ${count} tomas (llegaron ${data?.takes?.length ?? 0})`,
    );
  }
  for (const [i, t] of data.takes.entries()) {
    if (!t.text || !t.angle || !t.image_query || !Array.isArray(t.hashtags)) {
      throw new Error(`takes[${i}] incompleto`);
    }
  }
  return data;
}

// Presupuesto holgado: tres posts de 1800 caracteres son ~1.500 tokens. 8k deja
// margen de sobra sin acercarse al timeout HTTP del SDK en modo no-streaming.
const MAX_TAKES_OUTPUT_TOKENS = 8000;

export async function generateLinkedInTakes({
  articleTitle,
  articleContentEs,
  articleUrl,
  count,
  crossActions,
}) {
  const client = getAnthropicClient();
  const userPrompt = buildTakesPrompt({
    articleTitle,
    articleContentEs,
    articleUrl,
    count,
    crossActions,
  });

  let lastError;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TAKES_OUTPUT_TOKENS,
        system: buildCachedSystemBlocks(),
        tools: [TAKES_TOOL],
        tool_choice: { type: "tool", name: "create_linkedin_takes" },
        messages: [{ role: "user", content: userPrompt }],
      });
    } catch (err) {
      lastError = err;
      console.error(
        `generateLinkedInTakes intento ${attempt}/${MAX_GENERATION_ATTEMPTS} — error de API: ${err.message}`,
      );
      continue;
    }

    if (response.stop_reason === "max_tokens") {
      lastError = new Error(
        `Respuesta truncada por max_tokens (output_tokens=${response.usage?.output_tokens})`,
      );
      console.error(
        `generateLinkedInTakes intento ${attempt}/${MAX_GENERATION_ATTEMPTS}: ${lastError.message}`,
      );
      continue;
    }

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse) {
      lastError = new Error("Claude no llamó al tool create_linkedin_takes");
      console.error(
        `generateLinkedInTakes intento ${attempt}/${MAX_GENERATION_ATTEMPTS}: ${lastError.message}`,
      );
      continue;
    }

    try {
      const validated = validateTakes(toolUse.input, count);
      return {
        takes: validated.takes,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        },
      };
    } catch (err) {
      lastError = err;
      console.error(
        `generateLinkedInTakes intento ${attempt}/${MAX_GENERATION_ATTEMPTS} — validación falló: ${err.message}`,
      );
    }
  }

  throw new Error(
    `No se pudieron generar las tomas tras ${MAX_GENERATION_ATTEMPTS} intentos: ${lastError?.message}`,
  );
}
```

`MODEL` sale de `app/lib/ai/anthropic.js` y hoy vale `claude-sonnet-4-6`. Se reutiliza la constante del proyecto a propósito: cambiar de modelo es una decisión aparte y no forma parte de este plan.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx vitest run app/lib/ai/generator.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/ai/generator.js app/lib/ai/generator.test.js
git commit -m "feat(ai): generateLinkedInTakes escribe las tomas a partir del articulo"
```

---

## Task 5: `generateTakesForToday` en el orquestador

Función nueva y aditiva. Lee el artículo del día ya guardado, pide las tomas y las escribe.

**Files:**
- Modify: `app/lib/ai/orchestrator.js` (añadir al final, y ampliar imports)

- [ ] **Step 1: Ampliar los imports**

En la cabecera de `app/lib/ai/orchestrator.js`, sustituir estas dos líneas:

```javascript
import { generatePostDraft } from "./generator";
```

```javascript
import { nextMadridSlot } from "@/app/lib/time/madrid";
```

```javascript
import {
  crossActionsFor,
  variantScheduleFor,
} from "@/app/lib/time/linkedinSchedule";
```

por estas:

```javascript
import { generateLinkedInTakes, generatePostDraft } from "./generator";
```

```javascript
import { madridDayRange, nextMadridSlot } from "@/app/lib/time/madrid";
```

```javascript
import {
  channelForVariant,
  crossActionsFor,
  takeCountFor,
  variantScheduleFor,
} from "@/app/lib/time/linkedinSchedule";
```

- [ ] **Step 2: Añadir la función al final del fichero**

```javascript
/* ─── Tomas de LinkedIn del artículo de hoy ──────────────────────────────────
 * Corre a las 08:30 de lunes y miércoles, después de la ventana de revisión
 * manual (08:00-08:30). Lee el artículo tal y como haya quedado en base de
 * datos: si se editó, las tomas salen del texto editado; si no se tocó, del
 * generado. Nada bloquea.
 * ────────────────────────────────────────────────────────────────────────── */
export async function generateTakesForToday({ preview = false } = {}) {
  const { start, end } = madridDayRange(new Date());

  const post = await prisma.post.findFirst({
    where: {
      source: "AUTO",
      published: true,
      date: { gte: start, lte: end },
    },
    include: { translations: true, linkedinVariants: true },
    orderBy: { date: "desc" },
  });

  if (!post) {
    return { skipped: true, reason: "No hay artículo AUTO publicado hoy" };
  }

  // Idempotencia: de las dos entradas de cron por horario solo pasa una, pero
  // un reintento de Vercel sí puede repetir la ejecución.
  if (post.linkedinVariants.length > 0) {
    return {
      skipped: true,
      postId: post.id,
      reason: `El post ${post.id} ya tiene ${post.linkedinVariants.length} tomas`,
    };
  }

  const translationEs = post.translations.find((t) => t.lang === "es");
  if (!translationEs) {
    return {
      skipped: true,
      postId: post.id,
      reason: `El post ${post.id} no tiene traducción española`,
    };
  }

  const count = takeCountFor(post.date);
  const crossActions = crossActionsFor(post.date);
  const schedules = variantScheduleFor(post.date);
  const siteUrl = process.env.NEXTAUTH_URL || "https://www.room714.com";
  const articleUrl = `${siteUrl}/es/blog/${translationEs.slug}`;

  const { takes, usage } = await generateLinkedInTakes({
    articleTitle: translationEs.title,
    articleContentEs: translationEs.content,
    articleUrl,
    count,
    crossActions,
  });

  const describe = (take, idx) => ({
    take: idx + 1,
    angle: take.angle,
    canal: channelForVariant({ postPublishDate: post.date, variant: idx + 1 }),
    cross: crossActions[idx],
    scheduledFor: schedules[idx].toISOString(),
  });

  // Preview: enseña qué se publicaría y cuándo, sin descargar imágenes ni
  // escribir en base de datos. Es la forma de validar un cambio sin ensuciar.
  if (preview) {
    return {
      preview: true,
      postId: post.id,
      articleTitle: translationEs.title,
      count,
      usage,
      takes: takes.map((take, idx) => ({
        ...describe(take, idx),
        text: take.text,
        hashtags: take.hashtags,
        crossNote: take.cross_note?.trim() || null,
      })),
    };
  }

  // Una imagen por toma, con su propia consulta. Best-effort: si Unsplash
  // falla, se usa la portada del artículo, como hacía el flujo anterior.
  const datePrefix = new Date().toISOString().split("T")[0];
  const images = await Promise.all(
    takes.map(async (take, idx) => {
      try {
        const img = await fetchAndStoreCoverImage(
          take.image_query,
          `${datePrefix}-li${idx + 1}`,
          { fallbackQuery: fallbackQueryForCategory(post.category) },
        );
        return img.url;
      } catch (err) {
        console.error(
          `Imagen de la toma ${idx + 1} falló (query "${take.image_query}"):`,
          err.message,
        );
        return post.image;
      }
    }),
  );

  await prisma.linkedInVariant.createMany({
    data: takes.map((take, idx) => ({
      postId: post.id,
      variant: idx + 1,
      angle: take.angle,
      text: take.text,
      hashtags: take.hashtags || [],
      imageBlobUrl: images[idx],
      imageQuery: take.image_query,
      crossNote: take.cross_note?.trim() || null,
      scheduledFor: schedules[idx],
    })),
  });

  return {
    skipped: false,
    postId: post.id,
    articleTitle: translationEs.title,
    count,
    usage,
    takes: takes.map(describe),
  };
}
```

- [ ] **Step 3: Comprobar que el proyecto sigue compilando**

Run: `npx next build`
Expected: build correcto. La función es nueva y nadie la llama todavía.

Si el build tarda demasiado para el ciclo de trabajo, vale con `npx eslint app/lib/ai/orchestrator.js` y dejar el build para el final de la tarea 7.

- [ ] **Step 4: Commit**

```bash
git add app/lib/ai/orchestrator.js
git commit -m "feat(ai): generateTakesForToday lee el articulo del dia y escribe sus tomas"
```

---

## Task 6: Cron `generate-linkedin`

**Files:**
- Create: `app/api/cron/generate-linkedin/route.js`

- [ ] **Step 1: Crear la ruta**

```javascript
import { NextResponse } from "next/server";
import { generateTakesForToday } from "@/app/lib/ai/orchestrator";
import { getMadridWeekday, isMadridHour } from "@/app/lib/time/madrid";

export const maxDuration = 300;

// 08:30 de Madrid: media hora después de que se abra la ventana de revisión
// del artículo (08:00-08:30). Las tomas se escriben a partir del texto ya
// revisado, no del borrador.
//
// Vercel programa en UTC, así que en vercel.json hay dos entradas (una por
// horario estacional) y aquí se descarta la que no toca. Eso resuelve de paso
// la idempotencia frente al cambio de hora.
const TARGET_HOUR = 8;

// Solo hay artículo que convertir en tomas los días en que se publica uno.
const PUBLISH_WEEKDAYS = ["Mon", "Wed"];

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  // Preview: construye las tomas y las devuelve en JSON, sin descargar
  // imágenes, sin escribir en base de datos y sin comprobar hora ni día.
  const preview = new URL(request.url).searchParams.get("preview") === "1";

  if (!preview) {
    if (!isMadridHour(TARGET_HOUR)) {
      return NextResponse.json({
        message: "Saltado: no es la hora correcta en Madrid",
        targetHour: `${TARGET_HOUR}:30 Madrid`,
      });
    }

    const weekday = getMadridWeekday();
    if (!PUBLISH_WEEKDAYS.includes(weekday)) {
      return NextResponse.json({
        message: "Saltado: hoy no se publica artículo",
        weekday,
        publishWeekdays: PUBLISH_WEEKDAYS,
      });
    }
  }

  try {
    const result = await generateTakesForToday({ preview });

    if (result.skipped) {
      return NextResponse.json({
        message: "Generación de tomas saltada",
        reason: result.reason,
        postId: result.postId ?? null,
      });
    }

    return NextResponse.json({
      message: preview
        ? "Preview: nada escrito, ninguna imagen descargada"
        : "Tomas de LinkedIn generadas",
      ...result,
    });
  } catch (err) {
    console.error("❌ Error en cron generate-linkedin:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verificar que la ruta responde**

Run: `npx next build`
Expected: la ruta `/api/cron/generate-linkedin` aparece en el listado de rutas del build.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/generate-linkedin/route.js
git commit -m "feat(cron): generate-linkedin genera las tomas a las 8:30"
```

---

## Task 7: Cortar el cordón — el artículo deja de traer variantes

Este es el commit que cambia el comportamiento. Toca generador y orquestador **a la vez** porque por separado dejarían el árbol roto.

**Files:**
- Modify: `app/lib/ai/generator.js` (tool `create_blog_post` y `validateGenerated`)
- Modify: `app/lib/ai/orchestrator.js` (`generateDraftForToday`)

- [ ] **Step 1: Quitar `linkedin_variants` del tool del artículo**

En `app/lib/ai/generator.js`, dentro de `POST_TOOL.input_schema.properties`, **borrar entera** la propiedad `linkedin_variants` (desde `linkedin_variants: {` hasta su `},` de cierre, justo antes del cierre de `properties`).

En `POST_TOOL.input_schema.required`, borrar la línea `"linkedin_variants",`.

- [ ] **Step 2: Quitar la validación de variantes**

En `validateGenerated`, borrar `"linkedin_variants",` del array `required`, y borrar este bloque completo:

```javascript
  if (
    !Array.isArray(data.linkedin_variants) ||
    data.linkedin_variants.length !== 3
  ) {
    throw new Error("linkedin_variants debe ser un array con exactamente 3 variantes");
  }
  for (const [i, v] of data.linkedin_variants.entries()) {
    if (!v.text || !v.angle || !v.image_query || !Array.isArray(v.hashtags)) {
      throw new Error(`linkedin_variants[${i}] incompleto`);
    }
  }
```

- [ ] **Step 3: Quitar `crossActions` del prompt del artículo**

En `buildUserPrompt`, quitar `crossActions` de la desestructuración de parámetros y quitar `${buildCrossNotesBlock(crossActions)}` del final del template. La línea queda:

```javascript
Llama al tool create_blog_post con los campos correspondientes.${buildPublishedCorpusBlock(publishedCorpus)}`;
```

En `generatePostDraft`, quitar `crossActions` de la desestructuración y de la llamada a `buildUserPrompt`.

**No borres `buildCrossNotesBlock` ni `CROSS_ACTION_BRIEF`**: `CROSS_ACTION_BRIEF` lo usa `buildTakesPrompt` de la Task 4. Si `buildCrossNotesBlock` queda sin usar, bórralo; comprueba antes con:

Run: `grep -rn "buildCrossNotesBlock" app/`

- [ ] **Step 4: Limpiar el prompt del artículo**

Dos cosas, las dos en la misma línea de trabajo: el prompt del artículo no debe seguir hablando de LinkedIn.

Primero, el comentario de `MAX_OUTPUT_TOKENS` en `app/lib/ai/generator.js`:

```javascript
// Presupuesto de tokens de salida para el artículo (ES + EN, 1500-2500 palabras
// cada uno). Las tomas de LinkedIn ya no van en esta llamada: se generan aparte
// en generateLinkedInTakes.
const MAX_OUTPUT_TOKENS = 32000;
```

Segundo, y más importante: **borrar de `EDITORIAL_GUIDE`, en `app/lib/ai/editorialGuide.js`, la sección `## LinkedIn — 3 variantes nativas por post` entera y la sección `## Hashtags LinkedIn`.** Ese texto describe un campo `linkedin_variants` que a partir de este commit ya no existe en `create_blog_post`, fija el número de variantes en tres y describe el calendario antiguo (`L,M,X` / `X,J,V`). Su contenido vive ya en `LINKEDIN_GUIDE`, en ese mismo fichero, que es lo que consume el generador de tomas.

Comprueba después que nadie más dependía de esas secciones:

Run: `grep -rn "linkedin_variants\|3 variantes" app/lib/ai/`
Expected: sin resultados.

- [ ] **Step 5: El orquestador publica a las 7:30 y no crea variantes**

En `app/lib/ai/orchestrator.js`:

Sustituir la constante y el cálculo de fecha:

```javascript
// El artículo se hace visible a las 07:30 de Madrid: el blog filtra date <= now,
// así que esta fecha ES la hora de publicación. La revisión manual va de 08:00
// a 08:30 y las tomas de LinkedIn se generan a las 08:30.
const PUBLISH_HOUR_MADRID = 7;
const PUBLISH_MINUTE_MADRID = 30;
```

y dentro de `generateDraftForToday`:

```javascript
  const publishDate = nextMadridSlot(PUBLISH_HOUR_MADRID, PUBLISH_MINUTE_MADRID);
```

Quitar `crossActions: crossActionsFor(publishDate),` de la llamada a `generatePostDraft`.

Borrar el bloque de imágenes de variante completo (desde el comentario `// Fetch 3 imágenes adicionales...` hasta el cierre de `const variantImages = await Promise.all(...)`), incluidas las líneas `const variants = draft.linkedin_variants || [];` y `const variantSchedules = variantScheduleFor(publishDate);`.

En `prisma.post.create`, borrar la propiedad `linkedinVariants: { create: ... }` entera y dejar el `include` en `{ translations: true }`. Así queda la llamada completa, que es la edición más delicada de esta tarea:

```javascript
  const post = await prisma.post.create({
    data: {
      image: cover.url,
      category,
      date: publishDate,
      published: true,
      published_sent: false,
      source: "AUTO",
      translations: {
        create: [
          {
            lang: "es",
            slug: slugEs,
            title: draft.title_es,
            tags: draft.tags_es,
            content: draft.content_es,
            metaDescription: draft.meta_description_es,
          },
          {
            lang: "en",
            slug: slugEn,
            title: draft.title_en,
            tags: draft.tags_en,
            content: draft.content_en,
            metaDescription: draft.meta_description_en,
          },
        ],
      },
    },
    include: { translations: true },
  });
```

En la llamada a `sendDraftReadyEmail`, quitar `linkedinVariants: post.linkedinVariants,`. El parámetro tiene valor por defecto `[]` y `buildLinkedInVariantsSection` devuelve cadena vacía con array vacío, así que el correo queda sin la sección de LinkedIn, que es lo correcto: a las 06:00 todavía no existen.

En el `return` de `generateDraftForToday`, borrar la propiedad `linkedinVariants: post.linkedinVariants.map(...)` entera.

- [ ] **Step 6: Comprobar que no queda ninguna referencia**

Run: `grep -rn "linkedin_variants\|linkedinVariants" app/lib/ai/`
Expected: sin resultados en `generator.js`; en `orchestrator.js` solo la escritura de `generateTakesForToday`.

Run: `grep -rn "variantScheduleFor\|crossActionsFor" app/lib/ai/orchestrator.js`
Expected: solo dentro de `generateTakesForToday`.

- [ ] **Step 7: Ejecutar toda la suite**

Run: `npx vitest run`
Expected: PASS. Los tests de `generator.test.js` prueban `buildUserPrompt` con corpus y no dependen de las variantes.

- [ ] **Step 8: Build**

Run: `npx next build`
Expected: correcto.

- [ ] **Step 9: Commit**

```bash
git add app/lib/ai/generator.js app/lib/ai/orchestrator.js
git commit -m "refactor(ai): el articulo se genera solo y se publica a las 7:30"
```

---

## Task 8: Horas de los crones de artículo

**Files:**
- Modify: `app/api/cron/generate/route.js:7`
- Modify: `app/api/cron/publish/route.js:12-18`

- [ ] **Step 1: Adelantar la generación a las 06:00**

En `app/api/cron/generate/route.js`, sustituir:

```javascript
const TARGET_HOUR = 7;
```

por:

```javascript
// 06:00: hora y media antes de que el artículo se haga visible (07:30). La
// generación completa tarda 1-2 minutos, así que el margen es de sobra, y deja
// tiempo a que llegue el correo de borrador listo antes de que nadie se siente.
const TARGET_HOUR = 6;
```

- [ ] **Step 2: Mover la hora de publicación AUTO**

En `app/api/cron/publish/route.js`, sustituir el bloque del mapeo:

```javascript
// Mapeo: hora Madrid → source que se publica en ese tick
// 07:00 Madrid → posts auto-generados. El cron dispara a las 07:30 y
// getMadridHour() devuelve 7; los posts AUTO llevan date = 07:30, así que en
// ese tick ya cumplen date <= now.
// 17:00 Madrid → posts manuales (creados desde admin)
const SOURCE_BY_HOUR = {
  7: "AUTO",
  17: "MANUAL",
};
```

- [ ] **Step 3: Impedir que un artículo AUTO caiga al webhook legacy**

Esto no estaba en el diseño y es el fallo más serio que destapó la revisión de la Tarea 7. La ruta decide así:

```javascript
const hasVariants = post.linkedinVariants.length > 0;
if (hasVariants) { /* marcar y dejar que publish-linkedin haga su trabajo */ }
else { /* flujo legacy: disparar el webhook de Make aquí mismo */ }
```

Antes, un post AUTO **siempre** nacía con sus variantes en el mismo `create`, así que la rama legacy era inalcanzable para AUTO. Ahora las tomas se escriben a las 08:30 y este cron corre a las 07:30: `hasVariants` será **false todos los lunes y miércoles**, y la rama legacy dispara Make con `cleanSummary` — el HTML del artículo desnudado a 250 caracteres más "...". Las traducciones AUTO nunca rellenan `linkedinPost`, así que no hay nada mejor que enviar. No falla: publica un resumen truncado en LinkedIn.

El invariante correcto es que **un artículo AUTO nunca usa el camino legacy**: su presencia en LinkedIn son sus tomas, y llegan por su cron. Sustituir la condición por:

```javascript
      // Los AUTO nunca van por el webhook legacy: su LinkedIn son las tomas,
      // que escribe /api/cron/generate-linkedin a las 08:30 y publica
      // /api/cron/publish-linkedin a la hora de cada una. Este cron corre a las
      // 07:30, antes de que existan, así que sin esta condición cada artículo
      // se publicaría en LinkedIn como un resumen truncado del HTML.
      if (hasVariants || post.source === "AUTO") {
```

Y en el mensaje del `results.push` de esa rama, distinguir los dos casos para que el log siga siendo legible:

```javascript
        results.push(
          `Post ID ${post.id} ("${esData.title}"): publicado (${
            hasVariants
              ? "variantes LinkedIn a su cron"
              : "AUTO sin tomas todavía; las generará el cron de las 8:30"
          }).`,
        );
```

- [ ] **Step 4: Avisar si la fecha de publicación se va a otro día**

`nextMadridSlot(7, 30)` devuelve el **siguiente día laborable** si las 07:30 ya pasaron, y lo hace en silencio. Con la generación a las 06:00 hay hora y media de margen, así que no debería ocurrir; pero si Vercel entrega el cron tarde, el artículo del lunes se fecharía el martes, y entonces `generate-linkedin` —que solo corre lunes y miércoles— no lo encontraría y **esa semana se quedaría sin tomas**. Cuesta tres líneas dejar rastro. En `app/lib/ai/orchestrator.js`, justo después de calcular `publishDate`:

```javascript
  // Si el cron llegó tarde, nextMadridSlot salta al siguiente día laborable sin
  // decir nada, y entonces el artículo se fecha un día en que generate-linkedin
  // no corre: la semana se queda sin tomas. No lo impedimos —publicar mañana es
  // mejor que no publicar— pero que quede en el log.
  if (getMadridWeekday(publishDate) !== getMadridWeekday(new Date())) {
    console.warn(
      `generateDraftForToday: las 07:30 de hoy ya pasaron; el artículo se fecha el ${publishDate.toISOString()}`,
    );
  }
```

Añade `getMadridWeekday` al import de `@/app/lib/time/madrid` que ya existe en el fichero.

- [ ] **Step 5: Ejecutar la suite**

Run: `npx vitest run`
Expected: siguen fallando solo los 2 de `app/lib/linkedin/dailyTasks.test.js`, que arregla la Tarea 9.

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/generate/route.js app/api/cron/publish/route.js app/lib/ai/orchestrator.js
git commit -m "feat(cron): generacion a las 6:00, publicacion a las 7:30 y AUTO fuera del legacy"
```

---

## Task 9: El briefing deja de pedir una revisión previa

El correo sale a las 08:50, cuando la publicación del día ya ha salido. Una tarea de "revisa el texto antes de que se publique" ya no tiene dónde encajar.

**Files:**
- Modify: `app/lib/linkedin/dailyTasks.js:3-5,42-60`
- Test: `app/lib/linkedin/dailyTasks.test.js`

- [ ] **Step 1: Actualizar los tests que fallan**

En `app/lib/linkedin/dailyTasks.test.js`:

Cambiar las fechas de cabecera, porque los artículos ahora se publican a las 07:30:

```javascript
// Lunes 27 y miércoles 29 de julio de 2026, 07:30 Madrid.
const LUNES = new Date("2026-07-27T05:30:00Z");
const MIERCOLES = new Date("2026-07-29T05:30:00Z");
```

En el caso "lunes", quitar `"review_own"` de la expectativa:

```javascript
  it("lunes: primer comentario y recompartir desde la página", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: LUNES })],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["first_comment", "reshare_company"]);
  });
```

Sustituir el caso "la tarea de revisión trae todo lo necesario para ejecutarla" por uno que compruebe que ya no se genera:

```javascript
  it("no pide revisar el texto: el briefing llega cuando ya se ha publicado", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: LUNES })],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).not.toContain("review_own");
  });
```

En el caso "miércoles: dos publicaciones y ninguna acción cruzada", el calendario nuevo no tiene ese día doble: sustituirlo por el miércoles real, que es la toma 1 del segundo artículo.

```javascript
  it("miércoles: primer comentario y recompartir del segundo artículo", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [variante({ variant: 1, postDate: MIERCOLES })],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["first_comment", "reshare_company"]);
  });
```

En el caso "viernes: la v3 del miércoles es tuya y la recomparte la página", el viernes ahora es la toma 3 del artículo del **lunes**:

```javascript
  it("viernes: la toma 3 del lunes es tuya y la recomparte la página", () => {
    const { tasks } = buildDailyTasks({
      todayVariants: [
        variante({
          variant: 3,
          postDate: LUNES,
          scheduledFor: new Date("2026-07-31T05:30:00Z"),
        }),
      ],
      siteUrl: SITE,
    });
    expect(kinds(tasks)).toEqual(["first_comment", "reshare_company"]);
  });
```

En "martes: solo comentar desde el perfil", ajustar la fecha programada a las 07:30:

```javascript
          scheduledFor: new Date("2026-07-28T05:30:00Z"),
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run app/lib/linkedin/dailyTasks.test.js`
Expected: FAIL. Los casos siguen recibiendo `review_own` en primera posición.

- [ ] **Step 3: Quitar la tarea del código**

En `app/lib/linkedin/dailyTasks.js`, borrar la constante `VOICE_JOSE` (líneas 4-5) y, dentro del `if (slot.canal === "personal")`, borrar el `tasks.push({...})` de `kind: "review_own"` entero, dejando solo el bloque de `first_comment`:

```javascript
    if (slot.canal === "personal") {
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
```

La tarea `blog_review` ("Artículo nuevo hoy en la web") **se queda**: no pide revisar nada a tiempo, solo apunta al artículo del día y a su ficha en el admin.

- [ ] **Step 4: Avisar cuando el artículo del día se quedó sin tomas**

Hueco detectado revisando el cron de las 08:30: si esa generación falla o agota su tiempo, no hay reintento —los crones de Vercel no reintentan y la otra entrada UTC ya la descartó el guard de hora— y **nada lo denuncia**. Los `incidents` de hoy salen solo de `yesterdayUnsent`, así que un lunes sin tomas produce un briefing con la tarea del artículo y ninguna de LinkedIn: idéntico a un día tranquilo.

`buildDailyTasks` ya recibe `blogPost` (el artículo que se publica hoy). Añade un incidente cuando ese artículo existe y no tiene ninguna variante:

```javascript
  // El artículo salió pero el cron de las 08:30 no llegó a escribir sus tomas.
  // Sin esto, un fallo de generación es indistinguible de un día sin nada que
  // hacer, y el hueco de la semana se descubre el viernes.
  if (blogPost && (blogPost.linkedinVariants?.length ?? 0) === 0) {
    incidents.push({
      id: `no-takes-${blogPost.id}`,
      kind: "no_takes",
      when: "before",
      time: formatMadridTime(blogPost.date),
      channel: null,
      title: "El artículo de hoy se publicó sin tomas de LinkedIn",
      articleTitle: blogPost.translations?.find((t) => t.lang === "es")?.title
        ?? `Post ${blogPost.id}`,
    });
  }
```

Para que `blogPost.linkedinVariants` llegue relleno, en `app/api/cron/daily-briefing/route.js` la consulta de `blogPost` tiene que incluirlas:

```javascript
      prisma.post.findFirst({
        where: { published: true, date: { gte: start, lte: end } },
        include: { translations: true, linkedinVariants: true },
      }),
```

Y un test en `dailyTasks.test.js`:

```javascript
  it("avisa si el artículo de hoy se quedó sin tomas", () => {
    const { incidents } = buildDailyTasks({
      blogPost: {
        id: 10,
        date: LUNES,
        translations: [{ lang: "es", slug: "mi-post", title: "Mi post" }],
        linkedinVariants: [],
      },
      siteUrl: SITE,
    });
    expect(incidents.map((i) => i.kind)).toContain("no_takes");
  });

  it("no avisa si el artículo de hoy ya tiene sus tomas", () => {
    const { incidents } = buildDailyTasks({
      blogPost: {
        id: 10,
        date: LUNES,
        translations: [{ lang: "es", slug: "mi-post", title: "Mi post" }],
        linkedinVariants: [{ id: 1 }],
      },
      siteUrl: SITE,
    });
    expect(incidents.map((i) => i.kind)).not.toContain("no_takes");
  });
```

Comprueba que la plantilla del correo (`app/lib/notifications/dailyBriefing.js`) renderiza los incidentes por su forma común y no por un `switch` sobre `kind`; si es lo segundo, añade la rama de `no_takes`.

- [ ] **Step 5: Comprobar que nadie más usaba `review_own`**

Run: `grep -rn "review_own\|VOICE_JOSE" app/`
Expected: solo apariciones en la plantilla del correo, si las hay. Si `app/lib/notifications/dailyBriefing.js` tiene una rama por `kind === "review_own"`, bórrala también e incluye el fichero en el commit.

- [ ] **Step 6: Ejecutar y ver que pasa**

Run: `npx vitest run app/lib/linkedin/dailyTasks.test.js`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS entero. Esta es la tarea que devuelve la suite al verde: si algo sigue en rojo aquí, no es un fallo previsto.

- [ ] **Step 7: Commit**

```bash
git add app/lib/linkedin/dailyTasks.js app/lib/linkedin/dailyTasks.test.js app/api/cron/daily-briefing/route.js
git commit -m "feat(briefing): fuera la revision previa, y aviso si el articulo se queda sin tomas"
```

---

## Task 10: Textos de hora en el correo de borrador listo

El correo dice "se publicará automáticamente a las 10:00" y anuncia las fechas de LinkedIn, que a las 06:00 todavía no existen.

**Files:**
- Modify: `app/lib/notifications/draftReady.js:38`

- [ ] **Step 1: Corregir las cuatro afirmaciones falsas del correo**

El correo se degrada bien —sin variantes, su sección de LinkedIn se omite sola— pero su texto miente en cuatro sitios, y es el único mensaje sobre el que el dueño actúa. Los cuatro empujan en la dirección que le hace perder la ventana de revisión.

Línea 38, el párrafo de cabecera:

```javascript
  <p>Se ha generado el artículo de hoy. <strong>Se publicará automáticamente a las 07:30 en la web</strong>, salvo que lo despubliques o lo borres antes. Tienes de <strong>08:00 a 08:30</strong> para revisarlo: a las 08:30 se generan a partir de él los posts de LinkedIn de esta semana, y salen del texto que hayas dejado. Si no lo tocas, se publica igual.</p>
```

Ojo con lo que hay que quitar de ahí: la frase actual dice "En LinkedIn se publica automáticamente vía Make (**ver fechas más abajo**)", y ya no hay nada más abajo — la sección de variantes es siempre vacía en este flujo, porque a las 06:00 las tomas todavía no existen.

Línea 48, el aviso de plazo: dice "Si no haces nada en las próximas **3h**: el post se publica tal cual". El correo sale hacia las 06:05 y el artículo se hace visible a las 07:30: hora y media, no tres horas. Y lo que de verdad importa no es ese plazo sino el de la revisión, que es hasta las 08:30. Reescríbelo en esos términos.

Línea 50, "despublícalo o bórralo desde el admin **antes de las 10:00**" → antes de las 07:30.

- [ ] **Step 2: Actualizar el comentario obsoleto del briefing**

`app/api/cron/daily-briefing/route.js` no necesita cambios de código —el guard sigue siendo `isMadridHour(8)` y el cron dispara a las 08:50 de Madrid— pero su comentario de cabecera describe un horario que ya no existe. Sustituir el párrafo que empieza por "A las 08:00 y no a las 07:00" por:

```javascript
// A las 08:50 y no antes: el cron `generate-linkedin` corre a las 08:30 de
// lunes y miércoles y crea las tomas de LinkedIn de ese día, y la primera sale
// hacia las 08:35-08:43. Antes de las 08:50 el briefing hablaría de una
// publicación que todavía no existe.
```

Dejar intacto el párrafo siguiente, el de las dos entradas en `vercel.json`: sigue siendo verdad.

- [ ] **Step 3: Corregir los dos textos del admin**

Los encontró la revisión de la Tarea 7 y el `grep` del paso siguiente **no los cubriría**, porque están fuera de los directorios que barre. No leen variantes ni rompen nada: solo mienten.

En `app/(admin-zone)/admin/page.js`:
- El diálogo de confirmación dice "Se creará como publicado en la próxima franja de **10:00** (Madrid)" → 07:30.
- `const publishTime = post.source === "AUTO" ? "10:00 AM" : "5:00 PM";` → `"07:30"` para AUTO. Deja el de MANUAL como está: los posts manuales siguen saliendo a las 17:00.

- [ ] **Step 4: Comprobar que no quedan más referencias a las 10:00**

Run: `grep -rn "10:00\|las 10\|10 AM" app/ --include=*.js`
Expected: sin resultados relacionados con la hora de publicación del artículo. El barrido va sobre `app/` entero a propósito: acotarlo a `lib/` y `api/` dejaba fuera los textos del admin.

- [ ] **Step 5: Commit**

```bash
git add app/lib/notifications/draftReady.js app/api/cron/daily-briefing/route.js "app/(admin-zone)/admin/page.js"
git commit -m "docs(ui): el correo, el briefing y el admin cuentan el horario nuevo"
```

---

## Task 11: Crones de Vercel

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Sustituir el fichero entero**

```json
{
  "crons": [
    { "path": "/api/cron/generate", "schedule": "0 4 * * 1,3" },
    { "path": "/api/cron/generate", "schedule": "0 5 * * 1,3" },
    { "path": "/api/cron/publish", "schedule": "30 5 * * 1-5" },
    { "path": "/api/cron/publish", "schedule": "30 6 * * 1-5" },
    { "path": "/api/cron/publish", "schedule": "0 15 * * 1-5" },
    { "path": "/api/cron/publish", "schedule": "0 16 * * 1-5" },
    { "path": "/api/cron/generate-linkedin", "schedule": "30 6 * * 1,3" },
    { "path": "/api/cron/generate-linkedin", "schedule": "30 7 * * 1,3" },
    { "path": "/api/cron/publish-linkedin", "schedule": "*/5 5-7 * * 1-5" },
    { "path": "/api/cron/daily-briefing", "schedule": "50 6 * * 1-5" },
    { "path": "/api/cron/daily-briefing", "schedule": "50 7 * * 1-5" },
    { "path": "/api/cron/cleanup-candidates", "schedule": "0 3 * * *" },
    { "path": "/api/cron/discover-prospects", "schedule": "0 5 * * 1" }
  ]
}
```

Comprobación de cada par, para que se pueda repetir sin fiarse:

| Ruta | Guard en el código | UTC | Madrid CET (+1) | Madrid CEST (+2) | Pasa el guard |
|---|---|---|---|---|---|
| `generate` | hora = 6 | `0 4` | 05:00 | 06:00 | verano |
| `generate` | hora = 6 | `0 5` | 06:00 | 07:00 | invierno |
| `publish` | hora = 7 | `30 5` | 06:30 | 07:30 | verano |
| `publish` | hora = 7 | `30 6` | 07:30 | 08:30 | invierno |
| `generate-linkedin` | hora = 8 | `30 6` | 07:30 | 08:30 | verano |
| `generate-linkedin` | hora = 8 | `30 7` | 08:30 | 09:30 | invierno |
| `daily-briefing` | hora = 8 | `50 6` | 07:50 | 08:50 | verano |
| `daily-briefing` | hora = 8 | `50 7` | 08:50 | 09:50 | invierno |

`publish-linkedin` no lleva guard de hora: publica lo que tenga `scheduledFor <= now`. `*/5 5-7` cubre de 05:00 a 07:55 UTC, o sea 06:00-08:55 en invierno y 07:00-09:55 en verano. Las dos franjas de publicación (07:30-07:58 y 08:35-08:43 de Madrid) caen dentro en ambas estaciones. Son 36 ejecuciones diarias frente a las 60 de antes.

`discover-prospects` se queda como está: lo sustituye el plan de prospección, no este.

- [ ] **Step 2: Validar el JSON**

Run: `node -e "console.log(require('./vercel.json').crons.length)"`
Expected: `13`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat(cron): reprograma la semana en la franja de las 7:30"
```

---

## Task 12: Verificación antes de desplegar

Nada de esto cambia código: es la comprobación de que el calendario hace lo que dice.

**Files:** ninguno

- [ ] **Step 1: Suite completa**

Run: `npx vitest run`
Expected: PASS, sin tests saltados.

- [ ] **Step 2: Build**

Run: `npx next build`
Expected: correcto, con `/api/cron/generate-linkedin` en el listado de rutas.

- [ ] **Step 3: Imprimir la semana completa y comprobarla a ojo**

Va como test temporal de vitest y no como script de Node: `linkedinSchedule.js` importa `./madrid` sin extensión, y eso lo resuelven Next y vitest, pero **no** `node` a secas (ESM exige la extensión en imports relativos).

Crear `app/lib/time/tmp-semana.test.js`:

```javascript
import { describe, it } from "vitest";
import {
  channelForVariant,
  crossActionsFor,
  takeCountFor,
  variantScheduleFor,
} from "./linkedinSchedule";

const fmt = (d) =>
  new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

describe("semana completa", () => {
  it("imprime el calendario para revisarlo a ojo", () => {
    for (const [nombre, fecha] of [
      ["Artículo del lunes", new Date("2026-07-27T05:30:00Z")],
      ["Artículo del miércoles", new Date("2026-07-29T05:30:00Z")],
      ["Artículo del lunes (invierno)", new Date("2026-01-05T06:30:00Z")],
    ]) {
      console.log(`\n${nombre} — ${takeCountFor(fecha)} tomas`);
      const cross = crossActionsFor(fecha);
      variantScheduleFor(fecha).forEach((d, i) => {
        const canal = channelForVariant({
          postPublishDate: fecha,
          variant: i + 1,
        });
        console.log(`  toma ${i + 1}: ${fmt(d)}  ${canal.padEnd(9)} → ${cross[i]}`);
      });
    }
  });
});
```

Run: `npx vitest run app/lib/time/tmp-semana.test.js`

Expected, en la salida de consola:

```
Artículo del lunes — 3 tomas
  toma 1: lun, 08:3x  personal  → reshare_company
  toma 2: mar, 07:3x  empresa   → comment_personal
  toma 3: vie, 07:4x  personal  → reshare_company

Artículo del miércoles — 2 tomas
  toma 1: mié, 08:3x  personal  → reshare_company
  toma 2: jue, 07:5x  empresa   → comment_personal

Artículo del lunes (invierno) — 3 tomas
  toma 1: lun, 08:3x  personal  → reshare_company
  toma 2: mar, 07:x   empresa   → comment_personal
  toma 3: vie, 07:x   personal  → reshare_company
```

Los minutos exactos dependen del jitter y varían por artículo; lo que hay que comprobar es que **los días son L/M/V y X/J**, que **las horas caen en 08:3x o en 07:3x-07:5x**, que los canales alternan y que en invierno las horas de Madrid son las mismas que en verano.

- [ ] **Step 4: Borrar el test temporal**

Run: `rm app/lib/time/tmp-semana.test.js`

- [ ] **Step 5: Preview de las tomas contra la base real**

Con el servidor levantado (`npm run dev`) y un artículo AUTO publicado hoy en base de datos:

Run:
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/generate-linkedin?preview=1" | node -e \
  "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log(r.message);(r.takes||[]).forEach(t=>console.log(t.take,t.canal,t.scheduledFor,t.angle))})"
```

Expected: el número de tomas que toque según el día, con sus fechas y canales. Nada escrito en base de datos.

Si no hay artículo de hoy, la respuesta es `"Generación de tomas saltada"` con `reason: "No hay artículo AUTO publicado hoy"`, que también es una comprobación válida del guard.

- [ ] **Step 6: Preview del briefing**

Run:
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/daily-briefing?preview=1"
```

Expected: JSON con `tasks`, ninguna de `kind: "review_own"`.

- [ ] **Step 7: Commit final**

No hay nada que commitear si los pasos anteriores no revelaron fallos. Si hubo ajustes:

```bash
git add -A
git commit -m "fix(calendario): ajustes tras la verificacion previa al despliegue"
```

---

## Nota sobre el despliegue

Desplegar es hacer push a `main`. **El primer despliegue debe hacerse un día que no sea lunes ni miércoles por la mañana**: si se despliega un lunes entre las 06:00 y las 08:30, el artículo de ese día se habrá generado con el código antiguo (con sus 3 variantes ya creadas y programadas al calendario viejo) y el cron nuevo de las 08:30 lo verá con variantes y saltará. No rompe nada, pero esa semana sale con el calendario antiguo.

Lo limpio es desplegar un jueves o un viernes por la tarde, y que el lunes siguiente arranque entero con el flujo nuevo.

Si quedan variantes del calendario antiguo pendientes de publicar (`sent = false`) cuando se despliegue, saldrán a su hora vieja porque `publish-linkedin` solo mira `scheduledFor`. Con la ventana nueva (`*/5 5-7` UTC) las que estuvieran programadas a las 16:00 **no llegarán a publicarse nunca**. Comprobar antes con:

```sql
SELECT id, "postId", variant, "scheduledFor" FROM "LinkedInVariant"
WHERE sent = false ORDER BY "scheduledFor";
```

y decidir si se dejan morir o se reprograman a mano.
