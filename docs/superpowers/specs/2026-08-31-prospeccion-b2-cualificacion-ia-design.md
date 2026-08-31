# Prospección B2: cualificar barato, profundizar a demanda, y que la búsqueda mejore sola

Fecha: 2026-08-31
Estado: pendiente de aprobación
Sustituye a: las fases B2 (memoria vectorial) y B3 (chat) del spec
`2026-08-29-prospeccion-diaria-design.md`, recuperando de allí la memoria
vectorial con un propósito distinto y más concreto.

## De dónde venimos

La fase B1 está en producción y funciona: el cron `prospect-queue` busca en
Apollo cada mañana (gratis), deja 20 fichas sin enriquecer, y el crédito se gasta
solo al decir que sí. Pero la ficha no dice nada de la empresa —cargo y nombre de
compañía, y el sector y el tramo con los que se buscó, que ni siquiera son datos
verificados— y el perfil de comprador se ha estrechado a cuatro condiciones
concretas:

1. **Factura entre 50 y 100 M€.**
2. **No hace producto digital, pero lo necesita para funcionar**: un e-commerce,
   un ERP, un SaaS que entrega a sus clientes.
3. **Tiene equipo de IT propio, pero muy pequeño y orientado a tareas
   operativas.**
4. **Necesita orientación y/o soporte IT en sentido amplio**, no soporte al
   puesto de trabajo.

Ninguna de las cuatro se puede filtrar en Apollo.

## Las verificaciones que ordenan el diseño (2026-08-31)

**1. `revenue_range` está bloqueado en el plan gratuito de Apollo.** Enviado como
objeto, 422: `"Cannot access advanced filters revenue_range on free plan"`.

**2. Y la variante con corchetes es un filtro fantasma.** Enviado como
`revenue_range[min]` / `revenue_range[max]`, la API responde **200 y devuelve
exactamente los mismos resultados que sin el filtro** — misma primera persona,
mismo orden. No filtra y no avisa. **No debe aparecer en la consulta bajo ninguna
forma.**

**3. La búsqueda sigue sin devolver datos de empresa**: dentro de `organization`
llegan `name` y banderas booleanas (`has_revenue`, `has_employee_count`,
`has_industry`), nunca el valor.

**4. `pgvector` está disponible.** `pg_available_extensions` devuelve `vector`
**0.8.1** con `installed_version: null` sobre PostgreSQL 17.2. Hay que crear la
extensión, pero no hay que contratar nada.

**5. Los embeddings salen gratis.** Voyage `voyage-4-lite` cuesta 0,02 $ por
millón de tokens **con los primeros 200 millones gratis**. A nuestro volumen
—unos 125 candidatos al día a ~20 tokens cada uno— son 900k tokens al año: nunca
saldremos del tramo gratuito.

**6. El corpus de decisiones está prácticamente vacío.** En producción hay 68
`ProspectDiscovery`: 16 pendientes, 48 con `reasonCode = "legacy"` (las que puso
la migración de B1, que nadie decidió) y **4 decisiones humanas reales**. Solo 4
filas tienen nota escrita. La memoria arranca de cero, y el diseño tiene que
sostenerse el primer día igual que el día cien.

## Las tres capas, y qué hace cada una

El sistema tiene que resolver dos problemas que se confunden con facilidad: qué
**sabemos** de cada empresa, y a quién **merece la pena mirar**. Son cosas
distintas y se atacan con herramientas distintas.

| Capa | Qué resuelve | Cuándo actúa | Coste |
|---|---|---|---|
| **Memoria vectorial** | a quién mirar primero, y con qué ejemplos juzgarlo | antes de gastar nada | ~0 (tramo gratuito) |
| **Vistazo (Haiku)** | una primera lectura de los 4 criterios | automático, en el cron | ~0,04 $/empresa medido |
| **Análisis a fondo y chat (Opus 5)** | resolver las dudas de una ficha concreta | cuando tú lo pides | ~0,33 $ / 0,05-0,15 $ |

