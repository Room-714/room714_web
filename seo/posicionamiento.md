# Posicionamiento SEO de Room 714

Fuente de verdad para todo lo que Google lee de room714.com y para todo lo que se publique a partir de ahora: metadatos de las páginas, JSON-LD, posts existentes y generación automática de posts. Si algo de lo que se publique contradice este documento, se corrige el contenido, no el documento (salvo decisión explícita).

*Versión 1 · aprobada el 2026-09-25.*

## 1. Posicionamiento

**Room 714 es una empresa especialista en producto digital —ideación, diseño y desarrollo de software— con un foco especial en la experiencia de cliente.** Hacemos tanto el producto que usan los clientes de la empresa como el que usa su equipo interno.

- **Comprador:** CEO/DG de pyme con producto digital, CTO, directores de producto o digital, y startups/scale-ups. Sobre todo, **dueños de un producto existente que no rinde**.
- **Conversión:** sesión de diagnóstico gratuita — `/es/hablemos` · `/en/lets-talk`.
- **Idiomas:** ES y EN, con la misma estrategia (cada búsqueda EN es la equivalente de la ES).
- **Clientes y casos:** siempre anónimos. Nunca un nombre de cliente, ni en páginas ni en posts.

## 2. Clusters

| # | Cluster | Página del cluster (destino de los enlaces de los posts) | Categorías actuales del blog |
|---|---|---|---|
| 1 | **Ideación y discovery de producto digital** | Empezar de cero — `/es/empezar-de-cero` · `/en/starting-from-scratch` | PRODUCT |
| 2 | **Diseño de producto y experiencia de cliente** | Producto para tus clientes — `/es/producto-para-tus-clientes` · `/en/product-for-your-customers` | UX, DESIGN |
| 3 | **Desarrollo de software de producto** | Producto para tu equipo — `/es/producto-para-tu-equipo` · `/en/product-for-your-team` | TECH |
| — | *IA aplicada al producto* (transversal, siempre ligada a experiencia de cliente) | IA en el producto — `/es/ia-en-el-producto` · `/en/ai-in-the-product` | cualquiera |

- **El cluster no se guarda en la BD** (decisión del plan: no se cambia la arquitectura de datos). Se deriva de la categoría con la tabla de arriba y se usa en la generación de posts y en la clasificación de los existentes. Si en el futuro se quiere medir por cluster en el admin, haría falta un campo nuevo.
- **La correspondencia categoría → cluster es un punto de partida, no una regla rígida**: un post TECH sobre la experiencia del usuario final puede ser del cluster 2. La clasificación de los posts existentes (paso 3) se hace post a post.
- **Un post de IA** enlaza a la página de IA *solo* si su tema central es llevar IA al producto; si la IA es un ejemplo dentro de otro tema, enlaza a la página de su cluster.

## 3. Búsquedas objetivo

### 3.1 Fijas (las que medimos cada mes en Search Console)

Se usan tal cual. **Cada una está asignada a una sola página** (sección 4) y ningún post puede perseguirla.

| ES | EN |
|---|---|
| empresa de producto digital | digital product company |
| diseño y desarrollo de producto digital | digital product design and development |
| estudio de producto digital Madrid | digital product studio |
| desarrollo de producto digital | digital product development |
| diseño de producto digital | digital product design |
| experiencia de cliente producto digital | customer experience digital product |

### 3.2 Complementarias — **HIPÓTESIS**

Sin datos de volumen (no se inventan). Son candidatas razonables por intención de búsqueda y por el vocabulario de las propias páginas; hay que validarlas en Search Console (impresiones reales) antes de darlas por buenas. La columna *Uso* separa las que se reservan para una página de las que quedan libres para posts.

