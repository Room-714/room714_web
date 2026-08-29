# Calendario de publicación: todo en la franja de las 7:30

Fecha: 2026-08-29
Estado: aprobado, pendiente de plan de implementación

## Problema

El calendario actual reparte el trabajo manual por todo el día y no deja una
franja limpia para trabajar:

- El artículo se genera a las 07:00 (lunes y miércoles) y se publica a las 10:00.
- Cada artículo produce **3 variantes** de LinkedIn repartidas en seis huecos
  semanales: L 10:00, M 10:00, X 16:00 para el primero; X 10:00, J 10:00,
  V 16:00 para el segundo.
- El cron `publish-linkedin` corre cada 10 minutos de 7 a 16 para atender esos
  huecos, así que puede salir algo prácticamente a cualquier hora.
- El briefing de tareas manuales llega a las 08:00, dos horas antes de la primera
  publicación.
- Las variantes se generan **a la vez que el artículo**, del borrador sin revisar.

Consecuencia: hay publicaciones a las 10:00 y a las 16:00, el briefing habla de
cosas que aún no existen y los textos de LinkedIn salen de un borrador que nadie
ha leído.

## Objetivo

Concentrar todo lo automático en la franja **07:30–08:00**, dejar el trabajo
manual a partir de las **08:00**, y que los textos de LinkedIn se escriban a
partir del artículo **ya revisado**.

## Decisiones tomadas

1. **Nada bloquea.** El artículo se publica a las 07:30 se revise o no. Si se
   detecta un error después, se corrige en el admin y listo. La revisión sirve
   para mejorar, no para autorizar.
2. **Cinco publicaciones de LinkedIn por semana**, de lunes a viernes.
3. **El post del viernes es una tercera toma del artículo del lunes**, no una
   pieza suelta. Esto evita hacer opcional `LinkedInVariant.postId` y ahorra una
   migración, un generador nuevo y una pantalla.
4. **Las tomas se generan después de la revisión**, a las 08:30 de lunes y
   miércoles, leyendo el artículo tal y como haya quedado en base de datos.
5. **Sin pantalla de aprobación** y sin campos de aprobación en la base de datos.

## El calendario (hora de Madrid)

| Día | 06:00 | 07:30–08:00 | 08:00–08:30 | 08:30 | 08:35–08:45 | 08:50 |
|---|---|---|---|---|---|---|
| **L** | genera artículo 1 | artículo 1 visible | revisión manual | genera 3 tomas del art.1 | sale toma 1 · personal | briefing |
| **M** | — | toma 2 art.1 · empresa | — | — | — | briefing |
| **X** | genera artículo 2 | artículo 2 visible | revisión manual | genera 2 tomas del art.2 | sale toma 1 · personal | briefing |
| **J** | — | toma 2 art.2 · empresa | — | — | — | briefing |
| **V** | — | toma 3 art.1 · personal | — | — | — | briefing |

Los lunes y miércoles la toma del día sale hacia las 8:40 y no en la franja de
las 7:30: no puede existir antes, porque se escribe a partir del artículo que se
acaba de revisar. Es la única excepción y es deliberada.

El correo de "borrador listo" que ya envía el orquestador (`sendDraftReadyEmail`)
sigue saliendo a las 06:00 y es el aviso de que hay artículo que revisar.

## Reparto de canal

Tres publicaciones desde el perfil personal, dos desde la página de empresa, y
exactamente una acción cruzada al día:

| Hueco | Canal | Acción cruzada |
|---|---|---|
| art.1 toma 1 (L) | personal | Room714 recomparte |
| art.1 toma 2 (M) | empresa | José comenta desde su perfil |
| art.2 toma 1 (X) | personal | Room714 recomparte |
| art.2 toma 2 (J) | empresa | José comenta desde su perfil |
| art.1 toma 3 (V) | personal | Room714 recomparte |

La toma 1 va siempre desde el perfil personal porque es la que anuncia y enlaza
el artículo. Esta tabla sustituye a la actual, que era asimétrica solo para
cuadrar seis huecos y ya no hace falta.

## Arquitectura

El cambio estructural es **separar la generación del artículo de la generación
de las tomas de LinkedIn**, que hoy salen de la misma llamada al modelo.