La memoria va **delante** de todo lo que cuesta dinero. Ese es su trabajo
principal y la razón de que entre en esta fase: no es un adorno de precisión, es
lo que hace que cada día haga falta gastar menos para llenar la cola.

## Decisiones tomadas

1. **5 fichas al día, no 20.** La revisión pasa a ser lenta y con criterio.
2. **La cola trae siempre 5.** Si los candidatos no pasan, se sigue buscando y
   mirando hasta llenarla.
3. **El vistazo del cron es barato y poco exhaustivo, a propósito.** Su trabajo no
   es acertar, es no dejar pasar lo que claramente no encaja. Se equivocará por el
   lado de la duda, y eso está bien.
4. **La profundidad es a demanda**, con el coste escrito en el botón.
5. **Sin vistazo, no hay ficha.** Un candidato solo entra en la cola con su
   lectura hecha.
6. **Todo lo caro va antes del crédito.** El crédito de Apollo se sigue gastando
   solo al decir que sí.
7. **Entra la memoria vectorial**, con cuatro trabajos concretos: ordenar el pozo,
   elegir los ejemplos del prompt, explicar la ficha y ponderar la rotación de
   combinaciones.
8. **La mejora se mide, no se supone.** Tres métricas en pantalla desde el primer
   día. Si el sistema no mejora, se ve.
9. **Al validar se genera una nota de conexión** de LinkedIn, editable.
10. **Fuera `ProspectRule`.** El chat de esta fase informa una decisión; no cambia
    la búsqueda todavía.

## El ciclo diario

```
06:00 L-V   cron prospect-queue                              maxDuration 300 s
            │
            ├─► elige combinación sector×tramo                    [ponderada + suelo]
            │
            ├─► busca en Apollo, paginando                        [0 créditos]
            │   cargos + seniority + España + plantilla 101-250 / 251-500
            │
            ├─► filtro local (patrones de empresa, 1 por empresa, ya visto)
            │
            ├─► EMBEBE los ~125 candidatos y los ORDENA            [~0 $]
            │   por parecido con lo que aceptaste y lo que descartaste
            │
            ├─► VISTAZO, empezando por los mejores                 [~0,04 $/empresa]
            │   Haiku 4.5 · ≤2 búsquedas web · ejemplos = vecinos de la memoria
            │   los cuatro criterios, con lo que se ve en una pasada corta
            │
            ├─► para cuando: 5 en la cola │ tope de gasto │ tope de tiempo
            │
            └─► escribe 5 filas pending, con dossier de nivel "vistazo"
                y guarda en la memoria lo que aprendió del día

cuando toque  /admin/prospects                    ─── todo esto es gratis en Apollo
            ├─► cabecera: créditos, embudo del día, gasto y las 3 métricas
            ├─► 5 fichas ordenadas por encaje, con los 4 criterios y sus fuentes
            │   y «se parece a X, que aceptaste»
            │
            ├─► [Analizar a fondo · ~0,35 $]    Opus 5 · ≤3 búsquedas     tú decides
            ├─► [Chat sobre esta empresa]       Opus 5 · ≤4 búsquedas/msg tú decides
            │
            ├─► "Sí"  → enriquece                                    [1 crédito]
            │           → Prospect + nota de conexión + a la memoria
            └─► "No"  → motivo + nota opcional                       [0 créditos]
                        → a la memoria
```

## Los cuatro criterios

| Criterio | Veredicto | Qué se pide como evidencia | Qué lo tumba |
|---|---|---|---|
| **Facturación** | `pass` / `unclear` / `fail` | cifra y ejercicio, con la fuente (registro mercantil, ficha de einforma/axesor, nota de prensa, memoria anual) | fuera de 50-100 M€ con fuente fiable |
| **Necesita producto digital** | `pass` / `unclear` / `fail` | a qué se dedica **y** qué producto digital necesita para operar | su negocio **es** el producto digital, o no se le ve necesidad |
| **Equipo IT** | `pass` / `unclear` / `fail` | tamaño estimado y orientación, con las señales | no hay equipo, o lo hay grande / con perfiles de producto |
| **Necesidad de orientación** | `pass` / `unclear` / `fail` | señales de decisión técnica sin dueño dentro | solo soporte al puesto de trabajo, o ya tienen quien decide |

