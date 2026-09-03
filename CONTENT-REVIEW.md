# Revisión de contenidos y decisiones

Cuaderno de lo que queda pendiente y de las decisiones que he tenido que
tomar durante el rediseño. Se va rellenando por fases.

---

## Fase 1 · Correcciones técnicas

### Datos que faltan

| Qué | Dónde | Estado |
|---|---|---|
| ~~Sectores de los 6 logos de clientes~~ | `dict.home.customers.logos` | **Resuelto.** Ver «Los logos identifican a los tres clientes bajo NDA» más abajo. |
| **Foto de José Antonio Ces Franjo** | firma del artículo | Hay un placeholder en `public/author-placeholder.svg`. El JSON-LD de la `Person` **no** declara `image` a propósito: un avatar genérico no es una foto suya, y declararlo sería afirmar algo falso. |
| **Logo para datos estructurados** | `organizationSchema` | Usa `/logo.svg`. Google acepta SVG, pero recomienda un raster cuadrado de 112 px o más para el logo de `Organization`. Conviene un PNG cuadrado cuando lo haya. |
| **Dirección postal** | `organizationSchema` | Solo `Madrid, ES`. Sin calle ni código postal no se puede aspirar a resultados de negocio local completos. Dime si quieres añadirla. |
| **Correo de contacto** | Anexo A, página *Hablemos* | El anexo dice «dirección por confirmar». Pendiente para la Fase 3. |

### Texto provisional que he escrito yo

- **Rol en la firma del artículo**: «Fundador de Room 714» / «Founder of Room
  714». El Anexo A dice «fundador y CEO»; he puesto la versión corta porque
  es una línea de metadatos, no una bio. Cámbialo si prefieres la otra.

### ⚠ Los logos identifican a los tres clientes bajo NDA

Me pediste elegir yo los sectores de los seis logos. Para no inventarlos,
extraje los PNG que los SVG llevan embebidos y los miré. Son:

| Fichero | Empresa | Sector en el `alt` |
|---|---|---|
| `client-01.svg` | Samsung | electrónica de consumo |
| `client-02.svg` | Grupo Fractalia | servicios tecnológicos |
| `client-03.svg` | Telefónica | telecomunicaciones |
| `client-04.svg` | hellotax | software de cumplimiento fiscal |
| `client-05.svg` | Orange | telecomunicaciones |
| `client-06.svg` | ComeFruta | comercio online de alimentación |

El `alt` nombra empresa **y** sector, no solo el sector: hay dos logos de
telecos, y con «telecomunicaciones» a secas un lector de pantalla no podría
distinguirlos. Y lo que un logo comunica es de quién es.

**Y aquí está el problema.** Tres de esos seis logos son, casi con certeza,
los tres clientes de los casos anonimizados del Anexo A:

- **hellotax** hace software de cumplimiento de IVA en la UE para
  e-commerce → el «SaaS B2B de cumplimiento regulatorio para compañías que
  operan en varios países» del Caso 1.
- **Grupo Fractalia** vende servicios de protección y productividad digital
  a través de operadores → la «plataforma SaaS vendida por operadores y
  service providers bajo su marca» del Caso 2.
- **ComeFruta** es comercio online de alimentación fresca → el «comercio
  online de alimentación fresca y de temporada sobre WooCommerce» del
  Caso 3.

El propio Anexo A razona la anonimización diciendo: «Tienes razón en que
"empresa de gestión de IVA en la UE" con un logo al lado identifica al
cliente en dos segundos. **Pero el logo no va a estar.**» Si los logos se
quedan en la web —aunque sea en otra sección— el logo sí está, y la
anonimización de los tres casos no sirve de nada: cualquiera cruza «SaaS de
cumplimiento en varios países» con el logo de hellotax en la misma web.

No es una decisión que pueda tomar yo. Las salidas que veo:

1. **Quitar del carrusel los tres logos de los casos** y dejar Samsung,
   Telefónica y Orange, que no aparecen en ningún caso. Es la única opción
   que mantiene el carrusel *y* la confidencialidad.
2. **Pedirles permiso para nombrarlos.** Un caso con nombre vale mucho más
   que uno anonimizado, y ya tienes su logo publicado.
3. **Dejarlo como está** asumiendo que la anonimización es de cortesía, no
   real. Legítimo si los NDA no prohíben mencionar la relación, pero
   entonces sobra el aviso «Sector y algunos detalles alterados».

Hasta que lo decidas he dejado los seis logos con su `alt` correcto: el
problema no es el texto alternativo, es qué logos se publican.

### Decisiones

**El artículo pilar al que redirige el modelo canónico no habla del modelo
canónico.** Al preparar la reversión de esa consolidación encontré esto:

- «El Modelo Canónico: Que no "alucine" tu IA» es el post #74, hoy
  **despublicado**, y son solo **2.730 caracteres**. Era un artículo corto.
- «RAG no es Magia» es el post #126, publicado, **13.601 caracteres**, y
  absorbió **siete** artículos (14 filas de redirección, siete por idioma).
- «RAG no es Magia» menciona «canónico» **cero veces**.

O sea: quien busca «modelo canónico» y llega a esa URL antigua aterriza en
un artículo que no trata el tema. Eso no es una consolidación, es una fuga.
Tres salidas, y ninguna la he ejecutado porque toca la base de datos de
producción:

1. **Añadir la sección del modelo canónico al pilar** (una edición) y dejar
   la redirección. Mejor para SEO —una página fuerte en vez de dos flojas—
   pero el modelo canónico deja de tener URL propia, y tú lo quieres como
   reclamo comercial.