| Cluster | ES (hipótesis) | EN (hypothesis) | Uso |
|---|---|---|---|
| 1 · Ideación | validar una idea de producto digital | validate a digital product idea | posts |
| 1 · Ideación | discovery de producto digital | digital product discovery | posts |
| 1 · Ideación | definir el MVP de un producto digital | how to define an MVP | posts |
| 1 · Ideación | de idea a producto digital | from idea to digital product | página Empezar de cero |
| 2 · Diseño y CX | rediseño de onboarding | onboarding redesign | página Producto para tus clientes |
| 2 · Diseño y CX | mejorar la experiencia de cliente digital | improve digital customer experience | posts |
| 2 · Diseño y CX | reducir el abandono en el alta | reduce sign-up drop-off | posts |
| 2 · Diseño y CX | diseño del área de cliente | customer portal design | posts |
| 2 · Diseño y CX | sistema de diseño multimarca | multi-brand design system | posts |
| 3 · Desarrollo | modernizar software interno | internal software modernisation | página Producto para tu equipo |
| 3 · Desarrollo | desarrollo de back-office a medida | custom back-office development | posts |
| 3 · Desarrollo | migrar un sistema heredado sin parar la operación | legacy system migration | posts |
| 3 · Desarrollo | arquitectura de producto digital | digital product architecture | posts |
| IA (transversal) | llevar un piloto de IA a producción | AI pilot to production | página IA en el producto |
| IA (transversal) | IA en la experiencia de cliente | AI in customer experience | posts |
| IA (transversal) | modelo canónico de datos para IA | canonical data model for AI | posts |

## 4. Búsqueda → página asignada

| Búsqueda fija (ES / EN) | Página asignada | Por qué esta página |
|---|---|---|
| empresa de producto digital / digital product company | **Home** | Es la búsqueda de marca-categoría: quien la hace busca *quién* hace producto digital, y la home es la respuesta completa (qué hacemos, para quién, casos, diagnóstico). Pedido explícito del encargo. |
| diseño y desarrollo de producto digital / digital product design and development | **Home** | Es la definición completa del servicio (diseño + desarrollo), que solo la home cubre entera; las páginas de servicio cubren cada una una parte. Pedido explícito del encargo. |
| estudio de producto digital Madrid / digital product studio | **Cómo trabajamos** | Intención de "quién es y cómo trabaja el estudio": equipo senior, método, fundador, Madrid. Es la página de identidad, y así la home no carga con una tercera búsqueda. En EN la búsqueda fija no lleva ciudad; el title y la description sí dicen Madrid. |
| desarrollo de producto digital / digital product development | **Empezar de cero** | Es la única página cuyo contenido es el desarrollo de un producto de principio a fin ("de idea a producto digital en producción"). |
| diseño de producto digital / digital product design | **Producto para tus clientes** | La página trata de diseñar (rediseñar) el producto que usa el cliente final, medido en conversión y abandono: es diseño de producto digital en su sentido más buscado. |
| experiencia de cliente producto digital / customer experience digital product | **Producto para tus clientes** | La experiencia de cliente es literalmente el tema de la página, y es el foco del posicionamiento. Comparte página con "diseño de producto digital" porque ambas describen el mismo trabajo; no hay otra página que las pueda llevar sin canibalizar. |

**Reglas que se derivan:**
- Ninguna otra página ni ningún post lleva en su title una búsqueda fija asignada a otra página.
- Las páginas de caso no persiguen búsquedas fijas: viven de su long tail y enlazan a su página de servicio.
- **Riesgo conocido de canibalización:** "diseño y desarrollo de producto digital" (home), "desarrollo de producto digital" (Empezar de cero) y "diseño de producto digital" (Producto para tus clientes) comparten palabras. Mientras no exista la página pilar (sección 6), Google puede preferir la home para las tres. Lo mitigan títulos que no se pisan (tabla de abajo) y enlaces internos coherentes: los posts enlazan a la página del cluster, no a la home. Hay que vigilarlo en Search Console (qué URL sale para cada búsqueda).

## 5. Metadatos propuestos

- **Formato del title:** `<texto> | Room 714`, ≤ 60 caracteres **con** el sufijo. Hoy estas páginas usan `· Room 714` (punto medio) con `title.absolute`; se unifica a `| Room 714`, como el blog.
- **Meta description:** ≤ 155 caracteres.
- **og:title / twitter:title = title**, y **og:description / twitter:description = meta description**: ya salen automáticamente del mismo texto (helper `app/lib/seo/social.js`, desplegado hoy), así que no se proponen por separado. La home ya no dice "Estudio de Productos Digitales / Construimos productos digitales escalables…" desde el despliegue de hoy; con esta tabla pasa a expresar el posicionamiento.
- Solo cambian `<title>`, meta description y og/twitter. **Ningún texto visible cambia** (H1, titulares y cuerpo se quedan como están).
- Longitudes entre paréntesis, en caracteres.
- ⚠️ **Para validar:** "experiencia cliente" (sin "de") en el title ES de Producto para tus clientes: es la forma habitual del sector en España y la que permite que el title quepa en 60; la búsqueda completa va en la description.