```
06:00 L/X   cron generate ──► generatePostDraft (solo artículo)
                              └─► Post + PostTranslation (es/en), date = 07:30
                              └─► correo "borrador listo"

07:30 L/X   cron publish ────► marca published_sent, avisa a Google Indexing API
                              (el artículo ya es visible: blog.js filtra date <= now)

08:00-08:30 revisión manual en /admin

08:30 L/X   cron generate-linkedin ─► lee el Post de hoy con su traducción es
                              └─► generateLinkedInTakes({ articulo, count, crossActions })
                              └─► imágenes Unsplash (una por toma, fallback = portada)
                              └─► LinkedInVariant × N con su scheduledFor

07:30-08:00 y 08:35-08:50   cron publish-linkedin ─► envía a Make las variantes
                              con scheduledFor <= now y sent = false

08:50 L-V   cron daily-briefing ─► correo con las acciones manuales del día
```

Cada pieza tiene una responsabilidad y se puede probar sola:

- `generatePostDraft` — entra categoría y tendencias, sale un artículo. Ya no
  sabe nada de LinkedIn.
- `generateLinkedInTakes` — entra un artículo en español y cuántas tomas hacen
  falta, salen N tomas con ángulo, texto, hashtags, consulta de imagen y nota
  cruzada. No toca base de datos.
- `linkedinSchedule` — funciones puras: cuándo sale cada toma y por qué canal.
- Los crones solo orquestan: leen, llaman y escriben.

## Cambios por fichero

### `app/lib/time/linkedinSchedule.js`

- `variantScheduleFor(postPublishDate, count)` pasa a aceptar el número de tomas
  y devuelve `count` fechas.
  - Toma 1: mismo día, base **08:35**, jitter `[0, +8]` minutos.
  - Toma 2: día siguiente, base **07:30**, jitter `[0, +28]`.
  - Toma 3 (solo el artículo del lunes): **+4 días** (viernes), base **07:30**,
    jitter `[0, +28]`.
- El jitter sigue siendo determinista (hash FNV-1a de la fecha del post y el
  número de toma). Cambian solo las ventanas, que ahora caben en la franja.
- `SLOTS_BY_PUBLISH_WEEKDAY` se sustituye por la tabla de reparto de arriba:
  `Mon` con tres huecos, `Wed` con dos.
- `crossActionsFor(postPublishDate)` devuelve tantas acciones como tomas tenga
  ese día (3 el lunes, 2 el miércoles), no siempre 3.

### `app/lib/time/madrid.js`

- `nextMadridSlot(targetHour, targetMinute = 0)`: se añade el minuto para poder
  pedir las 07:30. El bucle sigue recorriendo horas UTC y solo cambia el
  `setUTCHours(utcHour, targetMinute, 0, 0)`; los desfases de Madrid son de hora
  entera, así que la comprobación de hora sigue siendo válida.

### `app/lib/ai/generator.js`

- `linkedin_variants` sale del esquema, de la validación y del prompt de
  `generatePostDraft`.
- Se añade `generateLinkedInTakes({ articleTitle, articleContent, articleUrl, count, crossActions })`,
  con su propio esquema: `takes[]` con `angle`, `text`, `hashtags`, `image_query`
  y `cross_note`. Valida que vengan exactamente `count`.
- Al quedarse el artículo solo, el presupuesto de tokens de salida se puede
  revisar a la baja; hoy está en 32k porque tenía que caber todo junto.

### `app/lib/ai/orchestrator.js`

- `PUBLISH_HOUR_MADRID` pasa de 10 a 7 y la fecha de publicación se calcula con
  `nextMadridSlot(7, 30)`.
- Desaparece todo el bloque de variantes: imágenes de variante, `variantSchedules`
  y el `linkedinVariants.create`. El orquestador crea el `Post` y sus traducciones,
  hace backlinks y enlaces internos, y manda el correo de borrador listo.
- Se añade `generateTakesForToday()`: busca el post AUTO publicado hoy, calcula
  cuántas tomas tocan según el día, llama al generador, resuelve las imágenes
  (con la portada como fallback, igual que hoy) y crea las `LinkedInVariant`.

### `app/api/cron/generate/route.js`

- `TARGET_HOUR` pasa de 7 a 6.

### `app/api/cron/generate-linkedin/route.js` (nuevo)

- Autenticación por `Bearer CRON_SECRET`, como el resto.
- Guarda `isMadridHour(8)` y día laborable lunes o miércoles.
- `?preview=1` que devuelve las tomas en JSON sin escribir ni gastar imágenes,
  siguiendo la convención de los otros crones.
- Idempotente: si el post de hoy ya tiene variantes, no hace nada.
- `maxDuration = 300`.

### `app/api/cron/publish/route.js`

