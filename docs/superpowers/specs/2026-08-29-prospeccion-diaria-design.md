# Prospección diaria: decidir antes de pagar, y recordar lo decidido

Fecha: 2026-08-29
Estado: aprobado, pendiente de plan de implementación

## Problema

La prospección actual no está funcionando, y no por un fallo suelto sino por el
orden de las operaciones:

- **Se paga antes de mirar.** El cron semanal `discover-prospects` enriquece
  hasta 10 personas de golpe los lunes (1 crédito cada una) y las da de alta como
  prospectos sin que nadie las haya visto. De 60 créditos al mes, la mayoría se
  gastan en gente que se descarta después.
- **El filtro es grueso.** La consulta de Apollo filtra por cargo, antigüedad,
  país y plantilla, y nada más. Lo que llega no se puede afinar salvo editando
  `ProspectingProfile.js` a mano.
- **Nada aprende.** Descartar a alguien no deja rastro que cambie la siguiente
  búsqueda. Mañana vuelve a llegar lo mismo.
- **Las tareas diarias no se hacen.** El briefing pide comentar el post de un
  prospecto y buscar referencias en LinkedIn. Son dos tareas al día que llevan
  meses sin producir resultado.

## Objetivo

Reducir todas las acciones diarias de prospección a dos: **revisar la cola del
día** y **darle feedback a la búsqueda**. Que cada crédito de Apollo se gaste en
alguien ya validado. Y que el contexto comercial de Room714 se consolide con cada
decisión, en vez de evaporarse.

## Decisiones tomadas

1. **Buscar es gratis, enriquecer cuesta.** La cola diaria son 20 candidatos sin
   enriquecer. El crédito se gasta solo al decir que sí.
2. **20 al día**, no 4 o 5: como no cuestan nada, el cuello de botella es el
   presupuesto de créditos, no el de candidatos.
3. **Feedback con motivo de un clic y nota libre.** Los motivos ajustan la
   búsqueda de forma determinista; la nota queda para lo que no cabe en la lista.
4. **La memoria va en base vectorial**, para que el aprendizaje generalice y no
   dependa de coincidencias literales. No hace falta contratar nada: la base
   actual (Prisma Postgres, PostgreSQL 17.2) tiene la extensión `vector` 0.8.1
   disponible sin instalar — comprobado contra la base de producción.
5. **Chat abierto por candidato**, con acceso a búsqueda web, para investigar
   antes de decidir. Lo que salga de ahí puede convertirse en regla, pero solo
   si se acepta explícitamente.
6. **Se borra lo que no se usa**: público "referencia", redactor de comentarios,
   historial de interacciones y las tareas diarias de comentar.

## El ciclo diario

```
06:00 L-V   cron prospect-queue
            └─► construye la consulta: perfil + reglas derivadas + reglas explícitas
            └─► busca en Apollo paginando hasta reunir 20 caras nuevas   [0 créditos]
            └─► filtra en local (patrones de empresa, duplicados de empresa, reglas)
            └─► ordena por parecido con decisiones pasadas (memoria vectorial)
            └─► deja 20 filas en la cola con decision = "pending"

08:50       el briefing del día incluye una línea: "cola de hoy · 20 pendientes"

cuando toque  /admin/prospects
            ├─► contador del ciclo: gastados, restantes, días hasta renovar
            ├─► 20 fichas ordenadas, cada una con por qué salió y a qué se parece
            ├─► chat por ficha: investigar antes de decidir            [Opus 5 + web]
            ├─► "Sí"  → enriquece                                       [1 crédito]
            │           → crea Prospect con URL de LinkedIn
            │           → guarda la decisión en la memoria
            └─► "No"  → motivo obligatorio + nota opcional             [0 créditos]
                        → guarda la decisión en la memoria
```

Si un día no se revisa la cola, el cron **no acumula**: si ya hay 20 pendientes,
no añade más. La cola es una cola, no un vertedero.

## Modelo de datos

