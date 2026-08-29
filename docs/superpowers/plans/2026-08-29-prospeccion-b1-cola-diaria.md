# Prospección, fase B1: la cola diaria — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ningún crédito de Apollo se gaste en alguien que nadie ha mirado: una cola diaria de 20 candidatos sin enriquecer, un contador de créditos sobre el ciclo real de facturación, y un feedback de un clic que ajusta la búsqueda del día siguiente.

**Architecture:** Buscar en Apollo es gratis; enriquecer cuesta. El cron diario busca y deja 20 fichas en la cola sin gastar nada; el crédito se gasta solo al pulsar "Sí". Cada decisión queda registrada, y las reglas que ajustan la consulta **se derivan contando decisiones**, sin tabla de estado: cambiar de opinión sobre un descarte hace desaparecer la regla que provocó.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma 6 + PostgreSQL, vitest.

**Spec:** `docs/superpowers/specs/2026-08-29-prospeccion-diaria-design.md` (fase B1; las fases B2 —memoria vectorial— y B3 —chat— van en planes aparte)

---

## Contexto que el implementador necesita

**Lo que hay hoy.** Un cron semanal (`/api/cron/discover-prospects`) enriquece hasta 10 personas los lunes a las 05:00 —1 crédito cada una— y las da de alta como prospectos sin que nadie las haya visto. El briefing diario pide dos tareas: comentar el post de un prospecto y buscar "referencias" en LinkedIn. En producción hay 10 prospectos, 48 descubrimientos y **0 engagements**: la parte de comentar no se ha usado nunca.

**Lo que la API permite, verificado.** `mixed_people/api_search` es **gratis** y devuelve por persona `id`, `first_name`, `last_name_obfuscated`, `title` y un `organization` con **solo el nombre y banderas booleanas** — nada de sector ni plantilla. Enriquecer una empresa cuesta 1 crédito, igual que enriquecer a la persona. Por eso la ficha se construye con **lo que preguntamos**: cada candidato se guarda etiquetado con el sector y el tramo de plantilla de la consulta que lo trajo.

**El presupuesto.** Plan gratuito, 75 créditos al mes con tope operativo de 60, y el ciclo **renueva el día 16**, no el día 1. El código actual aproxima el gasto con una ventana móvil de 30 días; esta fase pasa al ciclo real.

**`APOLLO_API_KEY` no está en `.env.local`.** Está en Vercel, donde corre el cron. Sin ella no se puede probar nada de prospección en local: hará falta para la verificación de la Task 11.

**Comandos.** Tests: `npx vitest run <ruta>`. Todo: `npx vitest run`. Migraciones: `npx prisma migrate dev --name <nombre>`. Todo desde `my-app/`.

**Orden de las tareas.** Las funciones puras primero (2-6), porque son el corazón y se prueban sin base de datos ni red. Después la escritura (7-9) y por último el borrado (10). El árbol queda verde en cada commit.

---

## Estructura de ficheros

| Fichero | Responsabilidad | Acción |
|---|---|---|
| `prisma/schema.prisma` | Modelo de datos | Modificar: ampliar `ProspectDiscovery`, simplificar `Prospect`, borrar `ProspectEngagement` |
| `app/data/ProspectingProfile.js` | A quién buscamos: cargos, sectores, tramos | Modificar: partir el rango de plantilla, borrar el perfil de referencias |
| `app/lib/prospecting/creditCycle.js` | Cuántos créditos quedan y cuándo renuevan | Crear |
| `app/lib/prospecting/rules.js` | Reglas derivadas de las decisiones | Crear |
| `app/lib/prospecting/candidateFilter.js` | Filtro local de candidatos, gratis | Crear |
| `app/lib/prospecting/apollo.js` | Transporte a la API | Sin cambios |
| `app/api/cron/prospect-queue/route.js` | Llena la cola cada mañana | Crear |
| `app/(admin-zone)/admin/prospects/actions.js` | Decidir sí/no, listar la cola | Reescribir |
| `app/(admin-zone)/admin/prospects/page.js` | La pantalla de triaje | Reescribir |
| `app/lib/linkedin/prospecting.js` | Tareas diarias de prospección | **Borrar** |
| `app/api/admin/prospects/draft-comment/route.js` | Redactor de comentarios con IA | **Borrar** |
| `app/api/cron/discover-prospects/route.js` | Cron semanal | **Borrar** |

---

## Task 1: Modelo de datos

**Files:**
- Modify: `prisma/schema.prisma`
- Create: la migración que genere Prisma

- [ ] **Step 1: Ampliar `ProspectDiscovery`**

Deja de ser el registro de lo enriquecido y pasa a ser el de **todo el que hemos visto**. Sustituye el modelo entero por:

```prisma
// Rastro de TODA persona que la búsqueda nos ha puesto delante, se acabe
// enriqueciendo o no. Es la cola, el historial y el contador de créditos a la
// vez.
//
// Ojo con la diferencia entre `sectorQuery`/`sizeQuery` y la realidad: son los
// parámetros de la CONSULTA que trajo a esta persona, no atributos suyos
// verificados. La búsqueda de Apollo no devuelve ni el sector ni la plantilla de
// la empresa (solo banderas booleanas de si los tiene), y conseguirlos costaría
// un crédito por ficha. Así que lo que sabemos es qué le pedimos a Apollo.
model ProspectDiscovery {
  id          Int      @id @default(autoincrement())
  apolloId    String   @unique
  name        String?
  title       String?
  company     String?
  sectorQuery String? // sector de la consulta que lo trajo
  sizeQuery   String? // tramo de plantilla de esa consulta: "51,100" | "101,250"
  linkedinUrl String? // solo se rellena al enriquecer

  shownOn    DateTime? // día en que entró en la cola
  decision   String    @default("pending") // pending | yes | no
  decidedAt  DateTime?
  reasonCode String? // role | sector | size | in_house_team | other | legacy
  note       String?   @db.Text
  enrichedAt DateTime? // null = nunca gastó crédito
  imported   Boolean   @default(false)
  createdAt  DateTime  @default(now())

  @@index([decision, shownOn])
  @@index([enrichedAt])
}
```

- [ ] **Step 2: Simplificar `Prospect`**

Se queda con lo que sigue teniendo sentido cuando la acción diaria es triar, no comentar:

```prisma
enum ProspectStatus {
  ACTIVE // en la lista de validados
  CLIENT // convertido
  DISCARDED // descartado a posteriori
}

model Prospect {
  id          Int            @id @default(autoincrement())
  name        String
  company     String?
  role        String?
  linkedinUrl String         @unique
  sector      String? // el sector con el que se buscó, heredado del descubrimiento
  notes       String?        @db.Text
  status      ProspectStatus @default(ACTIVE)
  apolloId    String?        @unique
  source      String         @default("manual") // "manual" | "apollo"
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([status, createdAt])
}
```

Desaparecen `kind`, `keywords`, `interest`, `lastEngagedAt`, `lastTouchedAt` y `skipCount`: todos existían para la rotación de comentarios diarios. Y del enum desaparece `PAUSED`, que solo significaba "fuera de rotación" y ya no hay rotación.

- [ ] **Step 3: Borrar `ProspectEngagement`**

Borra el modelo entero y la relación `engagements` de `Prospect`. En producción hay **0 filas**, así que no se pierde historial.

- [ ] **Step 4: Comprobar que ninguna fila usa `PAUSED` antes de migrar**

Quitar un valor de un enum falla si alguna fila lo usa.

Run:
```bash
node --env-file=.env.local -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.\$queryRawUnsafe('SELECT status, count(*) FROM \"Prospect\" GROUP BY status').then(r=>{console.log(r);return p.\$disconnect()})"
```

Expected: solo `ACTIVE` (en producción hay 10, todas ACTIVE). Si aparece `PAUSED`, pásalas a `ACTIVE` con un `UPDATE` antes de seguir y dilo en el informe.

- [ ] **Step 5: Generar la migración con el relleno de datos**

Run: `npx prisma migrate dev --name prospeccion-cola-diaria`

Prisma generará el SQL de esquema. **Edita el fichero de migración generado** y añade al final el relleno de las filas existentes:

```sql
-- Las filas existentes se crearon todas al enriquecer, así que su crédito ya
-- está gastado y el contador debe verlo.
UPDATE "ProspectDiscovery" SET "enrichedAt" = "createdAt" WHERE "enrichedAt" IS NULL;

-- Y ya están decididas de hecho. Se marcan con reasonCode 'legacy' a propósito:
-- las no importadas se descartaron por un fallo técnico (un bug de validación de
-- URL ya corregido), no porque nadie las rechazara, y 'legacy' las mantiene
-- fuera de las reglas derivadas, que solo cuentan los cuatro motivos reales.
UPDATE "ProspectDiscovery"
   SET decision = CASE WHEN imported THEN 'yes' ELSE 'no' END,
       "reasonCode" = 'legacy',
       "decidedAt" = "createdAt"
 WHERE decision = 'pending';
```

- [ ] **Step 6: Verificar la migración**

Run:
```bash
node --env-file=.env.local -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();Promise.all([p.prospectDiscovery.count({where:{enrichedAt:{not:null}}}),p.prospectDiscovery.count({where:{decision:'pending'}}),p.prospect.count()]).then(r=>{console.log('enriquecidos:',r[0],'pendientes:',r[1],'prospectos:',r[2]);return p.\$disconnect()})"
```

