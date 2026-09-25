# Cierres SEO (propuesta)

*2026-09-25 · **aprobado**. La BD se actualiza con `scripts/seo-aplicar-cierres.mjs`.*

Continúa [posicionamiento.md](posicionamiento.md) y [posts-clusters.md](posts-clusters.md). Datos leídos de la BD con Prisma en solo lectura, **después** de aplicar la pasada anterior.

## 1. Los 30 posts sin cluster

**Reevaluación.** 4 de los 15 cuelgan de forma honesta del cluster **IA aplicada al producto**: su cierre ya habla de llevar IA o agentes a producción dentro de un producto o una operación. Los otros 11 siguen sin cluster: tratan de herramientas del desarrollador, oficio y carrera, marketing o estrategia de mercado, y enlazarlos a una página de servicio sería forzado.

| # | Post | Decisión | Por qué |
|---|---|---|---|
| 2 | Orquestación de herramientas de IA | **IA** | El cierre habla de "tu pipeline de IA" y de pasar a "una arquitectura construida por decisión". |
| 16 | Delegación y IA | **IA** | El cierre ofrece "trazar la frontera entre lo que debe automatizarse y lo que debe mantenerse humano". |
| 42 | Agentes de IA con autonomía de pago | **IA** | El cierre habla de "arquitecturas agénticas para tu operación". |
| 45 | Los labs de IA y el runtime | **IA** | El cierre habla de "integrar agentes o flujos automatizados en tu producto sin ceder el control". |
| 22 | Coste oculto de herramientas de IA para desarrolladores | ninguno | Productividad del equipo técnico, no el producto del cliente. |
| 30 | El peligro silencioso de la IA | ninguno | Reflexión general sobre criterio. |
| 33 | SaaS bajo asedio | ninguno | Estrategia de mercado; encajaría a la fuerza. |
| 35 | Diseñadores en la era de la IA | ninguno | Oficio del diseñador. |
| 36 | Síndrome de la herramienta nueva | ninguno | Disciplina del equipo. |
| 37 | CLAUDE.md | ninguno | Herramienta de desarrollo. |
| 38 | Tu marca invisible | ninguno | Marketing en buscadores de IA. |
| 57 | Paradigma full-stack | ninguno | Organización de equipos técnicos. |
| 61 | De programadores de sintaxis a ingenieros de flujos | ninguno | Carrera profesional. |
| 66 | Monorepos | ninguno | Herramienta de desarrollo. |
| 69 | Astro y Fastify | ninguno | Tecnología concreta. |

**Metadatos para los 30** (encajen o no). metaTitle ≤ 60 con ` | Room 714`, metaDescription ≤ 155, orientados a la búsqueda del tema y **sin ninguna búsqueda reservada** (comprobado por script contra `app/lib/seo/clusters.js`). El H1 no cambia.