**`unclear` es un veredicto de primera clase**, y en el vistazo será el más
frecuente. En España las cuentas se depositan con uno o dos años de retraso y los
grupos con varias sociedades no consolidan en público. Un sistema que convierte
«no lo sé» en «≈50 M€» miente en el dato que más pesa. La ficha muestra la duda
como duda, en ámbar.

**La facturación siempre es una estimación con fuente, nunca un dato verificado.**
La interfaz lo dice con esas palabras.

## La memoria vectorial

### Qué se guarda

Modelo nuevo `ProspectMemory`, con documentos de varios tipos en la misma tabla
para que la búsqueda por vecindad los recorra todos.

| Campo | Tipo | Nota |
|---|---|---|
| `kind` | `String` | `decision` / `criterio` / `conclusion` |
| `sourceId` | `String?` | `apolloId` de la fila que lo originó |
| `text` | `String @db.Text` | el texto que se embebió, legible |
| `metadata` | `Json` | decisión, motivo, veredictos, sector, tramo, score |
| `embedding` | `Unsupported("vector(1024)")` | Voyage `voyage-4-lite` |

- **`decision`** — una por candidato decidido. El texto es lo mismo que se ve en
  la ficha, con la decisión al final:

  > «Director de Operaciones · Herrajes Nordeste · fabricación de herrajes,
  > vende por catálogo a distribuidores, monta portal B2B · facturación ≈71 M€ ·
  > equipo IT 3 personas operativas · ACEPTADO»

  El nombre de la empresa es lo que más señal aporta: «Herrajes Nordeste» dice más
  de a qué se dedican que la etiqueta de sector con la que los buscamos.

- **`criterio`** — un documento corto con qué vende Room714 y a quién. Es el ancla
  del día uno, cuando no hay decisiones.

- **`conclusion`** — la conclusión en una línea de una conversación del chat, si
  la escribes en la nota.

**Las 48 filas `legacy` NO entran en la memoria.** Nadie las decidió; son el
resultado de una migración. Meterlas sería enseñarle al sistema un criterio que no
existe, y es la misma guarda que ya aplica `deriveRules`.

### Qué hace con ello

**Trabajo 1 — ordenar el pozo antes de gastar.** Es el que justifica la capa. Cada
mañana Apollo devuelve hasta 125 caras. Embeber las 125 cuesta cero; pasarles el
vistazo a todas costaría 3,75 $. Así que se embeben, se ordenan por parecido con
lo aceptado (y en contra de lo descartado), y **el vistazo empieza por arriba y
para en cuanto hay 5**. Si el orden es bueno, hacen falta 8 vistazos en vez de 20.

**Trabajo 2 — elegir los ejemplos del prompt.** El bloque de sistema del vistazo
lleva tus decisiones pasadas como ejemplos etiquetados. En vez de meter «los
últimos 30», se meten **los vecinos más cercanos a este candidato concreto**: mejor
señal por token, y ejemplos que de verdad se parecen al caso que hay que juzgar.

**Trabajo 3 — explicar la ficha.** «Se parece a Conservas Maribel, que aceptaste»
o «se parece a tres que descartaste por facturación». Es lo que hace la memoria
discutible en vez de mágica: se puede estar en desacuerdo con conocimiento, y ese
desacuerdo también se guarda.

**Trabajo 4 — ponderar la rotación de combinaciones.** Ver la sección siguiente.

### Cómo se implementa

- **Proveedor**: Voyage `voyage-4-lite`, 1024 dimensiones, `input_type: "document"`
  al guardar y `"query"` al buscar. Por HTTP directo desde
  `app/lib/prospecting/embeddings.js`. **Requiere `VOYAGE_API_KEY`: es la única
  alta externa de todo el diseño.** Anthropic no ofrece API de embeddings y
  recomienda Voyage.
