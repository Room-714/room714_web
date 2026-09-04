# Fase 2 · Tabla de redirecciones

Estado: **pendiente de aprobación**. Nada de esto está aplicado todavía.

Todas las redirecciones se implementan en `next.config.mjs` con
`statusCode: 301` (no `permanent: true`, que emite 308).

---

## 1. Rutas que se renombran · 6 redirecciones

| # | URL antigua | URL nueva | Código |
|---|---|---|---|
| 1 | `/es/projects` | `/es/casos` | 301 |
| 2 | `/en/projects` | `/en/cases` | 301 |
| 3 | `/es/about` | `/es/como-trabajamos` | 301 |
| 4 | `/en/about` | `/en/how-we-work` | 301 |
| 5 | `/es/contact` | `/es/hablemos` | 301 |
| 6 | `/en/contact` | `/en/lets-talk` | 301 |

La redirección de `/contact` conserva la query string, que importa porque
el diagnóstico llega con `?interest=...` (Next la preserva por defecto).

## 2. Rutas que NO cambian · 0 redirecciones

`/es` · `/en` · `/es/blog` · `/en/blog` · **las 132 URLs de artículo** ·
las 8 de categoría · `/es/diagnostic` · `/en/diagnostic` ·
`/es/careers` · `/en/careers` · `/es/privacy` · `/es/terms` ·
`/es/cookies` (y sus equivalentes EN) · `/robots.txt` · `/sitemap.xml` ·
`/llms.txt`.

Diagnóstico y Empleo **salen del menú pero conservan su URL** y siguen
accesibles; pasan al footer.

## 3. Redirecciones que ya existen · se mantienen

| URL antigua | URL nueva | Código |
|---|---|---|
| `room714.es/*` y `www.room714.es/*` | `www.room714.com/en/*` | 301 |
| `/legal` | `/en/privacy` | 301 |
| `/en/legal` | `/en/privacy` | 301 |
| `/es/legal` | `/es/privacy` | 301 |

## 4. Guardas de idioma cruzado · 22 redirecciones · **necesarias**

No cubren ninguna URL antigua, pero no son opcionales: son lo que hace que
funcionen las rutas distintas por idioma (ver la sección final). Cada página
tendrá una carpeta por idioma, así que `/en/casos` *resolvería* y pintaría
la página de casos en inglés bajo la URL castellana: contenido duplicado. La
redirección lo evita.

Y hay un segundo motivo, más visible para un visitante: `proxy.js` manda
cualquier ruta sin idioma al idioma del navegador. Quien comparta
`room714.com/casos` y lo abra alguien con el navegador en inglés acaba en
`/en/casos`.

Son dos filas por página (la ruta ES bajo `/en` y la EN bajo `/es`), para
las 11 páginas con nombre distinto en cada idioma:

| Página | Se redirige | Hacia |
|---|---|---|
| Casos | `/en/casos` | `/en/cases` |
| | `/es/cases` | `/es/casos` |
| Cómo trabajamos | `/en/como-trabajamos` | `/en/how-we-work` |
| | `/es/how-we-work` | `/es/como-trabajamos` |
| Hablemos | `/en/hablemos` | `/en/lets-talk` |
| | `/es/lets-talk` | `/es/hablemos` |
| Qué hacemos | `/en/que-hacemos` | `/en/what-we-do` |
| | `/es/what-we-do` | `/es/que-hacemos` |
| Producto para tus clientes | `/en/producto-para-tus-clientes` | `/en/product-for-your-customers` |
| | `/es/product-for-your-customers` | `/es/producto-para-tus-clientes` |
| Producto para tu equipo | `/en/producto-para-tu-equipo` | `/en/product-for-your-team` |
| | `/es/product-for-your-team` | `/es/producto-para-tu-equipo` |
| IA en el producto | `/en/ia-en-el-producto` | `/en/ai-in-the-product` |
| | `/es/ai-in-the-product` | `/es/ia-en-el-producto` |
| Empezar de cero | `/en/empezar-de-cero` | `/en/starting-from-scratch` |
| | `/es/starting-from-scratch` | `/es/empezar-de-cero` |
| Caso 1 | `/en/casos/saas-soporte-autogestion` | `/en/cases/saas-support-self-service` |
| | `/es/cases/saas-support-self-service` | `/es/casos/saas-soporte-autogestion` |
| Caso 2 | `/en/casos/activacion-modelo-canonico` | `/en/cases/activation-canonical-model` |
| | `/es/cases/activation-canonical-model` | `/es/casos/activacion-modelo-canonico` |
| Caso 3 | `/en/casos/ia-ecommerce-sin-tocar-la-tienda` | `/en/cases/ai-ecommerce-without-touching-the-store` |
| | `/es/cases/ai-ecommerce-without-touching-the-store` | `/es/casos/ia-ecommerce-sin-tocar-la-tienda` |