| # | Slug | Title actual (long.) | metaTitle propuesto | metaDescription propuesta |
|---|---|---|---|---|
| 2 · ES | `orquestacion-herramientas-ia-problema-no-es-cuantas-usas` | Orquestación de Herramientas de IA: El Problema no es Cuántas Usas, sino Que no Sabes por Qué (104) | **Orquestación de herramientas de IA en tu stack** (57) | Tres a seis herramientas de IA encadenadas no son una arquitectura. Cómo pasar de un stack construido por inercia a un pipeline decidido y gobernable. (150) |
| 2 · EN | `ai-tool-orchestration-problem-not-how-many-you-use` | AI Tool Orchestration: The Real Problem Isn't How Many You Use — It's That You Don't Know Why (104) | **AI tool orchestration: fix your stack** (48) | Three to six chained AI tools are not an architecture. How to move from a stack built by inertia to a pipeline that is designed and governable. (143) |
| 16 · ES | `delegacion-ia-la-pregunta-de-gestion-mas-antigua-tiene-respuesta-nueva` | Delegación y IA: La Pregunta de Gestión más Antigua tiene una Respuesta Nueva (y Más Peligrosa) (106) | **Qué delegar en la IA y qué mantener humano** (53) | El modelo clásico de delegación no sirve con IA. Qué delegar, qué desaparece al hacerlo y dónde trazar la frontera entre lo automático y lo humano. (147) |
| 16 · EN | `ai-delegation-managements-oldest-question-new-riskier-answer` | AI Delegation: Management's Oldest Question Has a New—and Riskier—Answer (83) | **What to delegate to AI and what to keep human** (56) | The classic delegation model breaks with AI. Which tasks to delegate, which disappear when you do, and where to draw the line between automated and human. (154) |
| 22 · EN | `hidden-cost-ai-developer-tools-productivity-trap` | The Hidden Cost of AI Developer Tools: When "Productivity" Gets Expensive (84) | **The hidden cost of AI developer tools** (48) | Tokens, context windows and fast obsolescence: what AI developer tools really cost, and how to audit them before the bill grows. (128) |
| 22 · ES | `coste-oculto-herramientas-ia-para-desarrolladores` | El Coste Oculto de las Herramientas de IA para Desarrolladores: Cuando la "Productividad" Sale Cara (110) | **Coste oculto de la IA para desarrolladores** (53) | Tokens, contexto y obsolescencia acelerada: lo que cuestan las herramientas de IA para desarrollo y cómo auditarlas antes de que crezca la factura. (147) |
| 30 · ES | `el-peligro-silencioso-de-la-ia-dejas-de-pensar` | El Peligro Silencioso de la IA: No es que Falle, es que Dejas de Pensar (82) | **El riesgo de dejar de pensar al usar IA** (50) | El peligro de la IA no es que falle, es que deja de ejercitar tu criterio. Qué es la soberanía cognitiva y cómo usar IA sin cederle el juicio. (142) |
| 30 · EN | `the-silent-danger-of-ai-you-stop-thinking` | The Silent Danger of AI: Not That It Fails, But That You Stop Thinking (81) | **The risk of AI making you stop thinking** (50) | The danger of AI is not that it fails but that you stop exercising judgment. What cognitive sovereignty means and how to use AI without giving it up. (149) |
| 33 · ES | `saas-bajo-asedio-cuando-tu-competencia-no-es-otro-software` | SaaS Bajo Asedio: Cuando tu Competencia ya No es Otro Software (73) | **SaaS frente a la IA: cómo defender tu producto** (57) | Tu competencia ya no es otro SaaS, es un modelo de lenguaje con el prompt adecuado. Qué parte de tu propuesta de valor es replicable y cuál es defendible. (154) |
| 33 · EN | `saas-under-siege-when-your-real-competitors-arent-other-apps` | SaaS Under Siege: When Your Real Competitors Aren't Other Apps (73) | **SaaS versus AI: how to defend your product** (53) | Your competition is no longer another SaaS but a language model with the right prompt. Which part of your value proposition is replicable and which is not. (155) |
| 35 · ES | `disenadores-en-la-era-de-la-ia-el-juicio-no-se-automatiza` | Diseñadores en la Era de la IA: El Juicio no se Automatiza (69) | **Diseñadores e IA: el criterio no se automatiza** (57) | La IA ya ejecuta buena parte del trabajo de diseño. Lo que eso revela sobre el oficio y por qué el criterio es el músculo que hay que entrenar ahora. (149) |
| 35 · EN | `designers-in-the-ai-era-judgment-is-the-last-thing-to-go` | Designers in the AI Era: Judgment Is the Last Thing to Go (68) | **Designers and AI: judgment can't be automated** (56) | AI already executes a large part of design work. What that reveals about the craft, and why judgment is the muscle to train now. (128) |
| 36 · EN | `shiny-tool-syndrome-why-chasing-every-ai-release-kills-your-product` | Shiny Tool Syndrome: Why Chasing Every AI Release Kills Your Product Focus (85) | **Shiny tool syndrome: getting product focus back** (58) | Trying every new tool looks diligent and drains focus. Three criteria to decide what to adopt and what to ignore without slowing the product down. (146) |
| 36 · ES | `el-sindrome-de-la-herramienta-nueva-probar-todo-te-impide-construir` | El Síndrome de la Herramienta Nueva: Por qué Probar Todo te Impide Construir Algo (92) | **El síndrome de la herramienta nueva en producto** (58) | Probar cada herramienta nueva parece diligencia y es un agujero de foco. Tres criterios para decidir qué adoptar y qué ignorar sin frenar el producto. (150) |
| 37 · ES | `claude-md-el-contexto-como-recurso-escaso` | CLAUDE.md y el Contexto como Recurso Escaso: Lo que tus Instrucciones le Cuestan al Modelo (101) | **CLAUDE.md: el contexto como recurso escaso** (53) | Cada instrucción de tu CLAUDE.md consume contexto y cambia el comportamiento del modelo. Por qué menos instrucciones funcionan mejor y cómo escribirlas. (152) |
| 37 · EN | `claude-md-context-as-a-scarce-resource` | CLAUDE.md Is a Budget, Not a Manual: Why Your AI Instructions Are Burning Money (90) | **CLAUDE.md: context as a scarce resource** (50) | Every instruction in your CLAUDE.md consumes context and shifts the model's behaviour. Why fewer instructions work better and how to write them. (144) |
| 38 · ES | `tu-marca-invisible-los-motores-de-ia-no-saben-que-existes` | Tu Marca Invisible: Por qué los Motores de IA No Saben que Existes aunque Google Sí (94) | **Visibilidad de marca en buscadores de IA** (51) | Google te encuentra, pero los motores de IA no saben que existes. Cómo deciden los LLMs quién existe y qué puedes hacer para aparecer en sus respuestas. (152) |
| 38 · EN | `your-invisible-brand-why-ai-search-engines-dont-know-you-exist` | Your Invisible Brand: Why AI Search Engines Don't Know You Exist (Even If Google Does) (97) | **Brand visibility in AI search engines** (48) | Google finds you, but AI search engines don't know you exist. How LLMs decide who exists and what you can do to show up in their answers. (137) |
| 42 · ES | `agentes-de-ia-con-autonomia-de-pago-cuando-el-codigo-firma-cheques` | Agentes de IA con Autonomía de Pago: Cuando el Código Empieza a Firmar Cheques (89) | **Agentes de IA que pagan: autonomía con perímetro** (59) | Los agentes de IA empiezan a mover dinero real. Por qué la autonomía necesita un perímetro de decisión, scopes por tarea y rollback antes de tocar una API. (155) |
| 42 · EN | `ai-agents-that-spend-money-the-autonomy-nobody-budgeted-for` | AI Agents That Spend Money: The Autonomy Nobody Budgeted For (71) | **AI agents that pay: autonomy with a perimeter** (56) | AI agents are starting to move real money. Why autonomy needs a decision perimeter, per-task scopes and rollback before touching any API. (137) |
| 45 · ES | `los-labs-de-ia-ya-no-hacen-ia-el-giro-hacia-el-runtime` | Los Labs de IA ya no hacen IA: El Giro hacia el Runtime que Nadie Está Nombrando (91) | **Del modelo al runtime: el nuevo lock-in de la IA** (59) | Los laboratorios de IA ya no venden modelos, venden el runtime donde operan. Qué cedes al construir sobre él y cómo diseñar una orquestación portable. (150) |
| 45 · EN | `ai-labs-no-longer-ai-labs-the-runtime-pivot` | AI Labs Are No Longer AI Labs: The Runtime Pivot Nobody Is Talking About (83) | **From model to runtime: AI's new lock-in** (50) | AI labs no longer sell models but the runtime they run on. What you give up by building on it and how to design a portable orchestration. (137) |
| 57 · ES | `el-fin-de-la-frontera-el-paradigma-full-stack` | El fin de la frontera: el paradigma Full-stack (57) | **El paradigma full-stack sin perder arquitectura** (58) | La frontera entre frontend y backend se difumina. Por qué compartir repositorio no significa eliminar la arquitectura y cómo ganar eficiencia sin caos. (151) · *hoy sin description* |
| 57 · EN | `the-end-of-the-border-the-full-stack-paradigm` | The End of the Border: The Full-stack Paradigm (57) | **Full-stack without losing the architecture** (53) | The line between frontend and backend is blurring. Why sharing a repository doesn't mean dropping architecture, and how to gain efficiency without chaos. (153) · *hoy sin description* |
| 61 · ES | `de-programadores-de-sintaxis-a-ingenieros-de-flujos` | De programadores de sintaxis a Ingenieros de Flujos (62) | **De programar sintaxis a orquestar flujos** (51) | El valor del desarrollador pasa de escribir sintaxis a orquestar flujos con IA. Qué cambia en el oficio y qué habilidades pasan a importar más. (143) · *hoy sin description* |
| 61 · EN | `from-syntax-programmers-to-flow-engineers` | From Syntax Programmers to Flow Engineers (52) | **From writing syntax to orchestrating flows** (53) | The developer's value is shifting from writing syntax to orchestrating AI-assisted flows. What changes in the craft and which skills now matter most. (149) · *hoy sin description* |
| 66 · ES | `monorepos-la-columna-vertebral-de-la-agilidad-moderna` | Monorepos: La columna vertebral de la agilidad moderna (65) | **Monorepos con Turborepo: agilidad sin caos** (53) | Un monorepo bien gestionado con Turborepo acelera a los equipos que comparten código. Cuándo compensa, cómo se organiza y qué problemas evita. (142) · *hoy sin description* |
| 66 · EN | `monorepos-the-backbone-of-modern-agility` | Monorepos: The Backbone of Modern Agility (52) | **Monorepos with Turborepo: agility without chaos** (58) | A well-managed monorepo with Turborepo speeds up teams that share code. When it pays off, how to organise it and which problems it prevents. (140) · *hoy sin description* |
| 69 · ES | `astro-y-fastify-la-ingenieria-de-la-eficiencia-radical` | Astro y Fastify: La ingeniería de la eficiencia radical (66) | **Astro y Fastify: webs ligeras y backends rápidos** (59) | Astro para una web que no pesa y Fastify para un backend de alta carga. Por qué esta combinación da eficiencia radical y cuándo tiene sentido elegirla. (151) · *hoy sin description* |
| 69 · EN | `astro-and-fastify-the-engineering-of-radical-efficiency` | Astro and Fastify: The Engineering of Radical Efficiency (67) | **Astro and Fastify: light sites, fast backends** (56) | Astro for a site that weighs nothing and Fastify for a high-load backend. Why the pair delivers radical efficiency and when it makes sense to choose it. (152) · *hoy sin description* |