### `ProspectDiscovery` (ampliado)

Deja de ser el registro de lo enriquecido y pasa a ser el de **todo el que hemos
visto**. Es la pieza central: la cola, el historial y el contador salen de aquí.

| Campo | Tipo | Nota |
|---|---|---|
| `apolloId` | `String @unique` | ya existe |
| `name`, `title`, `company` | `String?` | ya existen |
| `sectorQuery` | `String?` | nuevo: el sector de la consulta que lo trajo |
| `sizeQuery` | `String?` | nuevo: el tramo de plantilla de esa consulta (`"51,100"` / `"101,250"`) |
| `linkedinUrl` | `String?` | ya existe; solo se rellena al enriquecer |
| `shownOn` | `DateTime?` | nuevo: día en que entró en la cola |
| `decision` | `String @default("pending")` | nuevo: `pending` / `yes` / `no` |
| `decidedAt` | `DateTime?` | nuevo |
| `reasonCode` | `String?` | nuevo: `role` / `sector` / `size` / `in_house_team` / `other` |
| `note` | `String? @db.Text` | nuevo |
| `enrichedAt` | `DateTime?` | nuevo: `null` = nunca gastó crédito |
| `imported` | `Boolean` | ya existe |

Índices nuevos: `[decision, shownOn]` para la cola, `[enrichedAt]` para el contador.

**Migración de datos**: las filas actuales se crearon todas al enriquecer, así que
se rellena `enrichedAt = createdAt`. Sin eso, el contador del primer ciclo diría
cero. Para `decision` se pone `imported ? "yes" : "no"` con `reasonCode = "legacy"`:
las no importadas se descartaron por motivos técnicos (Apollo no devolvió URL de
LinkedIn), no porque nadie las rechazara, y `legacy` las mantiene fuera de las
reglas derivadas, que solo cuentan los cuatro motivos reales.

### `ProspectMemory` (nueva)

La memoria vectorial. Guarda documentos de distinto tipo en la misma tabla para
que la búsqueda por parecido los recorra todos.

| Campo | Tipo | Nota |
|---|---|---|
| `kind` | `String` | `decision` / `criterio` / `room714` / `conclusion` |
| `sourceId` | `String?` | `apolloId`, id de conversación… |
| `text` | `String @db.Text` | el texto que se embebió, legible |
| `metadata` | `Json` | decisión, motivo, cargo, sector, plantilla |
| `embedding` | `Unsupported("vector(1024)")` | Voyage `voyage-4-lite` |

Prisma no tiene tipo nativo para `vector`, así que la columna se declara
`Unsupported(...)` y las escrituras y las consultas de vecindad van por
`$queryRaw` con el operador `<=>` (distancia coseno). El índice HNSW se crea en la
propia migración:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX prospect_memory_embedding_idx
  ON "ProspectMemory" USING hnsw (embedding vector_cosine_ops);