2. **Republicar el #74 y borrar las dos filas de redirección** (ids 72 y
   73). Recupera la URL propia, pero publica un artículo de 2.730
   caracteres, que es probablemente por lo que se fusionó.
3. **Reescribirlo y ampliarlo** hasta que sostenga por sí solo, y entonces
   quitar la redirección. Es lo que pide el posicionamiento nuevo (el modelo
   canónico aparece en dos de los tres casos y en la página de IA), pero
   escribir ese artículo es trabajo de contenido que no está en las cuatro
   fases.

Mi recomendación es la 3, con la 2 como paso intermedio solo si te corre
prisa tener la URL viva.

**Las tres URLs del blog que «devolvían otro artículo» no eran un fallo.**
Son redirecciones deliberadas de la consolidación SEO: `PostRedirect` tiene
124 filas con motivo `consolidation`, y esos tres slugs son URLs antiguas de
artículos fusionados en uno. La tabla está sana (cero destinos inexistentes,
cero cadenas A→B→C, cero posts vivos cuyo slug redirija). **No he revertido
ninguna consolidación**: fusionar o separar artículos es una decisión de
contenido. Queda pendiente si quieres deshacer la de *El Modelo Canónico*
dentro de *RAG no es magia*, que es la que peor encaja con el nuevo
posicionamiento.

**Sí había un fallo, y era otro.** Un artículo publicado
(`la-ia-que-nadie-pidio-cuando-añadir-inteligencia-es-ruido`) era
inalcanzable: 404 con la URL percent-encodeada y 500 con el byte crudo.
Detalle en el commit `fix(blog): un slug con enie hacia inalcanzable el
articulo`.

**308 frente a 301 en las redirecciones de artículo.** Pediste 301 y en
`next.config.mjs` ya está: los cinco redirects de ahí emitían 308 (el
comentario decía «Esto genera el código 301 que Google exige», y no era
verdad) y ahora llevan `statusCode: 301`. Pero las redirecciones de artículo
que salen de la tabla `PostRedirect` **siguen siendo 308**, porque desde un
componente de servidor de Next solo se puede emitir 308: `permanentRedirect()`
no admite código. Las alternativas son meter una consulta a la base de datos
en el proxy —una consulta más en cada petición del sitio— o volcar la tabla a
`next.config` en tiempo de compilación, lo que acopla el build a que la base
de datos esté en pie. Google documenta 301 y 308 como equivalentes para
redirección permanente, así que la ganancia sería cero y el coste real. Si
prefieres el 301 literal de todas formas, dímelo.

**hreflang sin código de región.** `es` y `en`, no `es-ES` y `en-US`. El
contenido no es específico de España ni de Estados Unidos, y un `es-ES`
excluye de la señal al lector mexicano o argentino.

**`BlogPosting` en lugar de `Article`.** Pedías `Article`; `BlogPosting` es
un subtipo suyo, así que cumple lo mismo y además dice qué clase de artículo
es. Los validadores lo aceptan igual.

**`Organization` y `ProfessionalService` a la vez.** El nodo declara los dos
tipos: `Organization` es lo que consumen los grafos de conocimiento y era lo
que pedías, y `ProfessionalService` es lo que ya había y lo que da señal de
negocio local (además de ser el único de los dos que admite `priceRange`).

**Instagram fuera de `sameAs`.** Dijiste «solo LinkedIn de Room714». El
`sameAs` anterior declaraba también un `instagram.com/room714`. De paso, el
LinkedIn de empresa apuntaba a `/company/room714` en el JSON-LD y a
`/company/room-714` en el footer: eran dos URLs distintas de la misma
empresa. Ahora salen las dos del mismo sitio (`app/lib/links.js`).

**Vercel Analytics sin esperar al banner de cookies.** No usa cookies ni
datos personales, así que no necesita consentimiento. GTM y Microsoft
Clarity siguen detrás del banner, como estaban. Para que lleguen datos hay
que **activar Web Analytics en el panel del proyecto en Vercel**, cosa que
no se hace desde el código.

### Cosas que me he encontrado de camino

- **El `ItemList` de la página de Proyectos era código muerto**: se construía
  un JSON-LD de 25 líneas y no existía el `<script>` que lo emitiera. Ahora
  se renderiza.
- **`AGENTS.md` y `CLAUDE.md`** los ha creado `next dev` al arrancarlo (Next
  16 los genera solo). Van al repo, como pediste.
- **Los logos se mueven de sitio en la Fase 3**, no desaparecen: el bloque
  de prueba con los tres casos ocupa el lugar del carrusel en la home y el
  carrusel baja a otra sección. Propondré dónde al llegar a esa fase.
- **Cuatro errores de lint previos**, en ficheros que no he tocado:
  `RegenerateModal.js` (comillas sin escapar), `ContactClient.js`
  (`setState` sincrónico dentro de un efecto) y `DiagnosticClient.js`
  (variable usada antes de declararse). No son regresiones mías. Los dos
  últimos caen en ficheros que la Fase 3 va a tocar.
- **El sitemap de producción va con retraso**: anuncia 130 URLs de artículo
  cuando la base de datos tiene 132. Es el `revalidate = 3600`, no un fallo.
- **El nav no soporta submenú ni tenía botón CTA**, así que en la Fase 2
  «Qué hacemos» será página índice con cuatro tarjetas y «Hablemos» irá con
  el estilo de `PrimaryButton`, como acordamos.