## 2. Enlaces a casos

Hoy ninguna traducción enlaza a un caso. Coincidencias claras, **una por post**, en un párrafo del cuerpo que trata ese tema (nunca el último, que es donde va el enlace al cluster, ni un elemento de lista). Sin nombres de clientes.

| Caso | Posts |
|---|---|
| SaaS autogestión (`/es/casos/saas-soporte-autogestion`) | 56 PLG con IA (flujos de rescate sin soporte), 70 fin de la demo (time to value) |
| Activación y modelo canónico (`/es/casos/activacion-modelo-canonico`) | 48 modelo canónico |
| IA sobre e-commerce (`/es/casos/ia-ecommerce-sin-tocar-la-tienda`) | 19 la IA que nadie pidió (integración en flujos existentes), 28 RAG |

**Descartados por dudosos:** 49 (diseño de ecosistemas: menciona el modelo de datos de pasada) y 42 (agentes que pagan: el cuerpo no trata de APIs ni de modelo de datos; solo el cierre, que ya lleva el enlace al cluster).

## Enlaces nuevos (puntos 1 y 2)

La columna final muestra el final del párrafo actual (texto plano) y, en negrita, la frase que se añadiría al final de ese párrafo.

| # | Tipo | Destino | Párrafo | Final del párrafo ➕ frase nueva |
|---|---|---|---|---|
| 2 · ES | cluster IA | `/es/ia-en-el-producto` | último | …ién hace qué en tu sistema, es una conversación que vale la pena tener antes de añadir la próxima herramienta. **➕ Es la misma disciplina con la que [llevamos la IA a producción dentro de un producto](/es/ia-en-el-producto): cada pieza, con un porqué.** |
| 2 · EN | cluster IA | `/en/ai-in-the-product` | último | …'t clearly answer who does what in your system, it's a conversation worth having before you add the next tool. **➕ It is the same discipline we apply when [taking AI to production inside a product](/en/ai-in-the-product): every piece with a reason.** |
| 16 · ES | cluster IA | `/es/ia-en-el-producto` | último | …o. No como una postura ideológica, sino como una decisión estratégica con consecuencias medibles a doce meses. **➕ Es la primera frontera que trazamos al [llevar la IA de piloto a producción](/es/ia-en-el-producto).** |
| 16 · EN | cluster IA | `/en/ai-in-the-product` | último | …man. Not as an ideological stance, but as a strategic decision with measurable consequences twelve months out. **➕ It is the first line we draw when [taking AI from pilot to production](/en/ai-in-the-product).** |
| 19 · ES | caso | `/es/casos/ia-ecommerce-sin-tocar-la-tienda` | 22º de 34 | …io ya estaba tomando una decisión, y la IA redujo el coste cognitivo de esa decisión. Eso es integración real. **➕ Es el enfoque de [una IA para un e-commerce de alimentación que no obligó a tocar la tienda](/es/casos/ia-ecommerce-sin-tocar-la-tienda).** |
| 19 · EN | caso | `/en/cases/ai-ecommerce-without-touching-the-store` | 22º de 34 | …er was already making a decision, and AI reduced the cognitive cost of that decision. That's real integration. **➕ It is the approach behind [an AI for an online grocery that didn't require touching the store](/en/cases/ai-ecommerce-without-touching-the-store).** |
| 28 · ES | caso | `/es/casos/ia-ecommerce-sin-tocar-la-tienda` | 6º de 35 | …ntos "más parecidos semánticamente" a la pregunta, pero no los fragmentos que realmente responden la pregunta. **➕ Lo vimos de cerca en [un caso de IA sobre un e-commerce sin tocar la tienda](/es/casos/ia-ecommerce-sin-tocar-la-tienda).** |
| 28 · EN | caso | `/en/cases/ai-ecommerce-without-touching-the-store` | 6º de 35 | …t retrieves fragments "most semantically similar" to the query, but not the fragments that actually answer it. **➕ We saw it up close in [a case of AI on top of an e-commerce without touching the store](/en/cases/ai-ecommerce-without-touching-the-store).** |
| 42 · ES | cluster IA | `/es/ia-en-el-producto` | último | …a API. La autonomía sin perímetro no es una ventaja competitiva: es un riesgo que todavía no has cuantificado. **➕ Ese perímetro es parte de cómo [llevamos la IA de piloto a producción](/es/ia-en-el-producto).** |
| 42 · EN | cluster IA | `/en/ai-in-the-product` | último | … any API. Autonomy without a perimeter isn't a competitive advantage — it's a risk you haven't quantified yet. **➕ That perimeter is part of how [we take AI from pilot to production](/en/ai-in-the-product).** |
| 45 · ES | cluster IA | `/es/ia-en-el-producto` | último | …nemos en Room 714. Antes de construir sobre el runtime de otro, conviene saber exactamente qué estás cediendo. **➕ Es una de las decisiones de arquitectura que tomamos al [llevar la IA a producción dentro de un producto](/es/ia-en-el-producto).** |
| 45 · EN | cluster IA | `/en/ai-in-the-product` | último | …e at Room 714. Before you build on someone else's runtime, it's worth knowing precisely what you're giving up. **➕ It is one of the architecture decisions we make when [taking AI to production inside a product](/en/ai-in-the-product).** |
| 48 · ES | caso | `/es/casos/activacion-modelo-canonico` | 4º de 7 | …mas deben estar de acuerdo en los conceptos básicos. La coherencia de datos es el combustible de la precisión. **➕ Es el mismo principio que aplicamos en [una plataforma B2B2C que pasó de un problema de activación a un modelo canónico para agentes de IA](/es/casos/activacion-modelo-canonico).** |
| 48 · EN | caso | `/en/cases/activation-canonical-model` | 4º de 7 | … product usage data, all those systems must agree on basic concepts. Data coherence is the fuel for precision. **➕ It is the same principle we applied in [a B2B2C platform that went from an activation problem to a canonical model for AI agents](/en/cases/activation-canonical-model).** |
| 56 · ES | caso | `/es/casos/saas-soporte-autogestion` | 5º de 8 | …eso automáticamente. El producto no solo espera a ser usado; guía proactivamente al usuario hacia la victoria. **➕ Es lo que hicimos en [un SaaS B2B que dependía de su propio soporte](/es/casos/saas-soporte-autogestion): que el cliente pudiera resolver solo.** |
| 56 · EN | caso | `/en/cases/saas-support-self-service` | 5º de 8 | …rocess automatically. The product doesn't just wait to be used; it proactively guides the user toward victory. **➕ It is what we did for [a B2B SaaS that depended on its own support team](/en/cases/saas-support-self-service): let customers solve things on their own.** |
| 70 · ES | caso | `/es/casos/saas-soporte-autogestion` | 3º de 8 | …e tres semanas para mostrar su valor real, tienes un problema de diseño de producto, no un problema de ventas. **➕ Es el mismo problema que resolvimos en [un SaaS B2B que vivía de su propio soporte](/es/casos/saas-soporte-autogestion).** |
| 70 · EN | caso | `/en/cases/saas-support-self-service` | 3º de 8 | …res three weeks of consultancy to show its real worth, you have a product design problem, not a sales problem. **➕ It is the same problem we solved for [a B2B SaaS that lived on its own support](/en/cases/saas-support-self-service).** |