No se escriben a mano: salen de un bucle sobre el mapa de rutas (ver abajo),
así que añadir una página añade sus dos guardas sola.

## 5. URLs nuevas · sin redirección, no existían

### Páginas de situación (las cuatro que diste)

| Castellano | Inglés |
|---|---|
| `/es/producto-para-tus-clientes` | `/en/product-for-your-customers` |
| `/es/producto-para-tu-equipo` | `/en/product-for-your-team` |
| `/es/ia-en-el-producto` | `/en/ai-in-the-product` |
| `/es/empezar-de-cero` | `/en/starting-from-scratch` |

### Índice de «Qué hacemos» · **URL propuesta por mí**

No la especificaste. Propongo:

| Castellano | Inglés |
|---|---|
| `/es/que-hacemos` | `/en/what-we-do` |

### Páginas de caso · **slugs EN propuestos por mí**

Diste los tres en castellano, no en inglés.

| Castellano | Inglés propuesto |
|---|---|
| `/es/casos/saas-soporte-autogestion` | `/en/cases/saas-support-self-service` |
| `/es/casos/activacion-modelo-canonico` | `/en/cases/activation-canonical-model` |
| `/es/casos/ia-ecommerce-sin-tocar-la-tienda` | `/en/cases/ai-ecommerce-without-touching-the-store` |

El tercero es largo (46 caracteres). Alternativa más corta si la prefieres:
`/en/cases/ai-without-touching-the-store`.

---

## Lo que hay que cambiar además de las redirecciones

Ningún artículo del blog enlaza a las rutas que se renombran (comprobado
sobre las 200 traducciones: cero coincidencias de `/about`, `/projects`,
`/contact`, `/diagnostic` y `/careers` en el contenido). Todo lo que apunta
ahí es código:

| Fichero | Qué |
|---|---|
| `app/components/Navbar.js` | los ítems del menú, y el CTA «Hablemos» con estilo `PrimaryButton` |
| `app/sitemap.js` | la lista `pages`, más las 7 rutas nuevas |
| `app/llms.txt/route.js` | cuatro URLs codificadas a mano |
| `app/components/DiagnosticClient.js` | `/${lang}/contact` → la ruta nueva, en dos sitios |
| `app/[lang]/page.js` | el CTA de la home a contacto |
| `app/[lang]/projects/page.js` | el CTA del cierre |
| `app/lib/seo/schema.js` | la `url` del fundador apunta a `/es/about` |
| `app/components/BreadcrumbSchema.js` | los nombres legibles de las rutas nuevas |
| `app/dictionaries/*.json` | las etiquetas del menú (`nav.*`) |

## Cómo se sostienen dos URLs distintas para la misma página

Hoy la ruta es `app/[lang]/about/page.js`, y ese segmento `about` es fijo:
sirve `/es/about` y `/en/about` con el **mismo** texto en la URL. El diseño
nuevo pide `/es/casos` y `/en/cases`, que son segmentos distintos, así que
una sola carpeta no puede darlos.

La solución es **una carpeta por idioma que delega en un componente
compartido**:

```
app/[lang]/casos/page.js      → export { default } de la página de casos
app/[lang]/cases/page.js      → el mismo componente
app/[lang]/_casos/vista.js    → la página de verdad, una sola vez
```

Cada carpeta es un fichero de tres líneas; el contenido vive una sola vez.
Las guardas de la sección 4 se encargan de que `/en/casos` no sirva
contenido duplicado, y el `hreflang` de la Fase 1 (`langPaths`) declara cuál
es la URL buena en cada idioma.

Lo que ata todo es **un mapa de rutas**, `app/lib/routes.js`, del estilo:

```js
export const ROUTES = {
  casos:   { es: "/casos",   en: "/cases" },
  comoTrabajamos: { es: "/como-trabajamos", en: "/how-we-work" },
  hablemos: { es: "/hablemos", en: "/lets-talk" },
  // ...
};
```

De ese único sitio salen los ítems del menú, el sitemap, los `hreflang`, las
migas de pan, los CTA y el bucle que genera las 22 guardas en
`next.config.mjs`. Es lo que evita que dentro de tres meses el menú apunte a
una URL y el sitemap a otra, que es exactamente el problema que arreglamos
en la Fase 1 con los hreflang escritos a mano página por página.

Las carpetas actuales se mueven con `git mv` para conservar el historial.

**Alternativa descartada**: un `[...slug]` que resuelva todo contra el mapa.
Es menos código, pero un catch-all a ese nivel tapa rutas hermanas y
complica el `generateStaticParams`; con once páginas no compensa.