Expected: `enriquecidos: 48 pendientes: 0 prospectos: 10`.

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat(prospeccion): la cola sustituye al registro de enriquecidos"
```

---

## Task 2: El ciclo de créditos

Hoy el gasto se aproxima con una ventana móvil de 30 días. El ciclo real de Apollo renueva **el día 16**.

**Files:**
- Create: `app/lib/prospecting/creditCycle.js`
- Test: `app/lib/prospecting/creditCycle.test.js`

- [ ] **Step 1: Escribir el test que falla**

```javascript
import { describe, expect, it } from "vitest";
import { cycleStartFor, nextResetFor, buildCreditStatus } from "./creditCycle";

describe("cycleStartFor", () => {
  it("el día 20 devuelve el 16 de ese mismo mes", () => {
    expect(cycleStartFor(new Date("2026-08-20T10:00:00Z"), 16)).toEqual(
      new Date("2026-08-16T00:00:00.000Z"),
    );
  });

  it("el día 3 devuelve el 16 del mes anterior", () => {
    expect(cycleStartFor(new Date("2026-08-03T10:00:00Z"), 16)).toEqual(
      new Date("2026-07-16T00:00:00.000Z"),
    );
  });

  it("el propio día 16 devuelve ese día: el ciclo empieza hoy", () => {
    expect(cycleStartFor(new Date("2026-08-16T09:00:00Z"), 16)).toEqual(
      new Date("2026-08-16T00:00:00.000Z"),
    );
  });

  it("cruza bien el cambio de año", () => {
    expect(cycleStartFor(new Date("2026-01-05T10:00:00Z"), 16)).toEqual(
      new Date("2025-12-16T00:00:00.000Z"),
    );
  });
});

describe("nextResetFor", () => {
  it("el día 20 devuelve el 16 del mes siguiente", () => {
    expect(nextResetFor(new Date("2026-08-20T10:00:00Z"), 16)).toEqual(
      new Date("2026-09-16T00:00:00.000Z"),
    );
  });

  it("el día 3 devuelve el 16 de este mes", () => {
    expect(nextResetFor(new Date("2026-08-03T10:00:00Z"), 16)).toEqual(
      new Date("2026-08-16T00:00:00.000Z"),
    );
  });

  it("en diciembre cruza al año siguiente", () => {
    expect(nextResetFor(new Date("2026-12-20T10:00:00Z"), 16)).toEqual(
      new Date("2027-01-16T00:00:00.000Z"),
    );
  });
});