- **Esquema**: Prisma no tiene tipo nativo para `vector`, así que la columna va
  como `Unsupported(...)` y las escrituras y consultas de vecindad van por
  `$queryRaw` con el operador `<=>` (distancia coseno). En la misma operación:

  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE INDEX prospect_memory_embedding_idx
    ON "ProspectMemory" USING hnsw (embedding vector_cosine_ops);
  ```

- **Degradación**: si Voyage falla o falta la clave, **la cola sigue
  funcionando**. Se pierde el orden (el vistazo recorre los candidatos como
  vengan), se pierden los ejemplos del prompt y se pierde el «se parece a». No se
  cae nada: la capa vectorial se degrada, no rompe. El resumen del cron lo dice.

### El arranque en frío, dicho claro

Hoy hay **4 decisiones reales**. Las primeras tres o cuatro semanas —unas 60-80
decisiones a cinco al día— la memoria no va a ordenar bien, y los vistazos por
ficha estarán cerca del máximo. Quien trabaja el día uno es el vistazo, no la
memoria. **Esto no es un fallo del sistema: es su forma de arrancar**, y las
métricas de la sección siguiente existen para que se vea la curva en vez de
suponerla.

## Que cada búsqueda sea más eficaz, y cómo se comprueba

Tres palancas, y tres números que dicen si funcionan.

### Las palancas

**1. El orden del pozo** (memoria vectorial, trabajo 1). Menos vistazos para
llenar la cola.

**2. Los ejemplos del prompt** (trabajo 2). Mejor calibración en los casos
frontera: dónde pones tú la línea con un «45-55 M€ estimado», si un revendedor de
software de terceros cuenta como «no hace producto digital».

**3. La rotación ponderada de combinaciones.** Hoy las 14 combinaciones de sector
y tramo rotan en ciclo fijo. El spec de B1 lo dejó así a propósito, y explicaba
bien por qué: ponderar por tasa de acierto es un trinquete, porque una combinación
con mala racha temprana deja de salir y no puede demostrar nunca que era buena.

La versión que sí se puede sostener **añade un suelo**: cada combinación se
muestrea **obligatoriamente al menos una vez cada 20 ejecuciones**, pase lo que
pase con su tasa. El resto de los días, la combinación se elige ponderada por tasa
de acierto suavizada (Laplace, ya implementada en `deriveRules`). Así el esfuerzo
se concentra donde funciona sin que ninguna combinación pueda quedar condenada por
una mala racha de tres semanas.

Con 14 combinaciones y una al día, la rotación fija de hoy muestrea cada una cada
14 ejecuciones. El suelo de 20 es por tanto una **relajación deliberada** de esa
garantía: da margen a la ponderación sin dejar que ninguna combinación desaparezca
más de un mes natural. Es el único parámetro de esta sección que conviene revisar
con datos a los tres meses.

El suelo no es negociable: sin él, esto es el trinquete que B1 rechazó con razón.

### Los números

Panel nuevo en la cabecera, **¿está mejorando?**, con media móvil de 7 días:

| Métrica | Qué mide | Hacia dónde debe ir |
|---|---|---|
| **Vistazos por ficha** | cuántas empresas hay que mirar para llenar un hueco | ↓ (empieza ~4, debería bajar) |
| **Tasa de aceptación de la cola** | cuántas de las 5 acabas aceptando | ↑ |
| **Coste por prospecto validado** | IA total del periodo ÷ prospectos aceptados | ↓ |

Es la parte del diseño que más me importa dejar escrita: **"cada día más eficaz"
es una hipótesis, no una propiedad**. Si a las seis semanas los vistazos por ficha
siguen en 4 y la tasa de aceptación no sube, la memoria no está aportando y hay
que cambiarla o quitarla. Sin estos tres números eso no se puede saber, y un
sistema que no se puede evaluar tiende a que se le atribuyan mejoras que no
existen.

**Por qué no hace falta desplegar esto en dos fases para poder medirlo.** La
tentación es soltar primero el cualificador sin memoria, tomar la línea base, y
añadir la memoria después. No sirve, y además estorba: con 4 decisiones la memoria
es **inerte**, así que las primeras semanas son la línea base por sí solas, esté
el código desplegado o no. Partirlo, en cambio, dejaría la tabla de vectores vacía
hasta la segunda fase —obligando a rellenarla hacia atrás— y haría coincidir el
despliegue de la memoria con el momento en que el corpus madura, confundiendo los
dos efectos que precisamente se quieren distinguir. Va todo junto, y la curva de
las tres métricas es la medición.

## El cualificador

Módulo nuevo `app/lib/prospecting/qualify.js`, puro en el mismo sentido que el
resto del directorio: recibe el cliente de Anthropic inyectado, así que se prueba
sin red. Expone dos funciones con la **misma forma de salida**, para que la ficha
no tenga que saber cuál la produjo.

### `quickLook()` — el vistazo del cron

- **Modelo**: `claude-haiku-4-5`.
- **Herramienta**: `web_search_20260318`, `max_uses: 2`,
  `response_inclusion: "excluded"`.
- **Ejemplos**: los vecinos más cercanos de la memoria, con su decisión y motivo.
- **Instrucción central**: no adivinar. Sin fuente, `unclear`. Solo `fail` cuando
  la evidencia lo sostenga.
- **Coste**: ~0,03 $ por empresa.

### `deepDive()` — el análisis a demanda

- **Modelo**: `claude-opus-5`, `thinking: {type: "adaptive"}`.
- **Herramienta**: `web_search_20260318`, `max_uses: 4`,
  `response_inclusion: "excluded"`.
- **Contexto**: parte del vistazo ya hecho y se le pide explícitamente que ataque
  lo que quedó en `unclear`.
- **Efecto**: reescribe el dossier, sube el nivel a `fondo` y recalcula el score.
  La ficha enseña el cambio («58 → 85 tras el análisis a fondo»).
- **Coste**: ~0,33 $ por empresa, medido contra la API el 2026-08-31.

En los dos casos, el filtrado dinámico de `web_search_20260318` criba los
resultados antes de que entren en contexto, y `response_inclusion: "excluded"`
evita pagar de salida por devolver el contenido bruto. **No se declara
`code_execution`**: la API lo provisiona sola para el filtrado dinámico.

El bloque de sistema —criterios, contexto de Room714, disciplina de citar— es
idéntico en todas las llamadas del día y va con `cache_control`. Los ejemplos de
la memoria van **después** de ese bloque, porque cambian por candidato.

### Dos llamadas, no una

Cada función se parte en dos: **investigar** (con búsqueda web, salida libre, un
informe con fuentes) y **estructurar** (sin herramientas, con
`output_config.format` y esquema JSON).

Es más código que pedir JSON y búsqueda web a la vez, y se hace a propósito: las
citas de búsqueda web se adjuntan a los bloques de texto de la respuesta, y no está
establecido que eso conviva con una salida estructurada. Partirlo también deja el
informe en prosa disponible como contexto del chat.

**Durante la implementación se comprueba si una sola llamada funciona.** Si
funciona, se colapsa y se anota. Si no, esta es la razón por la que estaban
partidas.

### La puntuación y el umbral

El score **no lo pone el modelo**. Fórmula fija sobre los cuatro veredictos:

```
peso por criterio     facturación 30 · producto digital 30 · equipo IT 25 · orientación 15
factor por veredicto  pass 1.0 · unclear 0.4 · fail 0
score                 suma redondeada, de 0 a 100
```

Pedirle un número al modelo daría una cifra que nadie puede discutir; con esto,
discrepar del 68 es discrepar de un veredicto concreto.

**Dos puertas duras, por encima del score.** Un `fail` en facturación o en
«necesita producto digital» descarta aunque el resto sume.

**`QUALIFY_THRESHOLD = 50`**, deliberadamente bajo: el filtrado lo hacen las
puertas duras, y el score está sobre todo para **ordenar** la cola y para que se
vea de un golpe cuál merece los 0,35 $ del análisis a fondo.

### Los topes del cron

| Tope | Valor por defecto | Qué pasa al alcanzarlo |
|---|---|---|
| Gasto en IA del día | `PROSPECT_QUALIFY_DAILY_BUDGET_USD = 1.20` | se para y se escribe lo que haya |
| Empresas miradas | 30 | ídem |
| Tiempo de ejecución | 240 s (con `maxDuration = 300`) | ídem, antes de que Vercel corte |

El tope es solo del **cron**: el análisis a fondo y el chat son acciones tuyas y no
consumen de ese presupuesto. El gasto se estima sumando `usage` de cada respuesta
contra una tabla de precios en `app/lib/prospecting/aiCost.js`, y la interfaz dice
que es estimación nuestra, no la factura de Anthropic.

Los vistazos van en **lotes de 5 en paralelo**.

## El chat de la ficha

- **Modelo**: `claude-opus-5`, `thinking: {type: "adaptive"}`, en streaming.
- **Herramienta**: `web_search_20260318`, `max_uses: 4` por mensaje.
- **Contexto**: el informe en prosa del vistazo (o del análisis a fondo), el
  veredicto estructurado, los datos de Apollo, los vecinos de la memoria y qué
  vende Room714.
- **Disciplina**: cita fuentes y separa lo comprobado de lo supuesto.
- **Sugerencias de arranque**: quién decide la inversión en tecnología, si ya
  trabajan con alguna consultora, si han hecho algún proyecto digital antes.

**El hilo no se persiste.** Vive en el estado del cliente mientras decides esa
ficha. Lo que merezca sobrevivir lo escribes en la nota, que sí se guarda y **sí
entra en la memoria** como documento `conclusion`. Guardar conversaciones enteras
sería acumular material que nadie relee; guardar la conclusión es lo que cierra el
bucle.

**Es sobre la empresa, no sobre la persona.** Hasta que aceptas, de la persona
solo tenemos cargo e inicial: Apollo ofusca el apellido. La ficha lo dice —
«nombre completo y LinkedIn tras aceptar».

**Coste**: 0,05-0,15 $ por conversación, escrito en la interfaz.

## La nota de conexión

- **Formato**: nota de conexión de LinkedIn, **máximo 300 caracteres**, español,
  tuteando.
- **Materia prima**: la señal concreta del dossier. La nota debe poder existir
  solo para esta empresa.
- **Ejemplos de tono**: las últimas notas de prospectos aceptados **tal y como las
  dejaste tú tras editarlas**. Si reescribes sistemáticamente de la misma manera,
  las siguientes salen ya así.
- **Prohibido**: vender, prometer resultados, pedir una reunión larga, y decir
  «espero que estés bien».
- **Modelo**: `claude-opus-5` sin herramientas. ~0,01 $.
- **Se guarda** en `Prospect.introText`, con contador de caracteres y copiar /
  regenerar / editar.

**Si la generación falla, el prospecto se crea igual.** El crédito ya está gastado
y no se pierde por un fallo de texto.

## Modelo de datos

### `ProspectDiscovery`

| Campo | Tipo | Nota |
|---|---|---|
| `score` | `Int?` | 0-100, para ordenar la cola |
| `dossier` | `Json?` | veredictos, informe, fuentes, coste estimado |
| `depth` | `String?` | `vistazo` / `fondo` |
| `qualifiedAt` | `DateTime?` | cuándo se miró por última vez |
| `neighbors` | `Json?` | los 3 vecinos más cercanos con su decisión, para el «se parece a» |

Índice nuevo: `[decision, score]`.

Las filas descartadas por el vistazo **se escriben igual**, con `decision = "no"`
y su dossier: sin ellas no habría embudo que enseñar y volveríamos a mirar mañana
a quien ya descartamos hoy.

### `ProspectMemory` (nuevo)

El de la tabla de arriba, más `createdAt`.

### `Prospect`

| Campo | Tipo | Nota |
|---|---|---|
| `introText` | `String? @db.Text` | la nota de conexión, con tus ediciones |
| `dossier` | `Json?` | copia al validar, para no perderlo |

### Esquema

`prisma db push`, nunca `migrate`: este proyecto no tiene historial de migraciones
y `migrate dev` pediría resetear la base entera. Todos los campos nuevos son
opcionales. La extensión y el índice HNSW van por SQL directo, porque `db push` no
los crea.

## La pantalla

Mockup aprobado: `https://claude.ai/code/artifact/c821e034-95d1-49b3-8385-75618f775c6f`