```

### `ProspectRule` (nueva)

Reglas **explícitas**: las que propone el chat y se aceptan a mano. Las reglas
derivadas de contar decisiones no se guardan (ver más abajo).

| Campo | Tipo | Nota |
|---|---|---|
| `kind` | `String` | `exclude_title` / `exclude_sector` / `exclude_size` / `note` |
| `value` | `String` | el cargo, sector o tramo afectado |
| `origin` | `String` | `chat` / `manual` |
| `rationale` | `String? @db.Text` | por qué se creó, en una línea |
| `active` | `Boolean @default(true)` | desactivar en vez de borrar |

### `ProspectChat` (nueva)

| Campo | Tipo | Nota |
|---|---|---|
| `apolloId` | `String?` | `null` = conversación general sobre la búsqueda |
| `messages` | `Json` | historial completo, para poder releerlo |
| `summary` | `String? @db.Text` | la conclusión en una línea, lo que entra en la memoria |

### `Prospect` (simplificado)

Se queda con lo que sigue teniendo sentido: `name`, `company`, `role`,
`linkedinUrl`, `sector`, `notes`, `status`, `apolloId`, `source`.

Se eliminan `kind`, `keywords`, `interest`, `lastEngagedAt`, `lastTouchedAt` y
`skipCount`: todos existían para la rotación de comentarios diarios, que
desaparece. Del enum `ProspectStatus` se elimina `PAUSED` por el mismo motivo
(comprobando antes que ninguna fila lo use).

### `ProspectEngagement`

Se elimina la tabla y su historial.

## Capa dura: reglas

Funcionan desde el primer día, cuando todavía no hay nada que recordar. Son
deterministas, auditables y reversibles.

**Reglas derivadas** — se calculan contando decisiones, no se almacenan. Si se
cambia de opinión sobre un descarte, la regla desaparece sola.

| Señal | Efecto |
|---|---|
| mismo cargo con ≥3 descartes por `role` **y ninguna aceptación** | ese cargo sale de `person_titles` y se filtra en local |
| tramo de plantilla con ≥5 descartes por `size` **y ninguna aceptación** | ese tramo sale de `organization_num_employees_ranges` |
| sectores | se ordenan por tasa de aceptación suavizada, y ese orden **se enseña en el panel**; la rotación en sí es fija |
| ≥3 descartes por `in_house_team` en un sector | cuentan como fallos de ese sector y lo bajan en esa ordenación |

**Dos correcciones sobre una versión anterior de esta tabla**, las dos por el mismo motivo de fondo: un umbral que solo cuenta fallos, sin denominador y sin ventana, es un trinquete.

La primera es la guarda de "ninguna aceptación" en los cargos. La versión anterior excluía un cargo con tres descartes a secas, y como los contadores solo crecen, eso condena a cualquier cargo con tasa de rechazo mayor que cero: un cargo bueno rechazado 1 de cada 10 veces tiene un 59% de quedar excluido en tres semanas y un 95% en seis. Lo que evita el trinquete no es el número 3, es exigir que el cargo no haya funcionado **nunca**.

La segunda es que **la rotación de sectores no se pondera por tasa de acierto**, al revés de lo que decía. La rotación recorre las 14 combinaciones de sector y tramo en ciclo fijo, y eso es deliberado: garantiza que todos se sigan muestreando. Ponderar por tasa reintroduce el mismo trinquete a otra escala — un sector con una mala racha temprana dejaría de muestrearse y no podría demostrar nunca que era bueno. La tasa se calcula, se suaviza (Laplace, para que una muestra de uno no adelante a una de cincuenta) y **se enseña**, para que la decisión de estrechar el perfil la tome una persona mirando los números. Ponderar la rotación con un suelo garantizado por combinación es candidato para más adelante, no para esta fase.

**Reglas explícitas** — las de `ProspectRule`, aceptadas una a una.

Ambas se mezclan en `buildApolloQuery(profile, { rules })`, que sigue siendo una
función pura y cubierta por tests: entra el perfil y las reglas, sale la consulta.

## Capa blanda: memoria vectorial

**Qué se guarda.** Cada decisión, como texto legible más metadatos:

> «Director de Operaciones · Envases Ruiz SL · buscado como industria y
> fabricación, 51-100 empleados · DESCARTADO por sector»

El texto que se embebe es el mismo que se ve en la ficha, con la decisión al
final. No lleva sector ni plantilla reales porque no los tenemos (ver
*Verificaciones hechas*), pero sí el nombre de la empresa, que es lo que más
señal semántica aporta: «Envases Ruiz SL» dice más de a qué se dedican que la
etiqueta de sector con la que los buscamos.

Además, un documento corto de contexto comercial de Room714 (qué vende y a quién)
y las conclusiones de las conversaciones del chat.

**Para qué sirve.** Cada mañana, cada candidato nuevo se embebe y se buscan sus
vecinos más cercanos entre las decisiones pasadas. De ahí salen dos cosas:

1. **El orden de la cola.** Primero los que se parecen a lo aceptado.
2. **La explicación en la ficha**: «se parece a Industrias Ruiz, que aceptaste» o
   «se parece a tres que descartaste por sector». Se puede discrepar con
   conocimiento, y esa discrepancia también se aprende.

Esto es lo que las reglas no pueden hacer: una lista de cargos excluidos no sabe
que "Responsable de Aprovisionamiento" se parece a "Director de Compras". Por eso
van las dos capas.

**Proveedor.** Anthropic no ofrece API de embeddings y recomienda Voyage AI
(verificado en su documentación). Se usa `voyage-4-lite`, 1024 dimensiones,
`input_type: "document"` al guardar y `"query"` al buscar, por HTTP directo desde
`app/lib/prospecting/embeddings.js`. **Requiere `VOYAGE_API_KEY`**, que es la
única alta externa de todo este diseño.

**Arranque en frío, dicho claro.** Las primeras dos o tres semanas la capa
vectorial no aporta casi nada: no hay decisiones que recordar. Quien trabaja desde
el primer día es la capa de reglas. La memoria empieza a notarse hacia las 50
decisiones.

## El chat de investigación

Vive en cada ficha, y también suelto para hablar de la búsqueda en general.

- **Modelo**: `claude-opus-5` con `thinking: {type: "adaptive"}`, en streaming.
- **Herramienta**: `web_search_20260209` con `max_uses` acotado por conversación,
  para que el gasto sea previsible.
- **Contexto**: la ficha de Apollo, los vecinos más parecidos de la memoria con lo
  que se decidió y por qué, el documento de criterio comercial de Room714 y las
  reglas activas.
- **Disciplina de respuesta**: cita las fuentes y separa lo verificado de lo
  supuesto. La instrucción del sistema es explícita en que no dé por bueno lo que
  no ha comprobado.

**Cómo se cierra el bucle.** Al decidir, la conversación no entra en crudo en la
memoria — sería ruido. Se guarda su **conclusión en una línea**, con enlace a la
conversación entera. Y si de la conversación sale algo que cambiaría la búsqueda
("no me traigas clínicas de menos de 80 empleados"), el chat **lo propone como
regla** y hay que aceptarla; nunca se aplica sola. La regla aparece en el panel
de aprendizaje con su origen y su porqué.

Ese es el límite que mantiene el sistema auditable: la conversación es libre, el
efecto sobre la búsqueda es siempre explícito.

**Coste**: del orden de 10 a 30 céntimos por prospecto investigado a fondo,
contando el modelo y las búsquedas web. Los embeddings, unos 18.000 tokens al mes:
céntimos.

## El contador de créditos

Hoy el gasto se aproxima con una ventana móvil de 30 días. Se pasa al ciclo real
de facturación, que renueva el día 16:

```
cycleStart  = último día 16 a las 00:00 de Madrid, anterior o igual a hoy
spent       = ProspectDiscovery con enrichedAt >= cycleStart
remaining   = APOLLO_MONTHLY_ENRICH_CAP - spent
nextReset   = próximo día 16
```

En pantalla:

> **43 de 60 créditos · renueva el 16 de septiembre, dentro de 9 días · 4,7 al día
> si te los quieres gastar todos**

Cuando `remaining` llega a cero, el botón "Sí" se bloquea con el motivo visible,
en vez de fallar contra la API. El día de renovación es configurable
(`APOLLO_CYCLE_RESET_DAY`, por defecto 16) por si Apollo cambia el ciclo.

## La pantalla `/admin/prospects`

Tres zonas:

1. **Cabecera** — el contador del ciclo y cuántas decisiones llevas hoy.
2. **La cola** — 20 fichas ordenadas por afinidad. Cada una muestra el cargo, el
   nombre de la empresa y **con qué criterio se buscó** (sector y tramo de
   plantilla de la consulta que la trajo), más a qué se parece. Sector y plantilla
   reales no se pueden mostrar: la búsqueda de Apollo no los devuelve y
   conseguirlos costaría un crédito por ficha. Botones **Sí** (con el coste en
   crédito escrito) y **No** (que despliega los cinco motivos y el campo de nota).
   Y el chat, plegado, en la propia ficha.
3. **Panel "Lo que ha aprendido el filtro"**, plegado — cargos excluidos con su
   cuenta, sectores ordenados por acierto, tramos de plantilla descartados, reglas
   explícitas con su origen, y las notas libres en orden cronológico.

En pestaña aparte, la **lista de validados**: nombre, empresa, cargo, enlace a
LinkedIn y notas. Es el resultado del sistema.

## Qué se borra

- `REFERENCE_PROFILE`, el campo `kind` y `TASKS_PER_KIND` de `ProspectingProfile.js`
- `app/lib/linkedin/prospecting.js` entero y su test
- `app/api/admin/prospects/draft-comment/route.js` (redactor de comentarios con IA)
- El modelo `ProspectEngagement` y su historial
- Las acciones `registerEngagement` y `skipProspect`
- Las funciones `interestFor` y `keywordsFor` de `prospectFields.js` (se queda
  `normalizeLinkedInProfileUrl`, que sigue haciendo falta)
- La sección de prospección del briefing en `daily-briefing/route.js`, sustituida
  por una línea con el enlace a la cola
- El cron semanal `discover-prospects`, sustituido por `prospect-queue` diario

## Verificaciones hechas (2026-08-29)

Las tres cuestiones que quedaban abiertas, ya resueltas contra la documentación
de Apollo y contra la base de datos de producción. Dos de las respuestas
cambiaron el diseño.

**1. Qué devuelve `mixed_people/api_search` por persona.** Menos de lo que
esperábamos. Por persona: `id`, `first_name`, `last_name_obfuscated`, `title`,
`last_refreshed_at` y banderas `has_email` / `has_city` / `has_direct_phone`.
Y dentro de `organization`, **solo `name` y banderas booleanas**
(`has_industry`, `has_employee_count`, `has_revenue`…): **nunca el sector ni la
plantilla**.

Y `pagination.total_entries` **viene vacío**: la documentación lo describe, pero
en producción llega a cero y se propaga como `null`. Confirmado con una llamada
real el 2026-08-29. Consecuencia práctica: **no hay forma de medir el tamaño del
pozo de una combinación por adelantado**. Lo único que se puede observar es
cuántas caras nuevas devuelve cada ejecución y si `exhausted` empieza a salir a
`true`, que es una señal a posteriori y lenta. Si un día hace falta saber si el
perfil se está quedando corto, habrá que medirlo contando descartes por "ya
estaba en el historial" a lo largo de varias semanas, no preguntándoselo a
Apollo.

**2. Si el enriquecimiento de empresa es gratis.** No lo es. Enriquecer una
organización cuesta **1 crédito**, lo mismo que enriquecer a la persona, y la
búsqueda de organizaciones **1 crédito por página**. La búsqueda de personas sí
es gratis, que es lo que sostiene todo el diseño.

**Consecuencia**: la ficha se construye con **lo que preguntamos**, no con lo que
responde. Cada candidato se guarda etiquetado con los parámetros de la consulta
que lo trajo, y eso obliga a consultar **un tramo de plantilla cada vez** (51-100
o 101-250) igual que ya se hace con el sector. Sin eso no sabríamos en qué tramo
cae nadie y el motivo "el tamaño no encaja" no tendría a qué apuntar.

**3. Cuánto pozo hay.** 20 al día son 440 caras al mes. Con España, un sector y
un tramo de plantilla, ese pozo se agota. La búsqueda debe recordar por qué
página va cada combinación de sector y tramo, y saltar a la siguiente cuando deje
de dar caras nuevas. Partir el rango en dos tramos duplica las combinaciones
(7 sectores × 2 tramos = 14), lo que además reparte mejor el agotamiento.

**Estado de la base al empezar** (producción, 2026-08-29): 10 `Prospect`, todos
`buyer` y de Apollo; 48 `ProspectDiscovery`, de los que 26 se descartaron sin
URL de LinkedIn utilizable.

Ojo con ese 26: **no es evidencia de un problema vigente**. Lo causó un bug de
validación ya corregido (Apollo devuelve los perfiles en `http` y la validación
exigía `https`, así que los rechazaba todos), documentado en el comentario de
`normalizeLinkedInProfileUrl`. Sirve como recordatorio de qué cuesta pagar antes
de mirar —26 créditos irrecuperables por un error de una línea— pero no como
medida de la tasa de descarte actual, que se desconoce.

Y **0 `ProspectEngagement`**: la parte de comentar publicaciones no se ha usado ni
una sola vez desde que existe. Eliminarla no pierde ningún historial, y es el
dato más claro de que el flujo diario no estaba funcionando.

**Pendiente de ti**: `APOLLO_API_KEY` no está en `.env.local` (sí en Vercel, que
es donde corre el cron). Hace falta en local para verificar la cola antes de
desplegar.

## Riesgos

- **El pozo se seca.** Mitigado con la paginación por sector y la rotación por
  tasa de acierto. Si aun así se agota, la palanca siguiente es ampliar el rango
  de plantilla o el ámbito geográfico, y eso se decide con datos, no antes.
- **El feedback se sobreajusta.** Tres descartes bastan para excluir un cargo, lo
  que puede ser precipitado. Por eso las reglas derivadas no se almacenan: basta
  cambiar una decisión para que la regla desaparezca, y el panel enseña siempre
  qué está excluido y por qué.
- **Dependencia nueva (Voyage).** Si falla o no está la clave, la cola sigue
  funcionando sin ordenar y sin explicación de parecidos. La capa vectorial se
  degrada, no rompe.
- **Gasto del chat.** Acotado por `max_uses` de búsqueda web y por ser una acción
  manual: no hay bucle automático que lo dispare.

## Pruebas

Unitarias, sin base de datos ni red:

- `buildApolloQuery` con reglas derivadas y explícitas: excluye lo que debe y
  respeta el perfil en lo demás.
- Derivación de reglas a partir de un conjunto de decisiones: umbrales de 3 y 5,
  ordenación de sectores por tasa de acierto.
- Filtro local de candidatos: patrones de empresa, duplicados por empresa.
- Cálculo del ciclo de créditos: inicio de ciclo, restantes y días hasta renovar,
  probado a caballo entre meses y en el propio día 16.
- Construcción del contexto del chat: que incluye ficha, vecinos y reglas activas.

Con base de datos, en local:

- `prospect-queue` en modo preview: no escribe, no gasta créditos, y devuelve los
  20 que dejaría.
- Alta y consulta de vecinos en `ProspectMemory` con vectores de prueba.

## Fases

Cada fase es entregable por sí sola.

- **B1 — La cola.** Cron diario, modelo de datos ampliado, reglas derivadas,
  contador de ciclo real, pantalla de triaje, y borrado de lo que sobra. Sin
  embeddings y sin chat: ya resuelve lo de pagar antes de mirar.
- **B2 — La memoria.** pgvector, Voyage, ordenación de la cola por afinidad y
  explicación de parecidos en la ficha.
- **B3 — El chat.** Conversación por candidato con búsqueda web, conclusión a la
  memoria y propuesta de reglas.

## Fuera de alcance

- Embeber el corpus del blog para sugerir por qué artículo entrar a cada empresa.
  La tabla `ProspectMemory` ya nace preparada, pero no entra en esta entrega.
- Automatizar cualquier acción sobre el prospecto una vez validado (conectar,
  escribir, comentar). Un "sí" produce una ficha con su enlace, y lo que se haga
  con ella queda fuera del sistema.
- Recuperar el historial de `ProspectEngagement`: se elimina.