| Página | Actual (title / description) | Propuesta (title / description) |
|---|---|---|
| Home · ES<br>`/es` | Room 714 · Producto digital para tus clientes y para tu equipo (62)<br><br>Mejoramos y construimos el producto digital que usan tus clientes y el que usa tu equipo. Experiencia, tecnología y negocio en el mismo equipo, medido en resultados. Madrid. (173) | **Empresa de producto digital: diseño y desarrollo \| Room 714** (59)<br><br>Empresa de producto digital en Madrid: ideación, diseño y desarrollo del producto que usan tus clientes y el que usa tu equipo. Medido en resultados. (149) |
| Home · EN<br>`/en` | Room 714 · Digital product for your customers and your team (59)<br><br>We improve and build the digital product your customers use and the one your team uses. Experience, technology and business in the same team, measured in results. Madrid. (170) | **Digital product design and development company \| Room 714** (57)<br><br>Digital product company in Madrid: ideation, design and development of the product your customers use and the one your team uses. Measured in results. (150) |
| Producto para tus clientes · ES<br>`/es/producto-para-tus-clientes` | Rediseño de onboarding, contratación y área de cliente · Room 714 (65)<br><br>Rediseñamos y construimos los flujos digitales que tus clientes usan para contratar, darse de alta y operar. Medido en conversión, abandono y ARPU. (147) | **Diseño de producto digital y experiencia cliente \| Room 714** (59)<br><br>Diseño de producto digital centrado en la experiencia de cliente: rediseñamos alta, contratación y área de cliente. Medido en conversión y abandono. (148) |
| Producto para tus clientes · EN<br>`/en/product-for-your-customers` | Onboarding, sign-up and customer area redesign · Room 714 (57)<br><br>We redesign and build the digital flows your customers use to sign up, get started and operate. Measured in conversion, drop-off and ARPU. (138) | **Digital product design and customer experience \| Room 714** (57)<br><br>Digital product design focused on customer experience: we redesign sign-up, onboarding and the customer area. Measured in conversion and drop-off. (146) |
| Producto para tu equipo · ES<br>`/es/producto-para-tu-equipo` | Modernizar software interno, back-office y dashboards · Room 714 (64)<br><br>Modernizamos y construimos las herramientas con las que opera tu empresa: back-office, dashboards, sistemas heredados. Sin parar la operación, con IA donde aporta, medido en errores y tiempo. (191) | **Modernizar software interno y back-office \| Room 714** (52)<br><br>Modernizamos el software con el que opera tu equipo: back-office, dashboards y sistemas heredados. Sin parar la operación, medido en errores y tiempo. (150) |
| Producto para tu equipo · EN<br>`/en/product-for-your-team` | Modernising internal software, back-office and dashboards · Room 714 (68)<br><br>We modernise and build the tools your company runs on: back-office, dashboards, legacy systems. Without stopping the operation, with AI where it earns its place, measured in errors and time. (190) | **Modernising internal software and back-office \| Room 714** (56)<br><br>We modernise the software your team runs on: back-office, dashboards and legacy systems. Without stopping the operation, measured in errors and time. (149) |
| IA en el producto · ES<br>`/es/ia-en-el-producto` | IA de piloto a producción dentro de tu producto · Room 714 (58)<br><br>Llevamos la IA de piloto a producción: capa semántica y modelo canónico para que no alucine, arquitectura que aplica al caso, interfaz usable y coste viable. (157) | **IA en tu producto digital: de piloto a producción \| Room 714** (60)<br><br>Llevamos la IA de piloto a producción dentro de tu producto digital: modelo canónico para que no alucine, interfaz usable y un coste viable. (140) |
| IA en el producto · EN<br>`/en/ai-in-the-product` | AI from pilot to production inside your product · Room 714 (58)<br><br>We take AI from pilot to production: semantic layer and canonical model so it doesn't hallucinate, the architecture your case actually needs, a usable interface and a viable cost. (179) | **AI in your digital product: pilot to production \| Room 714** (58)<br><br>We take AI from pilot to production inside your digital product: a canonical model so it doesn't hallucinate, a usable interface and a viable cost. (147) |
| Empezar de cero · ES<br>`/es/empezar-de-cero` | De idea a producto digital en producción · Room 714 (51)<br><br>Llevamos ideas y nuevas líneas de negocio a producto en producción. Revisamos el negocio antes de diseñar, diseñamos antes de construir y construimos sin lock-in. (162) | **Desarrollo de producto digital desde la idea \| Room 714** (55)<br><br>Desarrollo de producto digital de la idea a producción: revisamos el negocio antes de diseñar y diseñamos antes de construir. Sin lock-in. (138) |
| Empezar de cero · EN<br>`/en/starting-from-scratch` | From idea to a digital product in production · Room 714 (55)<br><br>We take ideas and new lines of business to a product in production. We review the business before designing, design before building, and build with no lock-in. (159) | **Digital product development, idea to production \| Room 714** (58)<br><br>Digital product development from idea to production: we review the business before designing and design before building. No lock-in. (132) |
| Cómo trabajamos · ES<br>`/es/como-trabajamos` | Cómo trabajamos · Room 714 (26)<br><br>Diagnóstico, diseño y arquitectura juntos, construcción por entregas y medición. Un equipo senior de producto, diseño e ingeniería dirigido por José Antonio Ces Franjo. Sin agencia, sin consultora. (197) | **Estudio de producto digital en Madrid \| Room 714** (48)<br><br>Estudio de producto digital en Madrid: diagnóstico, diseño y arquitectura juntos, entregas y medición. Equipo senior, sin agencia ni consultora. (144) |
| Cómo trabajamos · EN<br>`/en/how-we-work` | How we work · Room 714 (22)<br><br>Diagnosis, design and architecture together, delivery in increments, and measurement. A senior team of product, design and engineering led by José Antonio Ces Franjo. No agency, no consultancy. (193) | **How we work: a digital product studio in Madrid \| Room 714** (58)<br><br>A digital product studio in Madrid: diagnosis, design and architecture together, incremental delivery and measurement. Senior team, not an agency. (146) |
| Casos · ES<br>`/es/casos` | Casos · Room 714 (16)<br><br>Tres casos reales de producto digital: un SaaS B2B regulado, una plataforma B2B2C vendida vía service providers y un e-commerce con IA. Cómo empezaron, qué encontramos y qué cambió. (181) | **Casos reales de producto digital \| Room 714** (43)<br><br>Tres casos reales y anónimos de producto digital: un SaaS B2B regulado, una plataforma B2B2C y un e-commerce con IA. Qué encontramos y qué cambió. (146) |
| Casos · EN<br>`/en/cases` | Cases · Room 714 (16)<br><br>Three real digital product cases: a regulated B2B SaaS, a B2B2C platform sold through service providers, and an e-commerce with AI. How they started, what we found and what changed. (181) | **Digital product case studies \| Room 714** (39)<br><br>Three real, anonymised digital product cases: a regulated B2B SaaS, a B2B2C platform and an e-commerce with AI. What we found and what changed. (143) |
| Caso: SaaS autogestión · ES<br>`/es/casos/saas-soporte-autogestion` | Caso: el SaaS que usaba su propio soporte en lugar de sus clientes · Room 714 (77)<br><br>Cómo rediseñamos y reconstruimos un SaaS B2B regulado: de más de 200 tablas a menos de 20, clientes que se autogestionan y un margen que pasó de casi nulo a dos dígitos. Caso real anonimizado. (192) | **Caso: el SaaS B2B que vivía de su propio soporte \| Room 714** (59)<br><br>Rediseñamos y reconstruimos un SaaS B2B regulado: de más de 200 tablas a menos de 20 y clientes que se autogestionan. Caso real anonimizado. (140) |
| Caso: SaaS autogestión · EN<br>`/en/cases/saas-support-self-service` | Case: the SaaS that used its own support instead of its customers · Room 714 (76)<br><br>How we redesigned and rebuilt a regulated B2B SaaS: from over 200 tables to fewer than 20, customers who serve themselves, and a margin that went from almost nothing to double digits. Real anonymised case. (205) | **Case: the B2B SaaS that ran on its own support \| Room 714** (57)<br><br>We redesigned and rebuilt a regulated B2B SaaS: from over 200 tables to fewer than 20, and customers who serve themselves. Real anonymised case. (144) |
| Caso: activación y modelo canónico · ES<br>`/es/casos/activacion-modelo-canonico` | Caso: de un problema de activación a un modelo canónico para agentes de IA · Room 714 (85)<br><br>Plataforma B2B2C vendida vía service providers: personas y journeys, sistema de diseño multimarca, app móvil nueva, API diez veces más pequeña y modelo canónico de datos para IA agéntica. Caso real anonimizado. (210) | **Caso: de un problema de activación a IA agéntica \| Room 714** (59)<br><br>Plataforma B2B2C: journeys, sistema de diseño multimarca, app móvil nueva y modelo canónico de datos para IA agéntica. Caso real anonimizado. (141) |
| Caso: activación y modelo canónico · EN<br>`/en/cases/activation-canonical-model` | Case: from an activation problem to a canonical model for AI agents · Room 714 (78)<br><br>A B2B2C platform sold through service providers: personas and journeys, a multi-brand design system, a new mobile app, an API ten times smaller, and a canonical data model for agentic AI. Real anonymised case. (209) | **Case: from an activation problem to agentic AI \| Room 714** (57)<br><br>A B2B2C platform: journeys, a multi-brand design system, a new mobile app and a canonical data model for agentic AI. Real anonymised case. (138) |
| Caso: IA en e-commerce · ES<br>`/es/casos/ia-ecommerce-sin-tocar-la-tienda` | Caso: IA sobre un e-commerce sin tocar el e-commerce · Room 714 (63)<br><br>Plataforma autónoma de IA para un comercio online de alimentación: catálogo enriquecido, sustitutos ante roturas de stock, recompra inteligente y nutricionista virtual, sin cambiar nada en la tienda del cliente. Caso real anonimizado. (234) | **Caso: IA sobre un e-commerce sin tocar la tienda \| Room 714** (59)<br><br>IA para un e-commerce de alimentación: catálogo enriquecido, sustitutos ante roturas de stock y recompra, sin tocar la tienda. Caso anonimizado. (144) |
| Caso: IA en e-commerce · EN<br>`/en/cases/ai-ecommerce-without-touching-the-store` | Case: AI on top of an e-commerce without touching it · Room 714 (63)<br><br>A standalone AI platform for an online grocery: enriched catalogue, substitutes for stock-outs, intelligent repeat purchase and a virtual nutritionist, without changing anything in the client's store. Real anonymised case. (222) | **Case: AI on an e-commerce without touching it \| Room 714** (56)<br><br>AI for an online grocery: enriched catalogue, substitutes for stock-outs and repeat purchase, without touching the store. Real anonymised case. (143) |

**Fuera de la tabla, sin cambios:** Hablemos / Let's talk (página de conversión; su title actual ya describe la oferta, "Sesión de diagnóstico gratuita") y el índice del blog.

## 6. Pendiente para más adelante (no hacer ahora)

**Página pilar "Producto digital"** — qué es un producto digital y cómo lo hacemos en Room 714. Necesaria para posicionar la búsqueda genérica "producto digital" en 2028, que ninguna página actual puede llevar sin canibalizar la home.

- **URL propuesta:** `/es/producto-digital` · `/en/digital-product`
- **Búsqueda objetivo:** "producto digital" / "digital product" (y, como secundaria, "qué es un producto digital" / "what is a digital product").
- **Encaje:** sería el centro del que cuelgan los tres clusters; al crearla, las páginas de servicio y los posts enlazarían a ella además de a su página de cluster, y habría que revisar la asignación de la sección 4 (sobre todo "diseño y desarrollo de producto digital").
- **No se crea ahora.** Requiere contenido nuevo y una entrada en el mapa de rutas (`app/lib/routes.mjs`).
