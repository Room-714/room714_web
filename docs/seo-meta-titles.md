# Propuesta de metaTitle para los posts del blog

Generado el 2026-09-25 a partir del `<title>` que sirve cada post (`next start` en local sobre la BD de producción, solo lectura). **Nada de esto está escrito en la BD.**

- **Objetivo:** `<title>` ≤ 60 caracteres. La plantilla del layout añade ` | Room 714` (11 caracteres), así que el metaTitle debe tener **≤ 49**.
- **Longitudes:** en caracteres, **con el sufijo incluido**, que es lo que ve Google.
- **Situación:** 73 posts, 146 títulos. **119 pasan de 60** y llevan propuesta; 27 ya caben y se quedan como están (*sin cambio*: no hace falta rellenar `metaTitle`).
- **El H1 no cambia:** sigue siendo el título completo. `metaTitle` solo alimenta `<title>`, `og:title` y `twitter:title`.

## Cómo aplicarlo

El código de la rama `fix/seo-ajustes` ya lee `metaTitle ?? title`, así que sin columna todo sigue igual que hoy. Para activarlo:

1. **Primero la BD, luego el código.** Añadir el campo al schema y crear la columna antes de desplegar cualquier código que incluya el schema nuevo. Si se despliega el schema sin la columna, Prisma la pide en cada consulta a `PostTranslation` y fallan todas.

   ```prisma
   model PostTranslation {
     // …
     metaDescription  String?
     metaTitle        String? // ≤ 49 caracteres; el layout añade " | Room 714"
     // …
   }
   ```

   ```bash
   npx prisma db push   # aditiva y nullable: no toca datos existentes
   ```

   El proyecto no tiene carpeta `prisma/migrations` (se sincroniza con `db push`); si preferís migraciones versionadas, `prisma migrate dev --name post-meta-title` genera un `ALTER TABLE "PostTranslation" ADD COLUMN "metaTitle" TEXT;`.
2. Rellenar `metaTitle` solo en las filas de la tabla con propuesta (en negrita), con los textos que apruebes.
3. Sugerencia para el futuro: que el generador (`app/lib/ai/orchestrator.js`) pida también un metaTitle ≤ 49 al crear cada post, y que el editor del admin muestre el campo con su contador.

## Tabla