**Cabecera.** Créditos de Apollo, el embudo del día (`126 vistas → 11 miradas → 5
en tu cola`), el gasto estimado, y el panel **¿está mejorando?** con las tres
métricas.

**La cola.** 5 fichas ordenadas por encaje, con el umbral a la vista. Cada ficha:

- empresa, cargo, y el aviso de que el nombre completo llega al aceptar
- puntuación con su barra y etiqueta de nivel: `vistazo` o `a fondo`
- los cuatro criterios en rejilla, con símbolo **y** color, valor y evidencia con
  fuente clicable
- **«se parece a…»**: hasta tres vecinos con lo que decidiste de cada uno
- el resumen de dos líneas y los enlaces de búsqueda manual
- **`[Analizar a fondo · ~0,35 $]`**, que desaparece cuando ya se ha hecho
- **`[Chat sobre esta empresa]`**, plegado
- **la línea que separa lo gratis de lo que cuesta**: `a partir de aquí se gasta 1
  crédito`

**Motivos de descarte.** A los cinco actuales se añaden `revenue` («la facturación
no encaja») y `no_digital_need` («no necesita producto digital»).

**Panel «lo que ha aprendido el filtro».** Como hoy, más las combinaciones con su
tasa y su peso en la rotación, y cuándo le toca a cada una por el suelo.

