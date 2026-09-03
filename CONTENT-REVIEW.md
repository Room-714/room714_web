# Revisión de contenidos y decisiones

Cuaderno de lo que queda pendiente y de las decisiones que he tenido que
tomar durante el rediseño. Se va rellenando por fases.

---

## Fase 1 · Correcciones técnicas

### Datos que faltan

| Qué | Dónde | Estado |
|---|---|---|
| **Sectores de los 6 logos de clientes** | `app/[lang]/page.js`, carrusel de la home | Los `alt` siguen siendo `Client-01`…`Client-06`. No los he cambiado porque inventar el sector de un cliente es exactamente lo que no toca hacer. En cuanto me des la lista, van al diccionario y salen de ahí. |
| **Foto de José Antonio Ces Franjo** | firma del artículo | Hay un placeholder en `public/author-placeholder.svg`. El JSON-LD de la `Person` **no** declara `image` a propósito: un avatar genérico no es una foto suya, y declararlo sería afirmar algo falso. |
| **Logo para datos estructurados** | `organizationSchema` | Usa `/logo.svg`. Google acepta SVG, pero recomienda un raster cuadrado de 112 px o más para el logo de `Organization`. Conviene un PNG cuadrado cuando lo haya. |
| **Dirección postal** | `organizationSchema` | Solo `Madrid, ES`. Sin calle ni código postal no se puede aspirar a resultados de negocio local completos. Dime si quieres añadirla. |
| **Correo de contacto** | Anexo A, página *Hablemos* | El anexo dice «dirección por confirmar». Pendiente para la Fase 3. |

### Texto provisional que he escrito yo

- **Rol en la firma del artículo**: «Fundador de Room 714» / «Founder of Room
  714». El Anexo A dice «fundador y CEO»; he puesto la versión corta porque
  es una línea de metadatos, no una bio. Cámbialo si prefieres la otra.

### Decisiones

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
  16 los genera solo). Los he dejado **sin commitear**, porque son ficheros
  que no pediste. Dime si los quieres en el repo o en `.gitignore`.
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
