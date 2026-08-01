# Briefing diario de tareas de LinkedIn — Diseño

**Fecha:** 2026-07-26
**Estado:** Aprobado (pendiente de revisión de spec por el usuario)

## Contexto

El plan editorial de LinkedIn reparte 6 publicaciones semanales entre dos cuentas (perfil personal de José y página de Room714) para eliminar la duplicación de contenido. El reparto por slot ya está implementado: `linkedinSchedule.js` decide el canal de cada variante y el cron `/api/cron/publish-linkedin` lo envía en el campo `canal` del payload, que el Router de Make usa para elegir ruta.

Lo que el plan añade y todavía no existe es el **trabajo manual**: cada publicación de un canal lleva asociada una acción en el otro (comentar, recompartir), los posts que firma José deberían leerse antes de salir, y el enlace al artículo debe ir en el primer comentario, no en el cuerpo.

Infraestructura disponible:

- **Email:** Resend, con dos remitentes ya montados (`draftReady.js`, `candidateReady.js`).
- **Crons:** Vercel (`vercel.json`), autenticados con `Bearer CRON_SECRET`. Como Vercel programa en UTC, el patrón del repo es declarar dos entradas (una por horario de verano y otra por el de invierno) y descartar la sobrante dentro de la ruta con `isMadridHour(h)`.
- **Datos:** `LinkedInVariant` guarda `variant`, `angle`, `text`, `hashtags`, `scheduledFor`, `sent`, `sentAt` y la relación con `Post`.
- **Sin migraciones:** no hay carpeta `prisma/migrations`; el esquema se aplica con `prisma db push`.

## Objetivo

Un correo diario, a las 08:00 de Madrid y de lunes a viernes, con la lista cerrada de lo que José tiene que hacer ese día. Cada tarea debe poder ejecutarse **sin abrir nada más que el propio correo**: lleva el texto íntegro, los enlaces, la sugerencia de qué escribir y el recordatorio de la voz que toca.

## Fuera de alcance

- **Punto 2 del plan** (dos plantillas de voz en el generador) y **punto 5** (temas comerciales dos veces al mes). Son cambios del generador; van en sus propios specs.
- **Puerta de aprobación real.** La revisión del punto 4 es un aviso: si José no hace nada, el post sale igual a las 10:00. Decisión explícita para no poder perder slots por no leer un correo.
- **Pantalla de admin para editar variantes.** No existe hoy. Sin ella la revisión es de lectura; el correo enseña el texto pero no hay dónde cambiarlo.

## Decisiones de diseño

### 1. 08:00 de Madrid, no 07:00

El cron `generate` corre a las 07:00 Madrid los lunes y miércoles y crea el post **de ese mismo día**: `nextMadridSlot(10)` devuelve las 10:00 de la jornada en curso, y con él nacen sus tres variantes. Un briefing a las 07:00 competiría con esa generación (`maxDuration = 300`) precisamente los días de más tareas, y encontraría la tabla vacía.

A las 08:00 la generación ha terminado y quedan dos horas hasta la publicación, margen suficiente para la tarea de revisión.

Entradas en `vercel.json`: `0 6 * * 1-5` y `0 7 * * 1-5` (UTC), con `isMadridHour(8)` descartando la que no toque. Esto resuelve de paso la idempotencia: de las dos ejecuciones, solo una pasa el guard.

### 2. Una sola tabla de slots para canal y acción cruzada

La acción del otro canal tampoco es función del número de variante, así que vive donde ya vive el canal. `CHANNEL_BY_PUBLISH_WEEKDAY` pasa a `SLOTS_BY_PUBLISH_WEEKDAY`:

```js
const SLOTS_BY_PUBLISH_WEEKDAY = {
  Mon: [
    { canal: "personal", cross: "reshare_company" },
    { canal: "empresa",  cross: "comment_personal" },
    { canal: "empresa",  cross: null },
  ],
  Wed: [
    { canal: "personal", cross: null },
    { canal: "empresa",  cross: "comment_personal" },
    { canal: "personal", cross: "reshare_company" },
  ],
};
```

Que se corresponde con el plan slot a slot:

Ordenada como cae en la semana:

| Slot | Variante | Publica | El otro canal |
|---|---|---|---|
| L 10:00 | art. 1 · v1 | personal | Room714 recomparte |
| M 10:00 | art. 1 · v2 | empresa | José comenta |
| X 10:00 | art. 2 · v1 | personal | — |
| X 16:00 | art. 1 · v3 | empresa | — |
| J 10:00 | art. 2 · v2 | empresa | José comenta |
| V 16:00 | art. 2 · v3 | personal | Room714 recomparte |

Tres publicaciones por canal, como máximo una por canal y día.

`channelForVariant()` se mantiene como envoltorio de lectura sobre la tabla, porque `buildWebhookPayload` ya depende de ella. Se añaden `slotFor({ postPublishDate, variant })` y `crossActionsFor(postPublishDate)`.

El día de la semana se lee siempre con `getMadridWeekday()`, nunca con `getUTCDay()`: las fechas guardadas representan las 10:00 de Madrid y el día natural puede no coincidir.

Si un post cae en un día no previsto se aplica la fila del lunes, igual que hoy: perder el equilibrio de la semana es preferible a no publicar.

### 3. Enlaces que se resuelven al hacer clic

El correo sale a las 08:00 y las publicaciones son a las 10:00, así que cuando se compone el email la URL del post en LinkedIn todavía no existe. Enlazar directamente es imposible; enlazar solo al perfil obliga a buscar el post a mano.

Solución en dos piezas:

**a) Make devuelve la URL.** Al final de cada ruta del Router, un módulo HTTP llama a `POST /api/webhooks/linkedin-published` con el `variant_id` que venía en el payload del trigger y el identificador que devuelve el módulo de LinkedIn. Se guarda en `LinkedInVariant.linkedinPostUrl`.

**b) El correo enlaza a un redirector.** `GET /api/go/variant/[id]` responde `302` al post real si ya se conoce, y al perfil o a la página si aún no. El enlace del correo es estable desde las 08:00; al pincharlo después de las 10:00 cae en el post exacto.

Detalles que importan:

- La respuesta lleva `Cache-Control: no-store`. Sin eso, un cliente de correo que precargue el enlace a las 08:00 podría cachear el redirect al perfil y no llegar nunca al post.
- Es `302`, no `301`, por lo mismo.
- **El callback valida el host.** Solo se acepta y almacena una URL cuyo host sea `www.linkedin.com` o `linkedin.com`. Sin esta validación el redirector se convierte en un open redirect en un dominio de la empresa, que es material de phishing.
- La ruta es pública y sin sesión (se pincha desde el correo). No expone nada: el destino es una URL pública de LinkedIn.

### 4. La sugerencia de comentario se genera con el artículo delante

El correo debe traer escrita la idea del comentario o de la recompartición. La mejor toma la tiene el modelo cuando aún tiene el artículo completo en contexto, es decir en la generación de los lunes y miércoles, no a las 08:00 con solo el texto de la variante.

- Se añade `cross_note` a `linkedin_variants[]` en el esquema de herramienta de `generator.js`.
- `generatePostDraft` recibe `crossActions` (tres elementos, del orden de las variantes) y el prompt indica a cada variante qué papel le toca:
  - `comment_personal` → una o dos frases en primera persona que aporten un dato o un matiz que no esté en el post. Prohibido el elogio genérico.
  - `reshare_company` → la línea con la que la página recomparte el post de José, en voz corporativa, sin repetir su hook.
  - `null` → cadena vacía.
- El orquestador calcula `crossActionsFor(publishDate)` antes de llamar al generador y guarda el resultado en `LinkedInVariant.crossNote`.

Ventajas: no añade coste (va en la llamada que ya se hace), no mete una dependencia de AI en el cron de las 08:00, y su fallo es inocuo. Si el campo falta se guarda `null` y el correo omite esa línea; la generación no se rompe por ello.

**Limitación aceptada:** las variantes ya almacenadas no tienen `crossNote`. Los primeros correos saldrán sin sugerencia hasta la generación del lunes siguiente.

### 5. Anatomía del correo

Se construye a partir de tres consultas: variantes cuyo `scheduledFor` cae en el día natural de hoy en Madrid, variantes de ayer que siguen con `sent = false`, y el `Post` publicado hoy.

Cada variante de hoy genera tareas según su slot:

**Canal personal** (L, X, V)
- `review_own` — *antes* de la hora: texto íntegro, hashtags y recordatorio de voz José (primera persona, opinión con riesgo, sin el "nosotros" corporativo).
- `first_comment` — *después*: la URL del artículo, lista para copiar. Se omite si `FIRST_COMMENT_AUTOMATED` está a `"true"`, para el día en que Make lo publique solo.
- `reshare_company` si el slot lo pide (L, V) — *después*: `crossNote` copiable y enlace al post.

**Canal empresa** (M, X tarde, J)
- `comment_personal` si el slot lo pide (M, J) — *después*: `crossNote` copiable y enlace al post.

**Blog** (L, X): título, enlace público y enlace al admin del post que se publica hoy a las 10:00.

**Estado**: las variantes de ayer con `sent = false` se listan como incidencia. El motivo del fallo no se persiste hoy (el cron lo escribe en consola), así que el correo puede afirmar que algo no salió, pero no por qué.

Las tareas se ordenan por hora, y dentro de la misma hora las de *antes* preceden a las de *después*. Asunto: `Tus N tareas de LinkedIn — lunes 27`.

Boceto de un lunes:

```
HOY PUBLICAS TÚ · 10:00 · deriv. 1 de "Título del artículo"
 [ ] Revisa el texto — sale a tu nombre
     «texto íntegro de la variante»
     #Hashtag1 #Hashtag2 #Hashtag3
     Voz José: primera persona, opinión con riesgo. Sin "nosotros".
 [ ] Tras las 10:00 · enlace como primer comentario
     https://www.room714.com/es/blog/slug            [copiar]
 [ ] Tras las 10:00 · recompártelo desde la página Room714
     «línea sugerida para la recompartición»         [ir al post]

BLOG · artículo nuevo hoy a las 10:00
 [ ] "Título"                                  [ver] [editar]
```

Un martes se reduce a la tarea de comentar, con su sugerencia y su enlace.

Si no hay ninguna tarea (festivo, generación fallida) **no se envía correo**; la ruta lo registra y devuelve `sent: false`.

### 6. Modelo de datos

Dos columnas anulables en `LinkedInVariant`, en un solo `prisma db push`:

```prisma
linkedinPostUrl String?   // URL del post en LinkedIn, la devuelve Make
crossNote       String?   @db.Text  // sugerencia de comentario o recompartición
```

Ambas nulas para las filas existentes, sin efecto sobre el flujo actual.

### 7. Módulos y responsabilidades

| Fichero | Estado | Responsabilidad |
|---|---|---|
| `app/lib/time/linkedinSchedule.js` | modificado | Tabla de slots: canal + acción cruzada. Sin efectos. |
| `app/lib/linkedin/dailyTasks.js` | nuevo | `buildDailyTasks()`: variantes + post → lista de tareas. Función pura. |
| `app/lib/notifications/dailyBriefing.js` | nuevo | Render del HTML y envío por Resend. |
| `app/api/cron/daily-briefing/route.js` | nuevo | Auth, guard horario, consultas, orquestación, `?preview=1`. |
| `app/api/webhooks/linkedin-published/route.js` | nuevo | Callback de Make: valida y guarda `linkedinPostUrl`. |
| `app/api/go/variant/[id]/route.js` | nuevo | Redirección al post o al canal. |
| `app/lib/ai/generator.js` | modificado | Campo `cross_note` en el esquema y en el prompt. |
| `app/lib/ai/orchestrator.js` | modificado | Pasa `crossActions`, persiste `crossNote`. |

`buildDailyTasks` recibe datos ya consultados y devuelve estructuras, sin tocar BD ni red: es lo que permite cubrir los seis slots con tests rápidos.

Forma de una tarea:

```js
{
  id: "review-123",
  kind: "review_own" | "first_comment" | "reshare_company"
      | "comment_personal" | "blog_review" | "not_published",
  when: "before" | "after",      // respecto a la hora de publicación
  time: "10:00",
  channel: "personal" | "empresa" | null,
  title: "Revisa el texto — sale a tu nombre",
  text: "...",                   // texto íntegro, solo en review_own
  hashtags: ["#IA", "#UX"],
  voiceHint: "...",
  articleUrl: "https://...",
  suggestion: "...",             // crossNote, si existe
  linkUrl: "https://www.room714.com/api/go/variant/123",
}
```

### 8. Manejo de errores