- `SOURCE_BY_HOUR` pasa de `{10: "AUTO", 17: "MANUAL"}` a `{7: "AUTO", 17: "MANUAL"}`.
  Los posts manuales se quedan donde están: no forman parte de este cambio.

### `app/lib/linkedin/dailyTasks.js`

- La tarea `review_own` ("revisa el texto que sale a tu nombre", `when: "before"`)
  desaparece: el briefing llega cuando la publicación ya ha salido.
- **No se añade una tarea de "revisa el artículo"**: el briefing sale a las 08:50
  y la revisión es de 08:00 a 08:30, así que llegaría tarde. El aviso de que hay
  artículo que revisar es el correo de borrador listo de las 06:00.
- El resto (primer comentario, recompartir, comentar desde el perfil, aviso del
  artículo nuevo, incidencias de ayer) se mantiene tal cual. La línea con la cola
  de prospectos la añade la spec de prospección, no esta.

### `app/api/cron/daily-briefing/route.js`

- Sin cambios de lógica: sigue leyendo las variantes cuyo `scheduledFor` cae hoy.
  Solo cambia la hora a la que se dispara.

### `vercel.json`

Vercel programa en UTC y Madrid cambia de desfase dos veces al año, así que cada
horario lleva dos entradas y el guard de hora Madrid descarta la que no toca.

| Ruta | Madrid | UTC (invierno / verano) | Días |
|---|---|---|---|
| `/api/cron/generate` | 06:00 | `0 5` / `0 4` | L, X |
| `/api/cron/publish` | 07:30 | `30 6` / `30 5` | L-V |
| `/api/cron/publish` | 17:00 | `0 16` / `0 15` | L-V |
| `/api/cron/generate-linkedin` | 08:30 | `30 7` / `30 6` | L, X |
| `/api/cron/publish-linkedin` | 07:30–08:50 | `*/5 5-7` | L-V |
| `/api/cron/daily-briefing` | 08:50 | `50 7` / `50 6` | L-V |
| `/api/cron/cleanup-candidates` | 03:00 | `0 3` | diario |

`publish-linkedin` cubre las dos ventanas del día con una sola entrada de cada
cinco minutos entre las 05:00 y las 07:55 UTC. Son 36 ejecuciones diarias en vez
de las 60 actuales, y las que caen fuera de ventana no encuentran nada que
publicar y salen enseguida.

## Casos límite

- **La generación del artículo falla.** No hay post hoy. `generate-linkedin`
  no encuentra nada y sale sin error; el briefing lo refleja como incidencia.
  El calendario de la semana se resiente pero nada revienta.
- **El cron de tomas se ejecuta dos veces.** La segunda encuentra variantes ya
  creadas y sale sin escribir.
- **La revisión se hace después de las 08:30.** Las tomas ya salieron del texto
  anterior. Es el precio aceptado de que nada bloquee.
- **Falla la imagen de una toma.** Se usa la portada del artículo, como hoy.
- **Cambio de hora.** Las dos entradas por horario y el guard de hora Madrid
  resuelven el desfase; es el mismo patrón que ya usa el proyecto.
- **Festivo.** No hay lógica de festivos hoy y no se añade: publicar en festivo
  es preferible a callar por error.

## Pruebas

Unitarias (vitest, sin base de datos ni red), en el estilo de las que ya hay:

- `linkedinSchedule.test.js` — las cinco fechas de la semana caen donde deben,
  el jitter no se sale de la franja, la tabla de canales da 3 personal / 2 empresa,
  `crossActionsFor` devuelve 3 el lunes y 2 el miércoles, y el jitter sigue siendo
  determinista para la misma entrada.
- `madrid.test.js` — `nextMadridSlot(7, 30)` en invierno y en verano.
- `generator.test.js` — `generatePostDraft` ya no exige variantes;
  `generateLinkedInTakes` valida que vengan exactamente `count`.
- `dailyTasks.test.js` — se actualizan los seis casos actuales a los cinco huecos
  nuevos y se añade la tarea de revisión de artículo.

Manual, antes de tocar producción:

- `GET /api/cron/generate-linkedin?preview=1` con el post de un lunes real,
  comprobando que salen 3 tomas y sus fechas.
- `GET /api/cron/daily-briefing?preview=1` cada día de una semana simulada.

## Fuera de alcance

- Los posts manuales (`source: MANUAL`) siguen publicándose a las 17:00.
- No se toca el flujo de Make ni el webhook de publicación.
- No hay pantalla de aprobación ni campos de aprobación en base de datos.
- No se añade calendario de festivos.