**Validados.** Como hoy, más la nota de conexión con copiar / regenerar / editar.

## Reglas y aprendizaje determinista

Los tramos de plantilla pasan de `["51,100", "101,250"]` a
`["101,250", "251,500"]`, porque 50-100 M€ en España rara vez caben en menos de
100 empleados. **Las reglas aprendidas sobre `51,100` dejan de aplicar**: no se
borra nada, simplemente no afectan a ninguna consulta.

Los dos motivos nuevos alimentan los mismos acumuladores. `revenue` no excluye
nada por sí solo —no hay dimensión de facturación que excluir en Apollo— pero
cuenta como fallo del sector, que sí pondera la rotación.

El score de la IA **no** realimenta la consulta de Apollo. Sería cerrar un bucle
donde el juez y la parte son el mismo modelo. Se enseña, se compara con tus
decisiones en el panel, y con eso se decide más adelante.

## Coste

Precios verificados el 2026-08-31: Opus 5 a 5 $ / 25 $ por millón de tokens, Haiku
4.5 a 1 $ / 5 $, búsqueda web a 10 $ / 1.000 búsquedas, Voyage `voyage-4-lite` a
0,02 $/M con 200M gratis.

**Automático (el cron):**

| Concepto | Al día | Al mes (21 laborables) |
|---|---|---|
| Embeddings (~125 candidatos) | ~0,00 $ | **0 $** (tramo gratuito) |
| Vistazo, arranque en frío (~20 empresas) | ~0,82 $ | ~17 $ |
| Vistazo, con la memoria funcionando (~8-10) | ~0,37 $ | **~8 $** |