| # | Título ES actual | Long. | metaTitle ES propuesto | Long. | Título EN actual | Long. | metaTitle EN propuesto | Long. |
|---|---|---|---|---|---|---|---|---|
| 1 | El Problema antes del Problema: Por qué el Diagnóstico es el Diseño | 78 | **Por qué el Diagnóstico es el Diseño** | 46 | The Problem Before the Problem: Why Diagnosis Is the Real Design Work | 80 | **Why Diagnosis Is the Real Design Work** | 48 |
| 2 | Orquestación de Herramientas de IA: El Problema no es Cuántas Usas, sino Que no Sabes por Qué | 104 | **Orquestación de IA: no es Cuántas, es Por Qué** | 56 | AI Tool Orchestration: The Real Problem Isn't How Many You Use — It's That You Don't Know Why | 104 | **AI Tool Orchestration: It's Not How Many** | 51 |
| 3 | Interfaces sin Botones: Cuando la "Mejor UX" es No Ver Nada (y Por Qué Eso nos Preocupa) | 99 | **Interfaces sin Botones: la UX Invisible** | 50 | The No-Interface Illusion: Why Invisible UX Is Not the Same as Good UX | 81 | **The No-Interface Illusion: Invisible UX** | 50 |
| 4 | Agentes en Producción: Por qué tu Suite de Tests Pasa y tus Usuarios Sufren | 86 | **Agentes: Tests que Pasan, Usuarios que Sufren** | 56 | Agent Testing Theater: Why Your Test Suite Passes and Your Users Still Suffer | 88 | **Agent Testing Theater: Green Tests, Unhappy Users** | 60 |
| 5 | Dashboards que Deciden: Por qué el 90% de las Visualizaciones de Datos No Sirven para Nada | 101 | **Dashboards que Deciden (y los que No Sirven)** | 55 | Dashboards That Actually Decide: Why Most Data Visualizations Are Just Expensive Wallpaper | 101 | **Dashboards That Decide vs. Expensive Wallpaper** | 57 |
| 6 | Observabilidad de Agentes: Lo que los Logs No Te Cuentan (y Dónde Sí Está la Respuesta) | 98 | **Observabilidad de Agentes: Más allá de los Logs** | 58 | Agent Observability: What Logs Don't Tell You (and Where the Real Answer Lives) | 90 | **Agent Observability: What Logs Don't Tell You** | 56 |
| 7 | El Presupuesto de Novedad: Por qué las Interfaces que Innovan Demasiado Rápido Pierden al Usuario | 108 | **El Presupuesto de Novedad en Interfaces** | 50 | The Novelty Budget: Why Interfaces That Innovate Too Fast Lose the User | 82 | **The Novelty Budget in Interface Design** | 49 |
| 8 | Fiabilidad sin Garantías: El Problema que los Equipos de IA Ignoran hasta que el Sistema los Ignora a Ellos | 118 | **Fiabilidad sin Garantías en Sistemas de IA** | 53 | Reliability Without Guarantees: The AI Consistency Problem Teams Ignore Until It Bites Back | 102 | **Reliability Without Guarantees in AI Systems** | 55 |
| 9 | Reversibilidad: El Criterio de Diseño que Nadie Pone en el Brief (y que la IA Hace Urgente) | 102 | **Reversibilidad: el Criterio de Diseño Olvidado** | 57 | Reversibility: The Design Criterion Nobody Briefs (and That AI Makes Urgent) | 87 | **Reversibility: The Design Criterion Nobody Briefs** | 60 |
| 10 | Post-Lanzamiento: El Software Vivo no Termina, Empieza | 65 | **Post-Lanzamiento: el Software Vivo Empieza** | 53 | Post-Launch: Live Software Doesn't End, It Begins | 60 | *(sin cambio)* | — |
| 11 | Sistemas de Notificaciones: El Diseño que Grita cuando Debería Susurrar | 82 | **Sistemas de Notificaciones que Gritan** | 48 | Notification Systems: When Design Shouts Instead of Whispering | 73 | **Notification Systems: Shouting vs. Whispering** | 56 |
| 12 | Arquitectura sin Propósito: Por qué Escalar antes de Entender es el Error más Caro del Software | 106 | **Escalar antes de Entender: el Error más Caro** | 55 | Architecture Without Purpose: Why Scaling Before Understanding Is Software's Most Expensive Mistake | 110 | **Scaling Before Understanding: A Costly Mistake** | 57 |
| 13 | Accesibilidad como Deuda: Lo que tu Sistema de Diseño No Ve (y el Usuario Sí Siente) | 95 | **Accesibilidad como Deuda en tu Sistema de Diseño** | 59 | Accessibility as Debt: What Your Design System Misses and Your Users Notice | 86 | **Accessibility as Debt in Your Design System** | 54 |
| 14 | Código Barato, Ingeniería Cara: Lo que la IA le Está Haciendo a la Deuda Técnica | 91 | **Código Barato, Ingeniería Cara y Deuda Técnica** | 57 | Cheap Code, Expensive Engineering: What AI Is Really Doing to Technical Debt | 87 | **Cheap Code, Expensive Engineering: AI Tech Debt** | 58 |
| 15 | Fricción Intencionada: El Diseño que Dice No para Que el Usuario Gane | 80 | **Fricción Intencionada: el Diseño que Dice No** | 55 | Intentional Friction: Designing Resistance as a Feature, Not a Bug | 77 | **Intentional Friction: Resistance as a Feature** | 56 |
| 16 | Delegación y IA: La Pregunta de Gestión más Antigua tiene una Respuesta Nueva (y Más Peligrosa) | 106 | **Delegar en la IA: una Vieja Pregunta de Gestión** | 58 | AI Delegation: Management's Oldest Question Has a New—and Riskier—Answer | 83 | **AI Delegation: Management's Oldest Question** | 54 |
| 17 | Código Correcto, Experiencia Rota: El Fallo que el Ticket no Puede Describir | 87 | **Código Correcto, Experiencia Rota** | 44 | Technically Correct, Experientially Broken: The Bug No Ticket Can Capture | 84 | **Technically Correct, Experientially Broken** | 53 |
| 18 | Seguridad en Arquitecturas de IA: El Agujero que Nadie Audita hasta que es Demasiado Tarde | 101 | **Seguridad en Arquitecturas de IA sin Auditar** | 55 | AI Architecture Security: The Gap Nobody Audits Until It's Too Late | 78 | **AI Architecture Security: The Unaudited Gap** | 54 |
| 19 | La IA que Nadie Pidió: Cuando Añadir Inteligencia al Producto es Solo Ruido con Buena Prensa | 103 | **La IA que Nadie Pidió: Ruido con Buena Prensa** | 56 | The AI Nobody Asked For: When Adding Intelligence to Your Product Is Just Well-Branded Noise | 103 | **The AI Nobody Asked For: Well-Branded Noise** | 54 |
| 20 | El Piloto Que Nunca Escala: Por Qué los Programas de IA Empresarial Mueren entre la Demo y la Producción | 115 | **El Piloto de IA que Nunca Llega a Producción** | 55 | The Pilot That Never Scales: Why Enterprise AI Programmes Die Between Demo and Production | 100 | **The Pilot That Never Scales: Enterprise AI** | 53 |
| 21 | Accesibilidad: El Coste de Tratar como Feature lo que es Infraestructura | 83 | **Accesibilidad: Infraestructura, no Feature** | 53 | Accessibility as Infrastructure: Why Treating It Like a Feature Costs You Everything | 95 | **Accessibility Is Infrastructure, Not a Feature** | 57 |
| 22 | El Coste Oculto de las Herramientas de IA para Desarrolladores: Cuando la "Productividad" Sale Cara | 110 | **El Coste Oculto de la IA para Desarrolladores** | 56 | The Hidden Cost of AI Developer Tools: When "Productivity" Gets Expensive | 84 | **The Hidden Cost of AI Developer Tools** | 48 |
| 23 | Interfaz de IA: El Chat no es la Respuesta a Todo | 60 | *(sin cambio)* | — | AI Interface Design: Why Chat Is Not the Universal Answer | 68 | **AI Interface Design: Chat Isn't Always the Answer** | 60 |
| 24 | Sistemas que Fallan sin Romperse: El Error de Confundir Estabilidad con Resiliencia | 94 | **Fallar sin Romperse: Estabilidad vs. Resiliencia** | 59 | Systems That Fail Without Breaking: Why Stability Is Not Resilience | 78 | **Stability Is Not Resilience: Failing Gracefully** | 58 |
| 25 | Investigación de Usuario: El Activo que Muere en el Momento en que se Convierte en Entregable | 104 | **Investigación UX: un Activo, no un Entregable** | 56 | User Research: The Asset That Dies the Moment It Becomes a Deliverable | 81 | **User Research: An Asset, Not a Deliverable** | 53 |
| 26 | IA en Producción: Lo que Nadie te Cuenta cuando el Piloto ya Funciona | 80 | **IA en Producción: lo que Viene Después del Piloto** | 60 | AI in Production: The Hard Part Starts After Your Pilot Works | 72 | **AI in Production: After the Pilot Works** | 50 |
| 27 | Mejoras de UX que No Mejoran Nada: El Problema de Optimizar lo que No Importa | 88 | **Mejoras de UX que No Mejoran Nada** | 44 | UX Improvements That Improve Nothing: The Trap of Optimizing the Wrong Thing | 87 | **UX Improvements That Improve Nothing** | 47 |
| 28 | RAG no es Magia: Cómo Elegir la Arquitectura de Recuperación que tu Caso Realmente Necesita | 102 | **RAG no es Magia: Elegir la Arquitectura Correcta** | 59 | RAG Is Not Magic: Choosing the Retrieval Architecture Your Use Case Actually Needs | 93 | **RAG Is Not Magic: Choosing the Right Architecture** | 60 |
| 29 | Diseño con Incertidumbre: Por qué la IA no Elimina la Ambigüedad, la Amplifica | 89 | **La IA no Elimina la Ambigüedad: la Amplifica** | 55 | Designing Under Uncertainty: Why AI Doesn't Reduce Ambiguity — It Amplifies It | 89 | **Designing Under Uncertainty in the Age of AI** | 55 |
| 30 | El Peligro Silencioso de la IA: No es que Falle, es que Dejas de Pensar | 82 | **El Peligro Silencioso de la IA: Dejar de Pensar** | 58 | The Silent Danger of AI: Not That It Fails, But That You Stop Thinking | 81 | **The Silent Danger of AI: You Stop Thinking** | 53 |
| 31 | Economía del Comportamiento: Lo que el UX Ignora cuando Diseña para Humanos | 86 | **Economía del Comportamiento: lo que el UX Ignora** | 59 | Behavioral Economics in UX: The Hidden Friction Nobody Talks About | 77 | **Behavioral Economics in UX: The Hidden Friction** | 58 |
| 32 | Objetivos, no Herramientas: El Error de Diseño que Arruina Productos Digitales | 89 | **Objetivos, no Herramientas: el Error de Diseño** | 57 | Goals Over Tools: The Design Mistake That Sinks Digital Products | 75 | **Goals Over Tools: The Design Mistake to Avoid** | 56 |
| 33 | SaaS Bajo Asedio: Cuando tu Competencia ya No es Otro Software | 73 | **SaaS Bajo Asedio: tu Competencia no es Software** | 58 | SaaS Under Siege: When Your Real Competitors Aren't Other Apps | 73 | **SaaS Under Siege: Your Rivals Aren't Other Apps** | 58 |
| 34 | Percepción vs. Realidad: Por qué tu App de IA Parece Lenta aunque No lo Sea | 86 | **Por qué tu App de IA Parece Lenta sin Serlo** | 54 | Perceived Performance: Why Your AI App Feels Slow Even When It Isn't | 79 | **Why Your AI App Feels Slow Even When It Isn't** | 56 |
| 35 | Diseñadores en la Era de la IA: El Juicio no se Automatiza | 69 | **Diseño e IA: el Juicio no se Automatiza** | 50 | Designers in the AI Era: Judgment Is the Last Thing to Go | 68 | **Designers in the AI Era: Judgment Stays Human** | 56 |
| 36 | El Síndrome de la Herramienta Nueva: Por qué Probar Todo te Impide Construir Algo | 92 | **El Síndrome de la Herramienta Nueva en Producto** | 58 | Shiny Tool Syndrome: Why Chasing Every AI Release Kills Your Product Focus | 85 | **Shiny Tool Syndrome: Chasing Every AI Release** | 56 |
| 37 | CLAUDE.md y el Contexto como Recurso Escaso: Lo que tus Instrucciones le Cuestan al Modelo | 101 | **CLAUDE.md y el Contexto como Recurso Escaso** | 54 | CLAUDE.md Is a Budget, Not a Manual: Why Your AI Instructions Are Burning Money | 90 | **CLAUDE.md Is a Budget, Not a Manual** | 46 |
| 38 | Tu Marca Invisible: Por qué los Motores de IA No Saben que Existes aunque Google Sí | 94 | **Por qué los Motores de IA No Saben que Existes** | 57 | Your Invisible Brand: Why AI Search Engines Don't Know You Exist (Even If Google Does) | 97 | **Why AI Search Engines Don't Know You Exist** | 53 |
| 39 | UI Generativa: Cuando la Interfaz Deja de Ser un Plano y se Convierte en un Actor | 92 | **UI Generativa: cuando la Interfaz se Vuelve Actor** | 60 | Generative UI: When the Interface Stops Being a Blueprint and Starts Acting | 86 | **Generative UI: When the Interface Starts Acting** | 58 |
| 40 | El Prototipo que Miente: Por qué tus Tests de Usabilidad Están Contaminados | 86 | **Tests de Usabilidad Contaminados por el Prototipo** | 60 | The Lying Prototype: Why Your Usability Tests Are Giving You Bad Data | 80 | **The Lying Prototype: Bad Usability Test Data** | 55 |
| 41 | Construir Antes de Validar: El Error de Producto que Sigue Destruyendo Startups | 90 | **Construir Antes de Validar: el Error de Producto** | 59 | Ship First, Validate Never: The Product Mistake That Keeps Killing Startups | 86 | **Ship First, Validate Never: A Startup Killer** | 55 |
| 42 | Agentes de IA con Autonomía de Pago: Cuando el Código Empieza a Firmar Cheques | 89 | **Agentes de IA con Autonomía de Pago** | 46 | AI Agents That Spend Money: The Autonomy Nobody Budgeted For | 71 | **AI Agents That Spend Money: Unbudgeted Autonomy** | 58 |
| 43 | El ROI de UX no se Demuestra con Métricas Bonitas: Se Demuestra con Decisiones | 89 | **El ROI de UX se Demuestra con Decisiones** | 51 | UX ROI Isn't Proven with Pretty Metrics — It's Proven with Decisions | 79 | **UX ROI Is Proven with Decisions, Not Metrics** | 55 |
| 44 | Una App Grande o Treinta Pequeñas: La Matemática de Producto que Nadie Hace | 86 | **Una App Grande o Treinta Pequeñas** | 44 | One Big App or Thirty Small Ones: The Product Math Nobody Does | 73 | **One Big App or Thirty Small Ones** | 43 |
| 45 | Los Labs de IA ya no hacen IA: El Giro hacia el Runtime que Nadie Está Nombrando | 91 | **Los Labs de IA y el Giro hacia el Runtime** | 52 | AI Labs Are No Longer AI Labs: The Runtime Pivot Nobody Is Talking About | 83 | **AI Labs and the Runtime Pivot Nobody Names** | 53 |
| 46 | Local-First: La Arquitectura que le Devuelve el Control a tu Producto | 80 | **Arquitectura Local-First: Recupera el Control** | 56 | Local-First Architecture: Taking Back Control of Your Product | 72 | **Local-First Architecture: Taking Back Control** | 56 |
| 47 | Diseño con Inteligencia Emocional: La frontera después de la utilidad | 80 | **Diseño con Inteligencia Emocional** | 44 | Emotionally Intelligent Design: The Frontier Beyond Utility | 70 | **Emotionally Intelligent Design: Beyond Utility** | 57 |
| 48 | El Modelo Canónico: Que no "alucine" tu IA | 53 | *(sin cambio)* | — | The Canonical Model: Stop Hallucinating | 50 | *(sin cambio)* | — |
| 49 | El fin del "User-Centric": Hacia un Diseño de Ecosistemas | 68 | **Del "User-Centric" al Diseño de Ecosistemas** | 54 | The End of "User-Centric": Toward Ecosystem Design | 61 | **From "User-Centric" to Ecosystem Design** | 50 |
| 50 | Bento Grids: Cómo dar orden al caos de datos de la IA | 64 | **Bento Grids: Orden para los Datos de la IA** | 53 | Bento Grids: Bringing Order to AI Data Chaos | 55 | *(sin cambio)* | — |
| 51 | El equilibrio vital entre Estética y Usabilidad | 58 | *(sin cambio)* | — | The Vital Balance Between Aesthetics and Usability | 61 | **Balancing Aesthetics and Usability** | 45 |
| 52 | El "Clasismo" del Software: El Cliente gana al Empleado | 66 | **El "Clasismo" del Software: Cliente vs. Empleado** | 59 | Software "Classism": The Customer wins over the Employee | 67 | **Software "Classism": Customer vs. Employee** | 53 |
| 53 | Micro-interacciones: Diseñando la confianza en la IA | 63 | **Micro-interacciones que Generan Confianza en IA** | 58 | Micro-interactions: Designing Trust in AI | 52 | *(sin cambio)* | — |
| 54 | Interfaces Adaptativas: El fin del diseño "talla única" | 66 | **Interfaces Adaptativas: Adiós a la "Talla Única"** | 59 | Adaptive Interfaces: The End of "One-Size-Fits-All" Design | 69 | **Adaptive Interfaces Beyond "One-Size-Fits-All"** | 57 |
| 55 | El infierno de la Usabilidad: Cuando ni Apple se salva | 65 | **El Infierno de la Usabilidad: Ni Apple se Salva** | 58 | Usability Hell: When Even Apple Doesn’t Make the Cut | 63 | **Usability Hell: Not Even Apple Gets It Right** | 55 |
| 56 | Product-Led Growth (PLG) + IA: El producto que se vende solo | 71 | **PLG + IA: el Producto que se Vende Solo** | 50 | AI-Powered Product-Led Growth (PLG): The product that sells itself | 77 | **AI-Powered PLG: The Product That Sells Itself** | 56 |
| 57 | El fin de la frontera: el paradigma Full-stack | 57 | *(sin cambio)* | — | The End of the Border: The Full-stack Paradigm | 57 | *(sin cambio)* | — |
| 58 | Visual Density: El retorno del detalle y la precisión | 64 | **Visual Density: el Retorno del Detalle** | 49 | Visual Density: The Return of Detail and Precision | 61 | **Visual Density: The Return of Detail** | 47 |
| 59 | La IA no se cansa en el kilómetro 42 | 47 | *(sin cambio)* | — | AI doesn’t get tired at mile 26 | 42 | *(sin cambio)* | — |
| 60 | El ocaso de WordPress | 32 | *(sin cambio)* | — | The Twilight of WordPress | 36 | *(sin cambio)* | — |
| 61 | De programadores de sintaxis a Ingenieros de Flujos | 62 | **De Programar Sintaxis a Ingeniería de Flujos** | 55 | From Syntax Programmers to Flow Engineers | 52 | *(sin cambio)* | — |
| 62 | Business-First Intelligence: La IA como estrategia de negocio | 72 | **Business-First: la IA como Estrategia de Negocio** | 59 | Business-First Intelligence: AI as a Business Strategist | 67 | **Business-First Intelligence: AI as Strategy** | 54 |
| 63 | Anticipatory UX: Eliminando la carga de decisión | 59 | *(sin cambio)* | — | Anticipatory UX: Removing the Decision Burden | 56 | *(sin cambio)* | — |
| 64 | Unbundling: El poder de la especialización | 53 | *(sin cambio)* | — | Unbundling: The power of specialization | 50 | *(sin cambio)* | — |
| 65 | Bionic Design: Interfaces que respiran con el usuario | 64 | **Bionic Design: Interfaces que Respiran** | 49 | Bionic Design: Interfaces that Breathe with the User | 63 | **Bionic Design: Interfaces That Breathe** | 49 |
| 66 | Monorepos: La columna vertebral de la agilidad moderna | 65 | **Monorepos: la Columna Vertebral de la Agilidad** | 57 | Monorepos: The Backbone of Modern Agility | 52 | *(sin cambio)* | — |
| 67 | La trampa de la "Escucha Activa": Feedback vs Visión | 63 | **La Trampa de la "Escucha Activa" en Producto** | 55 | The "Active Listening" Trap: Balancing Feedback and Vision | 69 | **The "Active Listening" Trap: Feedback vs. Vision** | 59 |
| 68 | La navaja de Ockham en UX: El diseño no es un fin, es un medio | 73 | **Navaja de Ockham en UX: el Diseño es un Medio** | 56 | Ockham’s Razor in UX: Design is a means, not an end | 62 | **Ockham’s Razor in UX: Design Is a Means** | 50 |
| 69 | Astro y Fastify: La ingeniería de la eficiencia radical | 66 | **Astro y Fastify: Ingeniería de Eficiencia Radical** | 60 | Astro and Fastify: The Engineering of Radical Efficiency | 67 | **Astro and Fastify: Radical Efficiency** | 48 |
| 70 | El fin de la "demo" como barrera de entrada | 54 | *(sin cambio)* | — | The end of the "demo" as a barrier to entry | 54 | *(sin cambio)* | — |
| 71 | El diseño como antídoto a la fatiga cognitiva | 56 | *(sin cambio)* | — | Design as an antidote to cognitive fatigue | 53 | *(sin cambio)* | — |
| 72 | La fricción es un impuesto al beneficio | 50 | *(sin cambio)* | — | Friction: The invisible tax on profit | 48 | *(sin cambio)* | — |
| 73 | ¿Estás sentado en una mina de oro? | 45 | *(sin cambio)* | — | Are you sitting on a gold mine? | 42 | *(sin cambio)* | — |