describe("buildCreditStatus", () => {
  const now = new Date("2026-08-20T10:00:00Z");

  it("calcula gastados, restantes y días hasta renovar", () => {
    const s = buildCreditStatus({ spent: 17, cap: 60, now, resetDay: 16 });
    expect(s.spent).toBe(17);
    expect(s.remaining).toBe(43);
    expect(s.cap).toBe(60);
    expect(s.daysToReset).toBe(27); // del 20 de agosto al 16 de septiembre
  });

  it("no deja que los restantes bajen de cero", () => {
    const s = buildCreditStatus({ spent: 75, cap: 60, now, resetDay: 16 });
    expect(s.remaining).toBe(0);
    expect(s.exhausted).toBe(true);
  });

  it("marca exhausted solo cuando no queda ninguno", () => {
    expect(buildCreditStatus({ spent: 59, cap: 60, now, resetDay: 16 }).exhausted).toBe(false);
    expect(buildCreditStatus({ spent: 60, cap: 60, now, resetDay: 16 }).exhausted).toBe(true);
  });

  it("reparte el resto entre los días laborables que quedan", () => {
    // Del 20 de agosto (jueves) al 16 de septiembre hay 18 días laborables.
    const s = buildCreditStatus({ spent: 17, cap: 60, now, resetDay: 16 });
    expect(s.workdaysToReset).toBe(18);
    expect(s.pacePerWorkday).toBeCloseTo(43 / 18, 2);
  });

  it("no divide por cero el día antes de renovar", () => {
    const s = buildCreditStatus({
      spent: 10,
      cap: 60,
      now: new Date("2026-08-15T10:00:00Z"),
      resetDay: 16,
    });
    expect(Number.isFinite(s.pacePerWorkday)).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run app/lib/prospecting/creditCycle.test.js`
Expected: FAIL con `cycleStartFor is not a function`.

- [ ] **Step 3: Implementar**

```javascript
// El presupuesto de Apollo no renueva el día 1 sino el 16, que es cuando cae el
// ciclo de facturación de esta cuenta. El código anterior lo aproximaba con una
// ventana móvil de 30 días, que servía para no pasarse pero no podía responder a
// la pregunta que de verdad importa mirando la pantalla: cuánto queda y cuándo
// vuelve a llenarse.
//
// Todo el módulo es puro: recibe `now` en vez de leer el reloj, para que los
// tests puedan situarse en cualquier día del ciclo.

export const DEFAULT_RESET_DAY = 16;
export const DEFAULT_CAP = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

// Se trabaja en UTC a propósito. El desfase con Madrid es de una o dos horas y
// el ciclo dura un mes: hacer aritmética de zona horaria aquí añadiría un modo
// de fallo a cambio de nada.
function utcMidnight(year, month, day) {
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

// Inicio del ciclo vigente: el último día `resetDay` anterior o igual a `now`.
export function cycleStartFor(now = new Date(), resetDay = DEFAULT_RESET_DAY) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return now.getUTCDate() >= resetDay
    ? utcMidnight(y, m, resetDay)
    : utcMidnight(y, m - 1, resetDay); // Date normaliza el mes -1 a diciembre
}

// Próxima renovación: el siguiente día `resetDay` estrictamente posterior a hoy.
export function nextResetFor(now = new Date(), resetDay = DEFAULT_RESET_DAY) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return now.getUTCDate() >= resetDay
    ? utcMidnight(y, m + 1, resetDay)
    : utcMidnight(y, m, resetDay);
}

// Días laborables que quedan hasta la renovación, contando hoy. Se usa para
// sugerir un ritmo: gastar los créditos a ojo es como se llega al día 10 sin
// ninguno.
function workdaysBetween(from, to) {
  let count = 0;
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  while (cursor < to) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

export function buildCreditStatus({
  spent,
  cap = DEFAULT_CAP,
  now = new Date(),
  resetDay = DEFAULT_RESET_DAY,
}) {
  const nextReset = nextResetFor(now, resetDay);
  const remaining = Math.max(0, cap - spent);
  const daysToReset = Math.ceil((nextReset.getTime() - now.getTime()) / DAY_MS);
  const workdaysToReset = workdaysBetween(now, nextReset);

  return {
    spent,
    cap,
    remaining,
    exhausted: remaining === 0,
    cycleStart: cycleStartFor(now, resetDay),
    nextReset,
    daysToReset,
    workdaysToReset,
    // Si no queda ningún laborable, el ritmo es lo que quede: no hay mañana en
    // este ciclo.
    pacePerWorkday: workdaysToReset > 0 ? remaining / workdaysToReset : remaining,
  };
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx vitest run app/lib/prospecting/creditCycle.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/prospecting/creditCycle.js app/lib/prospecting/creditCycle.test.js
git commit -m "feat(prospeccion): contador de creditos sobre el ciclo real de Apollo"
```

---

## Task 3: El perfil de búsqueda, sin referencias y por tramos

**Files:**
- Modify: `app/data/ProspectingProfile.js`

- [ ] **Step 1: Borrar el público "referencia"**

Borra `REFERENCE_PROFILE` entero, `PROSPECT_TASKS_PER_DAY`, `TASKS_PER_KIND`, `contentSearchUrl` y `activityFeedUrl`. Todo eso alimentaba las tareas diarias de comentar, que desaparecen en la Task 10.

Deja `IDEAL_CUSTOMER_PROFILE` solo si algo lo sigue importando; compruébalo con `grep -rn "IDEAL_CUSTOMER_PROFILE\|REFERENCE_PROFILE\|contentSearchUrl\|activityFeedUrl\|TASKS_PER_KIND" app/` y borra lo que quede huérfano.

- [ ] **Step 2: Partir el rango de plantilla en tramos**

Sustituye la constante:

```javascript
// "Mediana empresa" según la definición europea: 50 a 250 empleados. Por debajo
// no hay presupuesto; por encima suele haber equipo propio.
//
// Va partido en dos tramos, y no como un rango único, por una razón que no es
// obvia: la búsqueda de Apollo NO devuelve la plantilla de la empresa (solo una
// bandera de si la tiene), así que la única forma de saber en qué tramo cae un
// candidato es haberlo preguntado. Sin esta partición, el motivo de descarte
// "el tamaño no encaja" no tendría a qué apuntar y la regla derivada no podría
// existir.
export const APOLLO_EMPLOYEE_RANGES = ["51,100", "101,250"];
```

- [ ] **Step 3: Rotar por sector y tramo**

`sectorForWeek` rota por semana. Ahora la rotación es diaria y sobre las 14 combinaciones (7 sectores × 2 tramos). Sustituye `weekIndexFor` y `sectorForWeek` por:

```javascript
// Días transcurridos desde la época Unix. No pretende ser un número de día del
// año: solo un entero que avanza de uno en uno, que es lo que necesita la
// rotación.
export function dayIndexFor(date = new Date()) {
  return Math.floor(date.getTime() / (24 * 60 * 60 * 1000));
}

// Todas las combinaciones de sector y tramo, en orden estable. Son 14, así que
// con una al día una combinación se repite cada dos semanas y media: tiempo de
// sobra para que Apollo tenga caras nuevas que enseñar.
export function searchCombos(profile = BUYER_PROFILE) {
  const sectors = profile.sectors?.length ? profile.sectors : [null];
  return sectors.flatMap((sector) =>
    APOLLO_EMPLOYEE_RANGES.map((size) => ({ sector, size })),
  );
}

// Qué combinación toca hoy. Devuelve `{ sector, size }`.
export function comboForDay(profile = BUYER_PROFILE, dayIndex) {
  const combos = searchCombos(profile);
  if (!combos.length || !Number.isFinite(dayIndex)) return combos[0] ?? null;
  return combos[((dayIndex % combos.length) + combos.length) % combos.length];
}
```

- [ ] **Step 4: `buildApolloQuery` acepta la combinación y las reglas**

```javascript
// Pura: mismo perfil, misma combinación y mismas reglas, misma consulta. Es la
// pieza que decide a quién se dirige la empresa, así que está cubierta por tests.
//
// `rules` viene de app/lib/prospecting/rules.js y sale de contar las decisiones
// pasadas. Aquí solo se aplica; la política de cuándo excluir algo vive allí.
export function buildApolloQuery(
  profile = BUYER_PROFILE,
  { combo, rules = { excludedTitles: [], excludedSizes: [] }, ...overrides } = {},
) {
  const titles = titlesFromRoles(profile.roles).filter(
    (t) => !rules.excludedTitles.includes(t),
  );
  const sectors = combo?.sector ? [combo.sector] : profile.sectors;
  const sizes = combo?.size
    ? [combo.size]
    : APOLLO_EMPLOYEE_RANGES.filter((r) => !rules.excludedSizes.includes(r));

  return {
    person_titles: titles,
    include_similar_titles: true,
    person_seniorities: APOLLO_SENIORITIES,
    person_locations: APOLLO_PERSON_LOCATIONS,
    organization_num_employees_ranges: sizes,
    q_organization_keyword_tags: tagsFromSectors(sectors),
    page: 1,
    per_page: 25,
    ...overrides,
  };
}
```

- [ ] **Step 5: Actualizar los tests del perfil**

`app/data/ProspectingProfile.test.js` — si no existe, comprueba con `ls app/data/`. Los tests que usen `sectorForWeek` o `weekIndexFor` hay que reescribirlos contra `comboForDay` y `dayIndexFor`. Añade además:

```javascript
describe("comboForDay", () => {
  it("recorre las 14 combinaciones antes de repetir", () => {
    const vistas = new Set();
    for (let d = 0; d < 14; d++) {
      const c = comboForDay(BUYER_PROFILE, d);
      vistas.add(`${c.sector}|${c.size}`);
    }
    expect(vistas.size).toBe(14);
  });

  it("es estable: el mismo día da la misma combinación", () => {
    expect(comboForDay(BUYER_PROFILE, 100)).toEqual(comboForDay(BUYER_PROFILE, 100));
  });
});

describe("buildApolloQuery", () => {
  it("pide un solo sector y un solo tramo cuando se le da una combinación", () => {
    const q = buildApolloQuery(BUYER_PROFILE, {
      combo: { sector: "Industria y fabricación", size: "51,100" },
    });
    expect(q.organization_num_employees_ranges).toEqual(["51,100"]);
    expect(q.q_organization_keyword_tags).toEqual(["manufacturing", "industrial automation"]);
  });

  it("quita de la consulta los cargos excluidos por las reglas", () => {
    const q = buildApolloQuery(BUYER_PROFILE, {
      combo: { sector: "Educación", size: "51,100" },
      rules: { excludedTitles: ["CEO"], excludedSizes: [] },
    });
    expect(q.person_titles).not.toContain("CEO");
    expect(q.person_titles).toContain("COO");
  });
});
```

- [ ] **Step 6: Ejecutar**

Run: `npx vitest run app/data/`
Expected: PASS. Es esperado que fallen otros ficheros que aún importan lo borrado; se arreglan en la Task 10. Anota cuáles.

- [ ] **Step 7: Commit**

```bash
git add app/data/ProspectingProfile.js app/data/ProspectingProfile.test.js
git commit -m "feat(prospeccion): rotacion diaria por sector y tramo de plantilla"
```

---

## Task 4: Las reglas derivadas

El corazón del feedback. No se almacenan: se calculan contando decisiones, así que cambiar una decisión hace desaparecer la regla que provocó.

**Files:**
- Create: `app/lib/prospecting/rules.js`
- Test: `app/lib/prospecting/rules.test.js`

- [ ] **Step 1: Escribir el test que falla**

```javascript
import { describe, expect, it } from "vitest";
import { deriveRules, TITLE_STRIKES, SIZE_STRIKES } from "./rules";

const no = (extra) => ({ decision: "no", reasonCode: "role", ...extra });
const si = (extra) => ({ decision: "yes", reasonCode: null, ...extra });

describe("deriveRules — cargos", () => {
  it("excluye un cargo tras tres descartes por cargo", () => {
    const decisiones = Array.from({ length: TITLE_STRIKES }, () =>
      no({ title: "Director Comercial" }),
    );
    expect(deriveRules(decisiones).excludedTitles).toContain("Director Comercial");
  });

  it("no lo excluye con dos", () => {
    const decisiones = [no({ title: "CEO" }), no({ title: "CEO" })];
    expect(deriveRules(decisiones).excludedTitles).toEqual([]);
  });

  it("no cuenta los descartes por otros motivos", () => {
    const decisiones = Array.from({ length: TITLE_STRIKES }, () =>
      no({ title: "CEO", reasonCode: "sector" }),
    );
    expect(deriveRules(decisiones).excludedTitles).toEqual([]);
  });

  it("ignora los motivos legacy de la migración", () => {
    const decisiones = Array.from({ length: 10 }, () =>
      no({ title: "CEO", reasonCode: "legacy" }),
    );
    expect(deriveRules(decisiones).excludedTitles).toEqual([]);
  });

  it("un sí posterior no salva un cargo ya excluido: manda el recuento", () => {
    const decisiones = [
      ...Array.from({ length: TITLE_STRIKES }, () => no({ title: "CIO" })),
      si({ title: "CIO" }),
    ];
    expect(deriveRules(decisiones).excludedTitles).toContain("CIO");
  });

  it("normaliza mayúsculas y espacios al contar", () => {
    const decisiones = [
      no({ title: "  director de it " }),
      no({ title: "Director de IT" }),
      no({ title: "DIRECTOR DE IT" }),
    ];
    expect(deriveRules(decisiones).excludedTitles).toHaveLength(1);
  });
});

describe("deriveRules — tramos de plantilla", () => {
  it("excluye un tramo con cinco descartes por tamaño y ningún sí", () => {
    const decisiones = Array.from({ length: SIZE_STRIKES }, () =>
      no({ sizeQuery: "101,250", reasonCode: "size" }),
    );
    expect(deriveRules(decisiones).excludedSizes).toContain("101,250");
  });

  it("un solo sí en ese tramo lo salva", () => {
    const decisiones = [
      ...Array.from({ length: SIZE_STRIKES }, () =>
        no({ sizeQuery: "101,250", reasonCode: "size" }),
      ),
      si({ sizeQuery: "101,250" }),
    ];
    expect(deriveRules(decisiones).excludedSizes).toEqual([]);
  });
});

describe("deriveRules — orden de sectores", () => {
  it("ordena por tasa de acierto, de mejor a peor", () => {
    const decisiones = [
      si({ sectorQuery: "Industria y fabricación" }),
      si({ sectorQuery: "Industria y fabricación" }),
      no({ sectorQuery: "Industria y fabricación", reasonCode: "sector" }),
      no({ sectorQuery: "Educación", reasonCode: "sector" }),
      no({ sectorQuery: "Educación", reasonCode: "sector" }),
      no({ sectorQuery: "Educación", reasonCode: "sector" }),
    ];
    const orden = deriveRules(decisiones).sectorsByHitRate.map((s) => s.sector);
    expect(orden[0]).toBe("Industria y fabricación");
    expect(orden[orden.length - 1]).toBe("Educación");
  });

  it("cuenta los descartes por equipo propio como fallo del sector", () => {
    const decisiones = Array.from({ length: 3 }, () =>
      no({ sectorQuery: "Servicios profesionales", reasonCode: "in_house_team" }),
    );
    const s = deriveRules(decisiones).sectorsByHitRate.find(
      (x) => x.sector === "Servicios profesionales",
    );
    expect(s.hits).toBe(0);
    expect(s.total).toBe(3);
  });

  it("devuelve listas vacías sin decisiones", () => {
    const r = deriveRules([]);
    expect(r.excludedTitles).toEqual([]);
    expect(r.excludedSizes).toEqual([]);
    expect(r.sectorsByHitRate).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run app/lib/prospecting/rules.test.js`
Expected: FAIL con `deriveRules is not a function`.

- [ ] **Step 3: Implementar**

```javascript
// Las reglas que ajustan la búsqueda salen de CONTAR las decisiones, no de una
// tabla de estado. Esa es la decisión de diseño importante de este módulo, y
// tiene una consecuencia que conviene entender antes de cambiarla: si un día
// cambias de opinión sobre un descarte, la regla que ese descarte provocó
// desaparece sola. No hay estado que corregir ni migración que hacer.
//
// La contrapartida es que la política vive en los umbrales de aquí abajo, y
// tocarlos cambia la búsqueda de mañana. Por eso son constantes exportadas y
// tienen tests propios.

// Tres descartes por cargo bastan para sacarlo. Es agresivo a propósito: la
// consulta lleva catorce cargos y sobra con que funcionen unos pocos; el coste
// de excluir uno bueno por error es bajo y reversible.
export const TITLE_STRIKES = 3;

// Cinco para un tramo de plantilla, y solo si NUNCA ha dado un sí. Aquí el coste
// del error es mucho mayor: solo hay dos tramos, y quedarse sin uno reduce a la
// mitad el pozo de candidatos.
export const SIZE_STRIKES = 5;

// Los motivos que cuentan. 'legacy' queda fuera a propósito: son las decisiones
// que la migración dedujo de filas antiguas, no descartes que nadie hizo.
const REASON_ROLE = "role";
const REASON_SECTOR = "sector";
const REASON_SIZE = "size";
const REASON_IN_HOUSE = "in_house_team";

function normalizeTitle(title) {
  return String(title || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function deriveRules(decisions = []) {
  const titleStrikes = new Map(); // título normalizado → { original, count }
  const sizeStats = new Map(); // tramo → { no, yes }
  const sectorStats = new Map(); // sector → { hits, total }

  for (const d of decisions) {
    const esNo = d.decision === "no";
    const esSi = d.decision === "yes";
    if (!esNo && !esSi) continue;

    if (esNo && d.reasonCode === REASON_ROLE && d.title) {
      const key = normalizeTitle(d.title);
      const prev = titleStrikes.get(key);
      titleStrikes.set(key, {
        original: prev?.original ?? d.title.trim(),
        count: (prev?.count ?? 0) + 1,
      });
    }

    if (d.sizeQuery) {
      const prev = sizeStats.get(d.sizeQuery) ?? { no: 0, yes: 0 };
      if (esSi) prev.yes += 1;
      else if (d.reasonCode === REASON_SIZE) prev.no += 1;
      sizeStats.set(d.sizeQuery, prev);
    }

    // Al sector le cuenta todo: un sí es un acierto, y cualquier no —por el
    // motivo que sea— es una vez que ese sector no dio fruto.
    if (d.sectorQuery) {
      const prev = sectorStats.get(d.sectorQuery) ?? { hits: 0, total: 0 };
      prev.total += 1;
      if (esSi) prev.hits += 1;
      sectorStats.set(d.sectorQuery, prev);
    }
  }

  const excludedTitles = [...titleStrikes.values()]
    .filter((t) => t.count >= TITLE_STRIKES)
    .map((t) => t.original);

  const excludedSizes = [...sizeStats.entries()]
    .filter(([, s]) => s.no >= SIZE_STRIKES && s.yes === 0)
    .map(([size]) => size);

  const sectorsByHitRate = [...sectorStats.entries()]
    .map(([sector, s]) => ({
      sector,
      hits: s.hits,
      total: s.total,
      rate: s.total > 0 ? s.hits / s.total : 0,
    }))
    // Desempate por volumen: entre dos sectores con la misma tasa, va delante
    // el que tiene más decisiones detrás, que es del que más sabemos.
    .sort((a, b) => b.rate - a.rate || b.total - a.total);

  return { excludedTitles, excludedSizes, sectorsByHitRate };
}

// Las estadísticas que pinta el panel "Lo que ha aprendido el filtro". Se
// derivan de lo mismo, pero con los recuentos a la vista para que se pueda
// discrepar con conocimiento.
export function ruleStats(decisions = []) {
  const counts = new Map();
  for (const d of decisions) {
    if (d.decision !== "no" || !d.reasonCode || d.reasonCode === "legacy") continue;
    counts.set(d.reasonCode, (counts.get(d.reasonCode) ?? 0) + 1);
  }
  return {
    ...deriveRules(decisions),
    reasonCounts: Object.fromEntries(counts),
    decided: decisions.filter((d) => d.decision !== "pending").length,
    accepted: decisions.filter((d) => d.decision === "yes").length,
  };
}
```

Comprueba que `REASON_IN_HOUSE` se usa; si el linter lo marca sin usar, es que la constante sobra — bórrala en vez de silenciar el aviso.

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx vitest run app/lib/prospecting/rules.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/prospecting/rules.js app/lib/prospecting/rules.test.js
git commit -m "feat(prospeccion): reglas derivadas de contar las decisiones"
```

---

## Task 5: El filtro local de candidatos

Lo que se puede descartar **gratis**, antes de enseñar nada. Con el `title` y el nombre de la empresa, que es lo único que da la búsqueda.

**Files:**
- Create: `app/lib/prospecting/candidateFilter.js`
- Test: `app/lib/prospecting/candidateFilter.test.js`

- [ ] **Step 1: Escribir el test que falla**

```javascript
import { describe, expect, it } from "vitest";
import { filterCandidates, EXCLUDED_COMPANY_PATTERNS } from "./candidateFilter";

const persona = (extra) => ({
  id: "a1",
  first_name: "José",
  last_name_obfuscated: "R.",
  title: "Director de Operaciones",
  organization: { name: "Envases Ruiz SL" },
  ...extra,
});

describe("filterCandidates", () => {
  it("deja pasar a un candidato normal", () => {
    const { kept, dropped } = filterCandidates([persona()], { rules: {} });
    expect(kept).toHaveLength(1);
    expect(dropped).toHaveLength(0);
  });

  it("descarta a quien no trae id", () => {
    const { kept, dropped } = filterCandidates([persona({ id: null })], { rules: {} });
    expect(kept).toHaveLength(0);
    expect(dropped[0].reason).toBe("sin id de Apollo");
  });

  it("descarta empresas que se dedican a lo que vendemos", () => {
    const casos = ["Acme Software SL", "Estudio Digital", "Nexo Consulting", "La Agencia"];
    for (const name of casos) {
      const { kept } = filterCandidates([persona({ organization: { name } })], { rules: {} });
      expect(kept, `${name} debería descartarse`).toHaveLength(0);
    }
  });

  it("no confunde una subcadena con una palabra", () => {
    // "Software" descarta; "Softwarehouse de Envases" no debería colarse por
    // accidente, pero "Aguas del Norte" tampoco debe morir por contener "gua".
    const { kept } = filterCandidates(
      [persona({ organization: { name: "Aguas del Norte SA" } })],
      { rules: {} },
    );
    expect(kept).toHaveLength(1);
  });

  it("se queda con una sola persona por empresa", () => {
    const { kept, dropped } = filterCandidates(
      [
        persona({ id: "a1", organization: { name: "Envases Ruiz SL" } }),
        persona({ id: "a2", organization: { name: "Envases Ruiz SL" } }),
      ],
      { rules: {} },
    );
    expect(kept).toHaveLength(1);
    expect(dropped[0].reason).toBe("ya hay otro candidato de esa empresa");
  });

  it("descarta los cargos que las reglas han excluido", () => {
    const { kept, dropped } = filterCandidates([persona({ title: "Director Comercial" })], {
      rules: { excludedTitles: ["Director Comercial"] },
    });
    expect(kept).toHaveLength(0);
    expect(dropped[0].reason).toContain("cargo excluido");
  });

  it("compara los cargos excluidos sin distinguir mayúsculas", () => {
    const { kept } = filterCandidates([persona({ title: "  DIRECTOR COMERCIAL " })], {
      rules: { excludedTitles: ["Director Comercial"] },
    });
    expect(kept).toHaveLength(0);
  });

  it("descarta a quien ya hemos visto", () => {
    const { kept, dropped } = filterCandidates([persona({ id: "visto" })], {
      rules: {},
      knownIds: new Set(["visto"]),
    });
    expect(kept).toHaveLength(0);
    expect(dropped[0].reason).toBe("ya estaba en el historial");
  });

  it("no revienta si falta organization", () => {
    const { kept } = filterCandidates([persona({ organization: null })], { rules: {} });
    expect(kept).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run app/lib/prospecting/candidateFilter.test.js`
Expected: FAIL con `filterCandidates is not a function`.

- [ ] **Step 3: Implementar**

```javascript
// Todo lo que se puede descartar sin gastar un crédito, antes de que nadie mire
// la ficha. Es la última defensa gratis: lo que pase de aquí ocupa un hueco de
// los veinte del día.
//
// Trabaja solo con lo que la búsqueda de Apollo devuelve de verdad: `id`,
// `title` y el nombre de la empresa. Nada de sector ni plantilla, que Apollo no
// da en la búsqueda.

// Empresas que resuelven dentro lo que Room714 vende: no son clientes, son
// competencia o proveedores del mismo servicio. Van como palabras completas y no
// como subcadenas, por la misma razón que las reglas de `interestFor` llevan
// límites de palabra: "director" contiene "cto" y eso ya etiquetó mal a diez
// prospectos una vez.
export const EXCLUDED_COMPANY_PATTERNS = [
  /\bsoftware\b/i,
  /\bagencia\b/i,
  /\bagency\b/i,
  /\bconsulting\b/i,
  /\bconsultor(es|ia|ía)?\b/i,
  /\bdigital\b/i,
  /\bstudio\b/i,
  /\bestudio\b/i,
  /\blabs?\b/i,
  /\bmarketing\b/i,
  /\bsaas\b/i,
  /\bit services\b/i,
];

function normalizeTitle(title) {
  return String(title || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeCompany(name) {
  return String(name || "").trim().toLowerCase();
}

// Devuelve `{ kept, dropped }`. `dropped` lleva el motivo de cada descarte para
// que la respuesta del cron sea diagnosticable sin abrir la base de datos.
export function filterCandidates(people = [], { rules = {}, knownIds = new Set() } = {}) {
  const excludedTitles = (rules.excludedTitles ?? []).map(normalizeTitle);
  const kept = [];
  const dropped = [];
  const empresasVistas = new Set();

  for (const p of people) {
    const drop = (reason) => dropped.push({ apolloId: p?.id ?? null, reason });

    if (!p?.id) {
      drop("sin id de Apollo");
      continue;
    }
    if (knownIds.has(p.id)) {
      drop("ya estaba en el historial");
      continue;
    }

    const title = normalizeTitle(p.title);
    if (excludedTitles.includes(title)) {
      drop(`cargo excluido por las reglas: ${p.title}`);
      continue;
    }

    const company = p.organization?.name ?? null;
    if (company && EXCLUDED_COMPANY_PATTERNS.some((re) => re.test(company))) {
      drop(`la empresa parece del sector que ya resuelve esto: ${company}`);
      continue;
    }

    // Una persona por empresa: dos directores de la misma compañía son un solo
    // contacto y gastarían dos créditos por la misma puerta.
    const companyKey = normalizeCompany(company);
    if (companyKey && empresasVistas.has(companyKey)) {
      drop("ya hay otro candidato de esa empresa");
      continue;
    }
    if (companyKey) empresasVistas.add(companyKey);

    kept.push(p);
  }

  return { kept, dropped };
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx vitest run app/lib/prospecting/candidateFilter.test.js`
Expected: PASS.

Si el caso de "Aguas del Norte SA" falla, revisa qué patrón lo está capturando y ajusta ese patrón: el test está señalando un falso positivo real.

- [ ] **Step 5: Commit**

```bash
git add app/lib/prospecting/candidateFilter.js app/lib/prospecting/candidateFilter.test.js
git commit -m "feat(prospeccion): filtro local que no gasta creditos"
```

---

## Task 6: Construir la cola del día

La función que orquesta: consulta las decisiones, deriva las reglas, busca en Apollo paginando, filtra y devuelve los 20. **No escribe**: eso lo hace la Task 7, para poder probar esta parte sin base de datos.

**Files:**
- Create: `app/lib/prospecting/buildQueue.js`
- Test: `app/lib/prospecting/buildQueue.test.js`

- [ ] **Step 1: Escribir el test que falla**

```javascript
import { describe, expect, it, vi } from "vitest";
import {
  collectFreshCandidates,
  startPageFor,
  QUEUE_SIZE,
  MAX_SEARCH_PAGES,
  PER_PAGE,
} from "./buildQueue";

describe("startPageFor", () => {
  it("empieza por la primera si no hemos visto a nadie de esa combinación", () => {
    expect(startPageFor(0)).toBe(1);
    expect(startPageFor(undefined)).toBe(1);
  });

  it("no retrocede de la primera con pocos vistos", () => {
    expect(startPageFor(10)).toBe(1);
  });

  it("avanza conforme se agota la combinación, con una página de solape", () => {
    expect(startPageFor(2 * PER_PAGE)).toBe(2);
    expect(startPageFor(5 * PER_PAGE)).toBe(5);
  });
});

const persona = (id, company) => ({
  id,
  first_name: "N",
  last_name_obfuscated: "N.",
  title: "COO",
  organization: { name: company ?? `Empresa ${id}` },
});

describe("collectFreshCandidates", () => {
  it("para de paginar en cuanto reúne los que necesita", async () => {
    const search = vi.fn(async () => ({
      people: Array.from({ length: 25 }, (_, i) => persona(`p${Math.random()}`)),
      totalEntries: 500,
    }));

    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(),
    });

    expect(r.candidates).toHaveLength(QUEUE_SIZE);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("avanza de página si la primera no basta", async () => {
    let page = 0;
    const search = vi.fn(async () => {
      page += 1;
      // Cada página trae 25, pero 20 de ellas ya conocidas.
      return {
        people: Array.from({ length: 25 }, (_, i) =>
          persona(i < 20 ? `conocido-${page}-${i}` : `nuevo-${page}-${i}`),
        ),
        totalEntries: 500,
      };
    });
    const knownIds = new Set();
    for (let p = 1; p <= 5; p++) {
      for (let i = 0; i < 20; i++) knownIds.add(`conocido-${p}-${i}`);
    }

    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds,
    });

    expect(search.mock.calls.length).toBeGreaterThan(1);
    expect(r.candidates.length).toBeGreaterThan(0);
  });

  it("se rinde al llegar al tope de páginas y lo dice", async () => {
    const search = vi.fn(async () => ({ people: [persona("repetido")], totalEntries: 10 }));

    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(["repetido"]),
    });

    expect(search).toHaveBeenCalledTimes(MAX_SEARCH_PAGES);
    expect(r.exhausted).toBe(true);
    expect(r.candidates).toHaveLength(0);
  });

  it("para si una página vuelve vacía", async () => {
    const search = vi.fn(async () => ({ people: [], totalEntries: 0 }));
    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(),
    });
    expect(search).toHaveBeenCalledTimes(1);
    expect(r.exhausted).toBe(true);
  });

  it("no repite a la misma persona entre páginas", async () => {
    const search = vi.fn(async () => ({
      people: [persona("mismo", "Empresa A"), persona("otro", "Empresa B")],
      totalEntries: 100,
    }));
    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(),
    });
    const ids = r.candidates.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("empieza por la página que le digan", async () => {
    const search = vi.fn(async () => ({ people: [], totalEntries: 0 }));
    await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(),
      startPage: 4,
    });
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ page: 4 }));
  });

  it("acumula los descartes del filtro para poder diagnosticar", async () => {
    const search = vi.fn(async () => ({
      people: [persona("a", "Acme Software SL"), persona("b", "Envases Ruiz")],
      totalEntries: 100,
    }));
    const r = await collectFreshCandidates({
      search,
      query: {},
      wanted: QUEUE_SIZE,
      rules: {},
      knownIds: new Set(),
    });
    expect(r.dropped.some((d) => d.reason.includes("sector que ya resuelve"))).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run app/lib/prospecting/buildQueue.test.js`
Expected: FAIL con `collectFreshCandidates is not a function`.

- [ ] **Step 3: Implementar**

```javascript
import { filterCandidates } from "./candidateFilter";

// Cuántas fichas se le ponen delante cada mañana. Veinte y no cuatro o cinco
// porque buscar es gratis: el cuello de botella es el presupuesto de créditos,
// que se gasta al decir que sí, no al mirar.
export const QUEUE_SIZE = 20;

// Cuántas páginas recorrer en una ejecución buscando caras nuevas. Con 25 por
// página son hasta 125 personas revisadas, y buscar no cuesta créditos.
export const MAX_SEARCH_PAGES = 5;

// Resultados por página que devuelve Apollo. Se usa para deducir por qué página
// va cada combinación.
export const PER_PAGE = 25;

// Por qué página empezar en una combinación de la que ya hemos visto gente.
//
// La búsqueda es determinista: pedir siempre la página 1 devuelve las mismas 25
// personas. Al principio da igual, porque se filtran por conocidas y se avanza;
// pero cuando una combinación lleva 125 caras vistas, las cinco páginas del
// recorrido son todas conocidas y deja de encontrar a nadie para siempre.
//
// En vez de guardar un puntero por combinación, se deduce de lo que ya hay en la
// base: si de esta combinación hemos visto 60 personas, están en las páginas 1 a
// 3, así que se empieza por la 3. Se resta una página de solape a propósito,
// porque el índice de Apollo se mueve y las fronteras no son exactas.
export function startPageFor(seenInCombo) {
  if (!seenInCombo) return 1;
  return Math.max(1, Math.floor(seenInCombo / PER_PAGE));
}

// Recorre páginas hasta reunir `wanted` candidatos que no hayamos visto y que
// pasen el filtro local. No escribe nada y no gasta créditos: la búsqueda de
// personas de Apollo es gratis.
//
// `search` se inyecta para poder probar esto sin red.
export async function collectFreshCandidates({
  search,
  query,
  wanted = QUEUE_SIZE,
  rules = {},
  knownIds = new Set(),
  startPage = 1,
}) {
  const candidates = [];
  const dropped = [];
  const yaElegidos = new Set();
  let searched = 0;
  let pagesUsed = 0;
  let totalEntries = null;

  const lastPage = startPage + MAX_SEARCH_PAGES - 1;
  for (let page = startPage; page <= lastPage && candidates.length < wanted; page++) {
    const result = await search({ ...query, page });
    pagesUsed = page;
    searched += result.people.length;
    totalEntries = result.totalEntries ?? totalEntries;

    if (result.people.length === 0) break;

    // Los ya elegidos en páginas anteriores cuentan como conocidos: Apollo puede
    // devolver a la misma persona en dos páginas si el índice se mueve entre
    // llamadas.
    const vistos = new Set([...knownIds, ...yaElegidos]);
    const { kept, dropped: fuera } = filterCandidates(result.people, {
      rules,
      knownIds: vistos,
    });
    dropped.push(...fuera);

    for (const p of kept) {
      if (candidates.length >= wanted) break;
      candidates.push(p);
      yaElegidos.add(p.id);
    }
  }

  return {
    candidates,
    dropped,
    searched,
    pagesUsed,
    totalEntries,
    // Se agotó el pozo de esta combinación: o no quedan páginas o no quedan
    // caras nuevas. Lo consume el cron para avisar.
    exhausted: candidates.length < wanted,
  };
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx vitest run app/lib/prospecting/buildQueue.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/prospecting/buildQueue.js app/lib/prospecting/buildQueue.test.js
git commit -m "feat(prospeccion): paginacion hasta reunir veinte caras nuevas"
```

---

## Task 7: El cron que llena la cola

**Files:**
- Create: `app/api/cron/prospect-queue/route.js`

- [ ] **Step 1: Crear la ruta**

Sigue el patrón de los otros crones del directorio: `Bearer CRON_SECRET`, guard de hora Madrid, `?preview=1`, `NextResponse.json`. Ábrete `app/api/cron/generate/route.js` antes de escribir.

```javascript
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { searchPeople } from "@/app/lib/prospecting/apollo";
import {
  BUYER_PROFILE,
  buildApolloQuery,
  comboForDay,
  dayIndexFor,
} from "@/app/data/ProspectingProfile";
import {
  collectFreshCandidates,
  startPageFor,
  QUEUE_SIZE,
} from "@/app/lib/prospecting/buildQueue";
import { deriveRules } from "@/app/lib/prospecting/rules";
import { isMadridHour } from "@/app/lib/time/madrid";

export const maxDuration = 60;

// 06:00, a la vez que la generación del artículo: la cola tiene que estar lista
// antes de que nadie se siente, y buscar en Apollo es rápido porque no enriquece.
const TARGET_HOUR = 6;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("No autorizado", { status: 401 });
  }

  // Preview: enseña a quién pondría en la cola sin escribir nada. Como buscar es
  // gratis, este modo no cuesta absolutamente nada y es la forma de validar un
  // cambio de criterio antes de vivir con él una mañana entera.
  const preview = new URL(request.url).searchParams.get("preview") === "1";

  if (!preview && !isMadridHour(TARGET_HOUR)) {
    return NextResponse.json({
      message: "Saltado: no es la hora correcta en Madrid",
      targetHour: `${TARGET_HOUR}:00 Madrid`,
    });
  }

  try {
    // Si la cola de ayer sigue sin revisar, no se acumula encima. Una cola que
    // crece es una cola que se abandona.
    const pendientes = await prisma.prospectDiscovery.count({
      where: { decision: "pending" },
    });
    if (pendientes >= QUEUE_SIZE) {
      return NextResponse.json({
        skipped: true,
        reason: `Ya hay ${pendientes} candidatos pendientes de revisar`,
        pendientes,
      });
    }

    // Las reglas salen de contar las decisiones. Se traen solo los campos que
    // deriveRules mira, que además evita arrastrar notas largas.
    const decisiones = await prisma.prospectDiscovery.findMany({
      where: { decision: { in: ["yes", "no"] } },
      select: {
        decision: true,
        reasonCode: true,
        title: true,
        sectorQuery: true,
        sizeQuery: true,
      },
    });
    const rules = deriveRules(decisiones);

    const combo = comboForDay(BUYER_PROFILE, dayIndexFor(new Date()));
    const query = buildApolloQuery(BUYER_PROFILE, { combo, rules });

    // Todo el historial: son unas decenas de filas y evita volver a enseñar a
    // alguien que ya se descartó hace meses.
    const conocidos = await prisma.prospectDiscovery.findMany({
      select: { apolloId: true },
    });
    const knownIds = new Set(conocidos.map((c) => c.apolloId));

    // Por qué página empezar: se deduce de cuánta gente hemos visto ya de ESTA
    // combinación. Sin esto, cuando una combinación acumula 125 caras vistas las
    // cinco páginas del recorrido son todas conocidas y deja de dar a nadie.
    const vistosEnCombo = await prisma.prospectDiscovery.count({
      where: { sectorQuery: combo?.sector ?? null, sizeQuery: combo?.size ?? null },
    });

    const wanted = QUEUE_SIZE - pendientes;
    const resultado = await collectFreshCandidates({
      search: searchPeople,
      query,
      wanted,
      rules,
      knownIds,
      startPage: startPageFor(vistosEnCombo),
    });

    const resumen = {
      combo,
      pendientesPrevios: pendientes,
      wanted,
      searched: resultado.searched,
      pagesUsed: resultado.pagesUsed,
      totalEntries: resultado.totalEntries,
      encontrados: resultado.candidates.length,
      descartados: resultado.dropped.length,
      exhausted: resultado.exhausted,
      reglasActivas: {
        cargosExcluidos: rules.excludedTitles,
        tramosExcluidos: rules.excludedSizes,
      },
    };

    if (preview) {
      return NextResponse.json({
        ...resumen,
        mode: "preview",
        message: "Preview: nada escrito, ningún crédito gastado (buscar es gratis)",
        query,
        muestra: resultado.candidates.slice(0, 10).map((p) => ({
          apolloId: p.id,
          title: p.title,
          company: p.organization?.name ?? null,
        })),
        motivosDeDescarte: resultado.dropped.slice(0, 20),
      });
    }

    if (resultado.candidates.length === 0) {
      return NextResponse.json({
        ...resumen,
        skipped: true,
        reason: "La búsqueda no devolvió a nadie nuevo para esta combinación",
      });
    }

    const shownOn = new Date();
    await prisma.prospectDiscovery.createMany({
      data: resultado.candidates.map((p) => ({
        apolloId: p.id,
        name: [p.first_name, p.last_name_obfuscated].filter(Boolean).join(" ") || null,
        title: p.title || null,
        company: p.organization?.name ?? null,
        sectorQuery: combo?.sector ?? null,
        sizeQuery: combo?.size ?? null,
        shownOn,
        decision: "pending",
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      ...resumen,
      message: `${resultado.candidates.length} candidatos en la cola de hoy`,
    });
  } catch (err) {
    console.error("❌ Error en cron prospect-queue:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

Fíjate en `skipDuplicates: true`: aquí sí es lo correcto, al revés que en las tomas de LinkedIn. Cada fila es independiente, y que una carrera meta dos veces al mismo candidato no debe tirar la cola entera.

- [ ] **Step 2: Añadir el cron a `vercel.json`**

06:00 Madrid, de lunes a viernes. Dos entradas por horario estacional, como el resto:

```json
    { "path": "/api/cron/prospect-queue", "schedule": "0 4 * * 1-5" },
    { "path": "/api/cron/prospect-queue", "schedule": "0 5 * * 1-5" },
```

Comprueba el par: en invierno (UTC+1) `0 4` da las 05:00 (no pasa) y `0 5` las 06:00 (pasa); en verano (UTC+2) `0 4` da las 06:00 (pasa) y `0 5` las 07:00 (no pasa). Exactamente una por estación.

- [ ] **Step 3: Verificar**

Run: `npx next build`
Expected: `/api/cron/prospect-queue` aparece en el listado de rutas.

Run: `node -e "console.log(require('./vercel.json').crons.length)"`
Expected: `15` (los 13 de antes más estos dos).

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/prospect-queue/route.js vercel.json
git commit -m "feat(cron): prospect-queue llena la cola diaria sin gastar creditos"
```

---

## Task 8: Las acciones de decidir

**Files:**
- Rewrite: `app/(admin-zone)/admin/prospects/actions.js`

- [ ] **Step 1: Reescribir el fichero entero**

```javascript
"use server";

import { prisma } from "@/app/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/authOptions";
import { enrichPeople } from "@/app/lib/prospecting/apollo";
import { normalizeLinkedInProfileUrl } from "@/app/lib/prospecting/prospectFields";
import {
  DEFAULT_CAP,
  DEFAULT_RESET_DAY,
  buildCreditStatus,
  cycleStartFor,
} from "@/app/lib/prospecting/creditCycle";
import { ruleStats } from "@/app/lib/prospecting/rules";

// Defensa en profundidad: el proxy ya exige sesión bajo /admin, pero estas
// acciones escriben en base de datos y una de ellas gasta dinero.
async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("No autorizado");
}

const VALID_REASONS = ["role", "sector", "size", "in_house_team", "other"];

function cap() {
  return Number(process.env.APOLLO_MONTHLY_ENRICH_CAP) || DEFAULT_CAP;
}

function resetDay() {
  return Number(process.env.APOLLO_CYCLE_RESET_DAY) || DEFAULT_RESET_DAY;
}

// Créditos gastados en el ciclo vigente: filas con `enrichedAt` desde el último
// día de renovación. Se cuenta `enrichedAt` y no las filas, porque desde esta
// fase la mayoría de filas no gastan crédito ninguno.
async function creditStatus(now = new Date()) {
  const spent = await prisma.prospectDiscovery.count({
    where: { enrichedAt: { gte: cycleStartFor(now, resetDay()) } },
  });
  return buildCreditStatus({ spent, cap: cap(), now, resetDay: resetDay() });
}

// Lo que pinta la pantalla de un tirón: la cola, el contador y el panel de
// aprendizaje. Una sola acción para no encadenar tres viajes desde el cliente.
export async function loadQueue() {
  try {
    const [queue, decisiones, credits, validados] = await Promise.all([
      prisma.prospectDiscovery.findMany({
        where: { decision: "pending" },
        orderBy: [{ shownOn: "asc" }, { id: "asc" }],
        take: 20,
      }),
      prisma.prospectDiscovery.findMany({
        where: { decision: { in: ["yes", "no"] } },
        select: {
          decision: true,
          reasonCode: true,
          note: true,
          title: true,
          company: true,
          sectorQuery: true,
          sizeQuery: true,
          decidedAt: true,
        },
        orderBy: { decidedAt: "desc" },
      }),
      creditStatus(),
      prisma.prospect.count({ where: { status: "ACTIVE" } }),
    ]);

    return {
      success: true,
      queue,
      credits,
      stats: ruleStats(decisiones),
      notes: decisiones
        .filter((d) => d.note)
        .slice(0, 30)
        .map((d) => ({ note: d.note, company: d.company, decidedAt: d.decidedAt })),
      validados,
    };
  } catch (err) {
    console.error("[prospects] cargar la cola falló:", err);
    return { success: false, error: err.message };
  }
}

// Un "no" no gasta nada. El motivo es obligatorio: es lo único que alimenta las
// reglas, y un descarte sin motivo es una decisión que el sistema no puede
// aprender.
export async function rejectCandidate({ id, reasonCode, note }) {
  await requireSession();

  if (!VALID_REASONS.includes(reasonCode)) {
    return { success: false, error: "Motivo no válido" };
  }

  try {
    await prisma.prospectDiscovery.update({
      where: { id: Number(id) },
      data: {
        decision: "no",
        reasonCode,
        note: (note || "").trim() || null,
        decidedAt: new Date(),
      },
    });
    revalidatePath("/admin/prospects");
    return { success: true };
  } catch (err) {
    console.error("[prospects] rechazar falló:", err);
    return { success: false, error: err.message };
  }
}

// Un "sí" SÍ gasta: un crédito de Apollo, ahora mismo. Todo lo de esta función
// está ordenado alrededor de eso.
export async function acceptCandidate({ id, note }) {
  await requireSession();

  try {
    const candidato = await prisma.prospectDiscovery.findUnique({
      where: { id: Number(id) },
    });
    if (!candidato) return { success: false, error: "Candidato no encontrado" };
    if (candidato.decision !== "pending") {
      return { success: false, error: "Ese candidato ya estaba decidido" };
    }

    // Se comprueba el presupuesto ANTES de llamar a Apollo, no después: llamar y
    // luego descubrir que no había crédito gasta el crédito igual.
    const credits = await creditStatus();
    if (credits.exhausted) {
      return {
        success: false,
        error: `Sin créditos: ${credits.spent} de ${credits.cap} gastados en este ciclo. Renuevan en ${credits.daysToReset} días.`,
      };
    }

    const { matches } = await enrichPeople([candidato.apolloId]);
    const match = matches[0];

    // El crédito se ha gastado aunque el resultado no sirva, así que se marca
    // `enrichedAt` pase lo que pase. Ocultarlo haría que el contador mintiera.
    const enrichedAt = new Date();
    const linkedinUrl = normalizeLinkedInProfileUrl(match?.linkedin_url);

    if (!linkedinUrl) {
      await prisma.prospectDiscovery.update({
        where: { id: candidato.id },
        data: {
          decision: "no",
          reasonCode: "other",
          note: "Apollo no devolvió una URL de LinkedIn utilizable",
          decidedAt: enrichedAt,
          enrichedAt,
        },
      });
      revalidatePath("/admin/prospects");
      return {
        success: false,
        error: "Apollo no devolvió URL de LinkedIn. El crédito se ha gastado igual.",
      };
    }

    const duplicado = await prisma.prospect.findUnique({ where: { linkedinUrl } });

    if (!duplicado) {
      await prisma.prospect.create({
        data: {
          name: match.name || candidato.name || "(sin nombre)",
          company: match.organization?.name ?? candidato.company,
          role: match.title || candidato.title,
          linkedinUrl,
          sector: candidato.sectorQuery,
          notes: (note || "").trim() || null,
          status: "ACTIVE",
          source: "apollo",
          apolloId: candidato.apolloId,
        },
      });
    }

    await prisma.prospectDiscovery.update({
      where: { id: candidato.id },
      data: {
        decision: "yes",
        note: (note || "").trim() || null,
        decidedAt: enrichedAt,
        enrichedAt,
        linkedinUrl,
        imported: !duplicado,
      },
    });

    revalidatePath("/admin/prospects");
    return { success: true, linkedinUrl, duplicado: Boolean(duplicado) };
  } catch (err) {
    console.error("[prospects] aceptar falló:", err);
    return { success: false, error: err.message };
  }
}

// La lista de validados: el resultado del sistema.
export async function listProspects() {
  try {
    const prospects = await prisma.prospect.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return { success: true, prospects };
  } catch (err) {
    console.error("[prospects] listar falló:", err);
    return { success: false, error: err.message };
  }
}

export async function setProspectStatus(id, status) {
  await requireSession();
  if (!["ACTIVE", "CLIENT", "DISCARDED"].includes(status)) {
    return { success: false, error: "Estado no válido" };
  }
  try {
    await prisma.prospect.update({ where: { id: Number(id) }, data: { status } });
    revalidatePath("/admin/prospects");
    return { success: true };
  } catch (err) {
    console.error("[prospects] cambiar estado falló:", err);
    return { success: false, error: err.message };
  }
}
```

Desaparecen `saveProspect`, `deleteProspect`, `runDiscovery`, `registerEngagement` y `skipProspect`.

- [ ] **Step 2: Verificar que compila**

Run: `npx eslint "app/(admin-zone)/admin/prospects/actions.js"`
Expected: limpio. Si marca imports sin usar, quítalos.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin-zone)/admin/prospects/actions.js"
git commit -m "feat(prospeccion): decidir gasta credito solo al aceptar"
```

---

## Task 9: La pantalla de triaje

**Files:**
- Rewrite: `app/(admin-zone)/admin/prospects/page.js`

- [ ] **Step 1: Reescribir la pantalla**

Tres zonas: cabecera con el contador, la cola de fichas y el panel de aprendizaje plegado. Sigue el estilo del fichero actual (componente de cliente, Tailwind, `useState`/`useEffect`, avisos con `flash`).

Aquí van las piezas que no se pueden improvisar. El resto de la maquetación queda a tu criterio siguiendo el estilo del admin.

```jsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { acceptCandidate, loadQueue, rejectCandidate } from "./actions";

// Los cinco motivos, con el texto que se le enseña a quien decide. El orden
// importa: los tres primeros son los que más se van a usar.
const REASONS = [
  ["role", "El cargo no encaja"],
  ["sector", "El sector no encaja"],
  ["size", "El tamaño no encaja"],
  ["in_house_team", "Ya tienen equipo propio"],
  ["other", "Otro motivo"],
];

function CreditHeader({ credits, decididosHoy }) {
  const fecha = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(credits.nextReset));

  return (
    <div className="rounded-xl border p-4 mb-6">
      <p className="text-2xl font-black">
        {credits.remaining} de {credits.cap} créditos
      </p>
      <p className="text-sm text-gray-600">
        Renueva el {fecha}, dentro de {credits.daysToReset} días ·{" "}
        {credits.pacePerWorkday.toFixed(1)} al día si te los quieres gastar todos
      </p>
      <p className="text-sm text-gray-600">
        Hoy llevas {decididosHoy} decisiones.
      </p>
      {credits.exhausted && (
        <p className="mt-2 text-sm font-bold text-red-700">
          Sin créditos en este ciclo. Puedes seguir descartando, que es gratis.
        </p>
      )}
    </div>
  );
}

function CandidateCard({ candidato, exhausted, onAccept, onReject }) {
  const [eligiendoMotivo, setEligiendoMotivo] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const criterio = [
    candidato.sectorQuery,
    candidato.sizeQuery ? `${candidato.sizeQuery.replace(",", "-")} empleados` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-xl border p-4">
      <p className="text-lg font-bold">{candidato.title || "(sin cargo)"}</p>
      <p className="text-gray-800">{candidato.company || "(sin empresa)"}</p>

      {criterio && (
        <p className="mt-1 text-xs text-gray-500">
          Buscado como: {criterio}.{" "}
          <span className="italic">
            Es el criterio con el que se buscó, no datos comprobados de la empresa:
            la búsqueda de Apollo no devuelve ni sector ni plantilla.
          </span>
        </p>
      )}

      <textarea
        className="mt-3 w-full rounded border p-2 text-sm"
        rows={2}
        placeholder="Nota (opcional): lo que no cabe en los cinco motivos"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {!eligiendoMotivo ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            disabled={busy || exhausted}
            title={exhausted ? "Sin créditos en este ciclo" : undefined}
            className="rounded bg-black px-4 py-2 font-bold text-white disabled:opacity-40"
            onClick={async () => {
              setBusy(true);
              await onAccept(candidato.id, note);
              setBusy(false);
            }}
          >
            Sí · 1 crédito
          </button>
          <button
            disabled={busy}
            className="rounded border px-4 py-2 font-bold"
            onClick={() => setEligiendoMotivo(true)}
          >
            No
          </button>
          {exhausted && (
            <span className="text-xs text-red-700">
              Sin créditos: solo puedes descartar
            </span>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="mb-2 text-sm font-bold">¿Por qué no?</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map(([code, label]) => (
              <button
                key={code}
                disabled={busy}
                className="rounded border px-3 py-1 text-sm"
                onClick={async () => {
                  setBusy(true);
                  await onReject(candidato.id, code, note);
                  setBusy(false);
                }}
              >
                {label}
              </button>
            ))}
            <button
              className="px-3 py-1 text-sm underline"
              onClick={() => setEligiendoMotivo(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

Y el contenedor, que carga de una sola vez y refresca tras cada decisión:

```jsx
export default function ProspectsPage() {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [aceptados, setAceptados] = useState([]); // {id, linkedinUrl}

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const load = useCallback(async () => {
    const res = await loadQueue();
    if (res.success) setData(res);
    else flash(`⚠️ ${res.error}`);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (id, note) => {
    const res = await acceptCandidate({ id, note });
    if (!res.success) return flash(`⚠️ ${res.error}`);
    // Se guarda el enlace para poder abrirlo sin buscarlo: es lo primero que se
    // quiere hacer después de decir que sí.
    setAceptados((prev) => [...prev, { id, linkedinUrl: res.linkedinUrl }]);
    flash(res.duplicado ? "Ya estaba en la lista" : "Añadido a validados");
    load();
  };

  const handleReject = async (id, reasonCode, note) => {
    const res = await rejectCandidate({ id, reasonCode, note });
    if (!res.success) return flash(`⚠️ ${res.error}`);
    load();
  };

  if (!data) return <p className="p-6">Cargando…</p>;

  return (
    <div className="p-6">
      {notice && <p className="mb-4 rounded bg-gray-100 p-3">{notice}</p>}
      <CreditHeader credits={data.credits} decididosHoy={aceptados.length} />
      <div className="grid gap-4">
        {data.queue.map((c) => (
          <CandidateCard
            key={c.id}
            candidato={c}
            exhausted={data.credits.exhausted}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        ))}
      </div>
      {data.queue.length === 0 && (
        <p className="rounded-xl border p-6 text-center text-gray-600">
          Cola vacía. La siguiente llega mañana a las 06:00.
        </p>
      )}
    </div>
  );
}
```

Te quedan por añadir, con el mismo estilo:

- Los **enlaces de los aceptados**: recorre `aceptados` y pinta cada `linkedinUrl` como enlace que se abre en pestaña nueva.
- El **panel plegado "Lo que ha aprendido el filtro"**, alimentado por `data.stats`: `excludedTitles` con su recuento, `sectorsByHitRate` mostrando `hits/total` y el porcentaje, `excludedSizes`, `reasonCounts`, y `data.notes` en orden cronológico.
- La **pestaña de validados**, con `listProspects` y `setProspectStatus`: nombre, empresa, cargo, enlace a LinkedIn y un selector de estado.

`decididosHoy` cuenta solo los aceptados de esta sesión, que es lo honesto sin una consulta más; si prefieres el total real del día, añádelo a `loadQueue` contando `decidedAt` dentro del día de Madrid.

- [ ] **Step 2: Verificar a mano**

Run: `npm run dev`, entra en `/admin/prospects`.

Comprueba: la cola carga; el contador cuadra con la base; "No" exige motivo; "Sí" queda deshabilitado si no hay crédito. **No pulses "Sí" todavía**: eso gasta un crédito real y se prueba en la Task 11.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin-zone)/admin/prospects/page.js"
git commit -m "feat(prospeccion): pantalla de triaje con contador de creditos"
```

---

## Task 10: Borrar lo que ya no se usa

**Files:**
- Delete: `app/lib/linkedin/prospecting.js`, `app/lib/linkedin/prospecting.test.js`
- Delete: `app/api/admin/prospects/draft-comment/route.js`
- Delete: `app/api/cron/discover-prospects/route.js`
- Modify: `app/api/cron/daily-briefing/route.js`, `app/lib/prospecting/prospectFields.js`, `app/lib/prospecting/prospectFields.test.js`, `vercel.json`

- [ ] **Step 1: Borrar los ficheros**

```bash
git rm app/lib/linkedin/prospecting.js app/lib/linkedin/prospecting.test.js
git rm app/api/admin/prospects/draft-comment/route.js
git rm app/api/cron/discover-prospects/route.js
```

- [ ] **Step 2: Quitar la prospección del briefing**

En `app/api/cron/daily-briefing/route.js`: quita el import de `buildProspectingTasks`, la consulta de `prospects` del `Promise.all` y el bloque que empuja `prospectingTasks`. En su lugar, una sola línea con la cola del día. Añade a la consulta:

```javascript
      prisma.prospectDiscovery.count({ where: { decision: "pending" } }),
```

y después de construir las tareas:

```javascript
    // Toda la prospección del día cabe en una línea: revisar la cola. Antes
    // había dos tareas diarias —comentar el post de alguien y buscar
    // referencias— que en meses no produjeron ni un solo engagement.
    if (pendientes > 0) {
      tasks.push({
        id: "prospect-queue",
        kind: "prospect_queue",
        when: "after",
        time: "09:00",
        channel: null,
        title: `Revisa la cola de prospectos (${pendientes} pendientes)`,
        adminUrl: `${siteUrl}/admin/prospects`,
      });
    }
```

Añade la rama `case "prospect_queue"` al switch de `app/lib/notifications/dailyBriefing.js`, con el botón al admin.

- [ ] **Step 3: Limpiar `prospectFields.js`**

Se queda solo `normalizeLinkedInProfileUrl`. Borra `INTEREST_RULES`, `interestFor` y `keywordsFor`: alimentaban el prompt del redactor de comentarios, que ya no existe. Ajusta `prospectFields.test.js` en consecuencia — **conserva** los tests de `normalizeLinkedInProfileUrl`, que documentan el bug del `http` vs `https` que costó 26 créditos.

- [ ] **Step 4: Quitar el cron viejo de `vercel.json`**

Borra las dos líneas de `/api/cron/discover-prospects`.

- [ ] **Step 5: Barrer lo que quede colgando**

Run: `grep -rn "buildProspectingTasks\|draft-comment\|discover-prospects\|interestFor\|keywordsFor\|REFERENCE_PROFILE\|lastEngagedAt\|lastTouchedAt\|skipCount\|registerEngagement\|prospectKind" app/`
Expected: sin resultados.

- [ ] **Step 6: Verificar**

Run: `npx vitest run`
Expected: **verde entero**. Esta es la tarea que devuelve la suite al verde.

Run: `npx next build`
Expected: correcto.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(prospeccion): fuera el publico referencia y el redactor de comentarios"
```

---

## Task 11: Verificación contra la API real

Nada de esto cambia código. **Requiere `APOLLO_API_KEY` en `.env.local`**; si no está, para y pídela.

- [ ] **Step 1: Suite y build**

Run: `npx vitest run` → verde entero.
Run: `npx next build` → correcto.

- [ ] **Step 2: Preview de la cola, que no cuesta nada**

Con `npm run dev` levantado:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/prospect-queue?preview=1"
```

Comprueba en la respuesta:
- `combo` trae un sector y un tramo, y cambia si repites el preview al día siguiente
- `encontrados` es 20, o menos con `exhausted: true`
- `muestra` trae cargos y empresas plausibles
- `motivosDeDescarte` enseña que el filtro local está descartando algo
- `totalEntries` da idea del pozo de esa combinación

Anota `totalEntries`: es el dato que dirá si 20 al día es sostenible o si hay que ampliar el perfil.

- [ ] **Step 3: Llenar la cola de verdad**

Quita el `?preview=1`. Sigue sin gastar créditos: solo escribe las 20 filas.

- [ ] **Step 4: Probar el contador con un "sí" real**

Entra en `/admin/prospects`, acepta **un** candidato y comprueba que el contador baja en uno, que aparece en la lista de validados con su enlace, y que el enlace abre un perfil de LinkedIn real. **Es el único paso de todo el plan que gasta dinero: un crédito.**

- [ ] **Step 5: Probar un "no" con motivo**

Descarta a otro con motivo "el cargo no encaja" y comprueba que el contador **no** baja y que el panel de aprendizaje registra el motivo.

- [ ] **Step 6: Informar de lo observado**

Deja escrito: `totalEntries` de la combinación probada, cuántos descartó el filtro local y por qué motivos, y si la ficha da información suficiente para decidir sin abrir LinkedIn. Eso último es lo que dirá si la fase B2 (memoria vectorial) hace falta tanto como parece.

---

## Fuera de alcance de esta fase

- La memoria vectorial (`pgvector` + Voyage) y la ordenación de la cola por afinidad: fase B2.
- El chat de investigación con búsqueda web: fase B3.
- Las reglas explícitas propuestas por el chat (`ProspectRule`): llegan con B3, porque hasta entonces nadie las propone.
- Cualquier automatización sobre un prospecto ya validado. Un "sí" produce una ficha con su enlace; lo que se haga con ella queda fuera del sistema.