**A demanda (lo disparas tú):**

| Concepto | Por unidad | Si usas… | Al mes |
|---|---|---|---|
| Analizar a fondo | ~0,33 $ medido | 2 al día | ~14 $ |
| Chat | 0,05-0,15 $ | 2 al día | ~4 $ |
| Nota de conexión | ~0,01 $ | 1 al día | <1 $ |

**Total: ~31 $/mes al principio, bajando hacia ~24 $ si la memoria cumple.** El
techo del cron lo fija el tope diario de 0,75 $ ≈ 16 $/mes.

Esa bajada es precisamente la hipótesis que mide «vistazos por ficha». No es una
promesa.

## Qué NO se hace en esta fase

- **`ProspectRule`**: reglas explícitas propuestas por el chat.
- **Persistir las conversaciones** del chat (sí su conclusión).
- **Realimentar la consulta de Apollo con el score** de la IA.
- **Verificar la facturación contra una fuente de pago** (einforma, Axesor).
- **Análisis a fondo automático.** El código queda listo para llamarlo desde el
  cron si algún día se quiere.

## Riesgos

- **La memoria no aporta.** Es un riesgo real y el arranque en frío lo agrava. Por
  eso está medido: si a las seis semanas los vistazos por ficha no bajan, la capa
  no está haciendo su trabajo. Mitigación: se puede desactivar sin tocar nada más,
  porque el sistema ya funciona sin ella.