- **Sin `RESEND_API_KEY`**: se registra y se devuelve `skipped`, como en `draftReady`.
- **Fallo de Resend**: se registra y la ruta devuelve error; el cron reintentará al día siguiente. No se reintenta dentro del mismo día para no duplicar correos.
- **Callback fallido o no configurado**: `linkedinPostUrl` queda nula y el redirector cae en el perfil o la página. Degradación, no fallo.
- **Callback con URL de otro host**: `400`, no se guarda nada.
- **Variante inexistente en el redirector**: `302` a la página de Room714.
- **`crossNote` ausente**: el correo omite la línea de sugerencia y mantiene la tarea.

### 9. Pruebas

Se incorpora **vitest** (dependencia de desarrollo), con `vitest.config.js` que replica el alias `@` a la raíz del proyecto y `"test": "vitest run"` en `package.json`. Entorno node, sin jsdom: lo que se prueba son funciones puras.

`app/lib/time/linkedinSchedule.test.js`
- Los seis slots del ciclo devuelven el canal y la acción cruzada de la tabla del plan.
- Reparto 3/3 entre canales en una semana completa.
- Post en día no previsto → fila del lunes.
- Un post de invierno (CET) y otro de verano (CEST) resuelven el mismo día de la semana.

`app/lib/linkedin/dailyTasks.test.js`
- Un caso por día laborable, comprobando el conjunto exacto de tareas.
- Miércoles: dos variantes el mismo día (10:00 personal y 16:00 empresa), ordenadas por hora y sin acción cruzada ninguna.
- Día sin variantes → lista vacía (el cron no enviará correo).
- Variante sin `crossNote` → la tarea existe, sin sugerencia.
- Variante de ayer con `sent = false` → tarea `not_published`.

Verificación manual, ya con todo desplegado: `GET /api/cron/daily-briefing?preview=1` con `Bearer CRON_SECRET` devuelve las tareas en JSON sin enviar nada.

### 10. Variables de entorno

| Variable | Uso |
|---|---|
| `MAKE_CALLBACK_SECRET` | Autentica el callback de Make. Nueva. |
| `LINKEDIN_PROFILE_URL` | Destino de respaldo del redirector para el canal personal. |
| `LINKEDIN_COMPANY_URL` | Ídem para el canal empresa. |
| `BRIEFING_EMAIL` | Destinatario. Por defecto, el de `DRAFT_REVIEW_EMAIL`. |
| `FIRST_COMMENT_AUTOMATED` | A `"true"` suprime la tarea del primer comentario, si Make acaba publicándolo solo. |

## Configuración en Make (fuera del repositorio)

1. Filtro en cada ruta del Router: `canal` igual a `personal` → *Create a User Image Post*; igual a `empresa` → *Create a Company Image Post*. (Ya acordado, pendiente de aplicar.)
2. Módulo HTTP al final de cada una de las dos rutas: `POST https://www.room714.com/api/webhooks/linkedin-published`, cabecera `Authorization: Bearer <MAKE_CALLBACK_SECRET>`, cuerpo `{ "variant_id": <del payload del trigger>, "post_urn": <id que devuelve el módulo de LinkedIn> }`.

## Contrato del callback

```
POST /api/webhooks/linkedin-published
Authorization: Bearer <MAKE_CALLBACK_SECRET>
Content-Type: application/json

{ "variant_id": 123, "post_urn": "urn:li:share:7123456789" }
```

Acepta `post_urn` o `post_url`. Con el URN construye `https://www.linkedin.com/feed/update/<urn>/`. Respuestas: `200 { ok, url }`, `400` (falta `variant_id`, faltan ambos identificadores, o host no permitido), `401` (secreto inválido), `404` (variante inexistente). Reenviar la misma variante sobrescribe el valor.

## Riesgos y limitaciones conocidas

- Las variantes ya generadas no tienen `crossNote`; los primeros correos irán sin sugerencia.
- No se persiste el motivo por el que una publicación falla, solo que no salió.
- Lunes y miércoles llegan dos correos: el de "post generado" a las 07:00 y este a las 08:00.
- El esquema se aplica con `prisma db push` contra la base de datos de producción. Son dos columnas anulables, pero conviene lanzarlo de forma deliberada.
- El correo depende de que el reparto real en LinkedIn coincida con la tabla de slots. Si algún día se cambian los filtros del Router en Make sin tocar el código, las tareas del correo apuntarán al canal equivocado.