## 3. Metadatos del blog y detalles (código)

| Página | Hoy | Propuesta |
|---|---|---|
| `/es/blog` | Blog — Ideas sobre Producto Digital, UX y Tecnología \| Room 714 (63); og:title sin sufijo | **Blog de producto digital y experiencia de cliente \| Room 714** (60); og:title y twitter:title idénticos |
| `/en/blog` | Blog — Insights on Digital Product, UX & Technology \| Room 714 (62); og:title sin sufijo | **Blog on digital product and customer experience \| Room 714** (58); og:title y twitter:title idénticos |
| `/es/blog` description | Artículos sobre estrategia de producto, diseño UX, desarrollo de software y transformación digital de Room 714. | Artículos de Room 714 sobre cómo idear, diseñar y desarrollar producto digital con foco en la experiencia de cliente. Opinión práctica, sin humo. |
| `/en/blog` description | Articles on product strategy, UX design, software development, and digital transformation by Room 714. | Room 714 articles on ideating, designing and building digital products, with a focus on customer experience. Practical opinion, no hype. |
| `/es/hablemos` | Sesión de diagnóstico gratuita · Room 714 | Sesión de diagnóstico gratuita \| Room 714 |
| `/en/lets-talk` | Free diagnostic session · Room 714 | Free diagnostic session \| Room 714 |
| 404 dentro del sitio (post, categoría) | **El title de la home** en el HTML del servidor | Página no encontrada \| Room 714 · Page not found \| Room 714; el `noindex` se mantiene |