- **La memoria se sobreajusta a los primeros aciertos.** Con 20 decisiones, los
  vecinos de cualquier candidato son casi arbitrarios. Mitigación: el orden solo
  decide **a quién se mira primero**, nunca a quién se descarta; ningún candidato
  se elimina por parecido.
- **El vistazo es poco fiable, por diseño.** Con dos búsquedas y un modelo pequeño
  dejará muchos `unclear`. Es el precio de que el piloto automático cueste 6-13
  $/mes; para eso tienes dos botones.
- **La IA se inventa una facturación.** El riesgo más caro. Mitigación: fuente
  citada obligatoria, `unclear` legítimo, la interfaz dice «estimación», y hay dos
  formas de contrastar antes de pagar.
- **Dependencia nueva (Voyage).** Si falla o falta la clave, la cola sigue
  funcionando sin orden, sin ejemplos y sin «se parece a». Se degrada, no rompe.
- **El cron se pasa de tiempo.** 300 s de `maxDuration`, tope interno de 240 s con
  escritura de lo que haya.

## Pruebas

Unitarias, sin red ni base de datos (clientes inyectados):

- Parseo del veredicto estructurado: completo, con campos ausentes, JSON inválido
  → el candidato no entra en la cola y el motivo queda en el resumen.
- Fórmula del score: pesos, `unclear` a 0,4, y que las puertas duras descartan
  aunque el score pase.
- Umbral: entra el 50, no entra el 49.
- Ordenación por memoria: con memoria vacía conserva el orden original; con
  memoria, los parecidos a aceptados van delante; **nunca elimina candidatos**.
- Selección de vecinos para el prompt y para el «se parece a».
- Rotación ponderada: respeta el suelo de 1 de cada 20 por combinación, y una
  combinación con tasa 0 sigue saliendo.
- Parada por los tres topes del cron; en los tres casos se escribe lo aprobado.
- `aiCost`: tokens y búsquedas contra la tabla de precios, incluyendo caché.
- `deepDive` sobre un dossier de vistazo: sube el nivel, recalcula el score,
  conserva las fuentes anteriores.
- Las filas `legacy` no entran en la memoria.
- Nota de conexión: recorte a 300, ejemplos de tono de notas ya editadas, y que un
  fallo de generación no impide crear el `Prospect`.

Con base de datos, en local:

- `CREATE EXTENSION vector` y el índice HNSW se aplican, y una consulta `<=>`
  devuelve vecinos ordenados.
- `prospect-queue?preview=1`: no escribe; enseña el orden que daría la memoria y
  el gasto que estima.
- Ejecución real con `?force=1` contra desarrollo: embudo, gasto y métricas.

Manual, antes de dar la fase por buena: revisar cinco fichas reales y contrastar a
mano la facturación de cada una. Lo que hay que medir es si **el análisis a fondo**
acierta, porque es el que decide si se gasta el crédito.