**Cómo se consigue el title de la 404, y por qué así.** Lo he comprobado en local antes de proponerlo:

- Cuando una página llama a `notFound()`, Next descarta sus metadatos y usa los del layout. Por eso la 404 de un post sale hoy con el title de la home: es el `title.default` del layout. Devolver un title de 404 desde `generateMetadata` del post **no funciona** (probado: sigue saliendo el de la home).
- `not-found.js` no admite `metadata` (solo el experimental `global-not-found.js`, que no pasa por el layout).
- **Propuesta:** el `title.default` del layout pasa a ser el de la 404. Todas las páginas del sitio declaran su propio title (la home incluida), así que ese valor solo lo ven las 404. Lo verificaré recorriendo el sitemap entero: ninguna URL real debe salir con "Página no encontrada".
- **Lo visible no cambia:** la 404 sigue mostrando "404 · This page could not be found." (el componente por defecto de Next).

**Rutas que no existen (decidido: no se añade ruta comodín).** Una URL que no existe como ruta (p. ej. `/es/no-existe`) no pasa por el layout y sigue con el title por defecto de Next, "404: This page could not be found.". Arreglarlo exigía una ruta `app/[lang]/[...resto]/page.js` que solo llamara a `notFound()`. No se añade: una 404 no se indexa, así que su title apenas pesa en SEO, y la ruta haría que cada URL inventada (bots, escaneos) ejecutara el render completo del sitio en lugar de la 404 estática.

## Aplicación (tras el OK)

- **BD (puntos 1 y 2):** script idempotente en `scripts/`, dry-run por defecto, que ejecutas tú. Lee `seo/cierres.data.json`: fija metaTitle/metaDescription, añade la frase del cluster al final del último párrafo y la del caso al final de su párrafo, **solo si el párrafo sigue igual que en esta propuesta** y el post no enlaza ya a ese destino. Copia de seguridad antes de escribir y `--revertir`.
- **Código (punto 3):** `app/[lang]/blog/page.js`, `app/dictionaries/{es,en}.json` (`contact.seo.title`) y `app/[lang]/layout.js` (`title.default`).
