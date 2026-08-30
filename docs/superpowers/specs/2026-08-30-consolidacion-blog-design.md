# Consolidación del blog: 34 artículos cortos hacia 18 destinos

Fecha: 2026-08-30
Estado: aprobado, pendiente de plan de implementación

## Problema

De los 98 artículos publicados, **76 son de la fase corta** del blog: media de 2.785 caracteres, unas 430 palabras. Los 22 restantes siguen la pauta editorial actual, con una media de 11.768 caracteres. El último corto es del 10 de junio de 2026, así que el cambio de pauta funcionó y todo lo posterior es largo.

El problema no es que los cortos sean cortos. Es que **se solapan entre sí**. Hay grupos de hasta seis artículos discutiendo la misma tesis con distinto título, publicados a veces con días de diferencia:

- «Aplicando el factor Sentidiño» y «Menos manuales, más sentido común» — **el mismo día**, 1.208 y 1.424 caracteres, la misma idea.
- «La IA no tiene nervios» y «La IA no se cansa en el kilómetro 42» — **cuatro días de diferencia**, el mismo argumento.
- «Invertir en un mundo que caduca cada martes» y «El Efecto Google» — **siete días**, comentando el mismo anuncio de Google.

Google lo está viendo. En Search Console, de 310 páginas conocidas hay **98 indexadas y 212 sin indexar**, y de esas 212:

- **114 «Descubierta: actualmente sin indexar»** — confirmado abriendo la lista: son las páginas en inglés.
- **18 «Rastreada: actualmente sin indexar»** — peor señal: Google fue, leyó y decidió que no.
- 2 «Duplicada: el usuario no ha indicado ninguna versión canónica», y una de ellas es exactamente uno de estos cortos, plegado dentro del artículo largo que cubre el mismo tema mejor.

El resto (35 redirecciones, 34 bloqueadas por robots.txt, 6 con `noindex`) son diseño funcionando y no forman parte de este problema.

## Objetivo

Que cada tema tenga **una sola página** compitiendo por él, en vez de dos a seis canibalizándose.

## Decisiones tomadas

1. **Redirigir, no fusionar.** El corto desaparece y su URL emite un 301 al destino. No se edita el texto del destino. Es lo mismo que se hizo en las 28 consolidaciones anteriores (junio de 2026), y en este caso pierde poco: los cortos son de 430 palabras y el destino de 1.800 sobre el mismo tema.
2. **En los grupos sin artículo largo, gana el mejor del grupo.** Es un paso intermedio declarado, no el destino final: el superviviente sigue siendo corto. Cuando el generador escriba un largo del tema, ese superviviente se redirige también.
3. **Barrido completo de los 76**, no solo de los casos evidentes. Riesgo asumido conscientemente: sin datos de Search Console no sabemos cuáles reciben visitas. Mitigación real: el 301 conserva la señal, así que el tráfico va al destino en vez de perderse.
4. **Las dos parejas de artículos largos que se solapan NO se tocan** en esta pasada. Ver *Fuera de alcance*.

## El mapa

34 orígenes hacia 18 destinos. **Verificado contra la base de producción el 2026-08-30**: los 52 slugs existen, y ningún origen es a la vez destino de otro grupo (no se crean cadenas de redirección).

Cada fila produce **dos** redirecciones, una en español y otra en inglés, porque cada artículo es un `Post` con dos `PostTranslation`. Total: **68 filas de `PostRedirect`**.

### Grupos con un artículo largo que ya cubre el tema

| Destino | Origen |
|---|---|
| `codigo-barato-ingenieria-cara-ia-deuda-tecnica` (11.869) | `ingenieria-de-precision-no-fabricas-de-codigo` |
| | `tu-codigo-es-un-activo-o-una-deuda-pendiente` |
| `seguridad-arquitecturas-ia-el-agujero-que-nadie-audita` (14.083) | `product-led-governance-la-seguridad-como-feature-no-como-freno` |
| | `seguridad-en-ia-el-neutron-que-tumba-la-muralla` |
| `rag-no-es-magia-como-elegir-arquitectura-de-recuperacion` (13.601) | `data-flywheels-el-motor-secreto-de-la-ia` |
| | `graphrag-de-la-busqueda-de-textos-a-la-comprension-de-relaciones` |
| | `el-modelo-canonico-que-no-alucine-tu-ia` |
| `accesibilidad-no-es-una-feature-es-infraestructura` (10.152) | `accesibilidad-el-requisito-que-nadie-pone-en-el-roadmap` |

`seguridad-en-ia-el-neutron-que-tumba-la-muralla` es el que Google marcó como duplicado sin canónica: su versión inglesa aparece en el informe. Consolidarlo cierra ese aviso.

### Grupos huérfanos: gana el mejor del grupo

| Destino | Origen |
|---|---|
| `la-friccion-es-un-impuesto-al-beneficio` (2.173) | `aplicando-el-factor-sentidino` |
| | `menos-manuales-mas-sentido-comun` |
| | `tu-software-es-una-ayuda-o-un-obstaculo-diario` |
| `el-equilibrio-vital-entre-estetica-y-usabilidad` (2.967) | `si-no-vende-no-es-diseno-es-decoracion` |
| | `estetica-que-factura` |
| | `tu-interfaz-esta-devaluando-tu-servicio` |
| `local-first-la-arquitectura-que-le-devuelve-el-control-a-tu-producto` (3.532) | `invertir-en-un-mundo-que-caduca-cada-martes` |
| | `el-efecto-google-por-que-tu-ram-ahora-vale-el-doble` |
| | `tu-equipo-de-desarrollo-necesita-una-ia-local` |
| | `el-retorno-del-hierro-la-resurreccion-del-co-location` |
| | `eficiencia-sobre-gigantismo-por-que-el-futuro-de-tu-empresa-es-small` |
| `ui-generativa-cuando-la-interfaz-deja-de-ser-un-plano` (3.311) | `interfaces-que-piensan-en-voz-alta-el-reto-de-disenar-para-agentes-de-ia` |
| | `diseno-en-streaming-cuando-la-interfaz-tiene-que-pensar-y-moverse-a-la-vez` |
| `anticipatory-ux-eliminando-la-carga-de-decision` (2.690) | `ni-codigo-ni-diseno-el-producto-es-anticipacion` |
| | `la-mejor-interfaz-es-la-que-no-existe-el-paso-hacia-la-invisible-ui` |
| `el-sindrome-de-la-herramienta-nueva-probar-todo-te-impide-construir` (3.041) | `shadow-it-y-el-renacimiento-del-cpo` |
| | `el-fin-de-la-ia-por-decreto` |
| `construir-antes-de-validar-el-error-de-producto-que-destruye-startups` (2.851) | `volviendo-a-las-bases-el-ceo-del-producto` |
| | `el-minimum-lovable-product-mlp` |
| `la-ia-no-se-cansa-en-el-kilometro-42` (2.964) | `la-ia-no-tiene-nervios` |
| `de-programadores-de-sintaxis-a-ingenieros-de-flujos` (3.387) | `el-colapso-de-la-factoria` |
| `unbundling-el-poder-de-la-especializacion` (2.539) | `ia-unbundling-microservicios-de-proposito-unico` |
| `estas-sentado-en-una-mina-de-oro` (2.327) | `el-techo-de-cristal-de-tu-escalabilidad` |
| `el-clasismo-del-software-el-cliente-gana-al-empleado` (2.991) | `el-asesino-silencioso-de-la-productividad` |
| `el-prototipo-que-miente-por-que-tus-tests-de-usabilidad-estan-contaminados` (3.745) | `la-cura-contra-el-ego-del-disenador` |
| `disenadores-en-la-era-de-la-ia-el-juicio-no-se-automatiza` (3.331) | `ux-2026-del-hacer-pantallas-al-decidir-experiencias` |

**Dos elecciones de superviviente que no son las obvias y conviene entender:**

En «Producto sin dirección», el destino (2.851) es **más corto** que uno de sus orígenes, `volviendo-a-las-bases-el-ceo-del-producto` (3.458). Se elige igualmente porque es el más reciente y el más concreto: los otros dos son variaciones sobre «el producto necesita criterio», y este lo aterriza en un error identificable.

En «Adopción caótica», pasa lo mismo: el destino (3.041) es más corto que `shadow-it-y-el-renacimiento-del-cpo` (3.134). Mismo motivo.

La longitud es una señal de calidad, no el criterio.

## Cómo se ejecuta

El proyecto ya tiene todo lo necesario y no hace falta código nuevo de infraestructura:

- **`PostRedirect`** (`prisma/schema.prisma`) guarda `fromSlug`, `toSlug`, `lang` y `reason`, con `@@unique([fromSlug, lang])`. Hay 59 filas: 56 con `reason: "consolidation"` (28 por idioma, de junio) y 3 de pruebas y correcciones puntuales. Estas usarán el mismo `"consolidation"`.
- **El artículo origen se despublica**, no se borra. Poner `published: false` lo saca del sitemap y de la web conservando el contenido, que es reversible; borrar la fila no lo es. Con 34 artículos y sin datos de rendimiento, la reversibilidad vale más que la limpieza.
- **El sitemap se regenera solo**: filtra por `published` y tiene `revalidate = 3600`.

Falta comprobar una cosa antes de escribir el plan, y es lo primero que hará: **que la ruta del blog consulte `PostRedirect` y emita un 301 real**. Las 59 redirecciones existentes sugieren que sí, pero hay que verificarlo, porque si el mecanismo no estuviera enganchado, despublicar 34 artículos produciría 34 páginas 404 en vez de 34 redirecciones — que es exactamente el daño que esta consolidación pretende evitar.

## Riesgos

**Se redirige un artículo que traía visitas.** Es el riesgo asumido al elegir el barrido completo sin datos. El 301 conserva la señal y el tráfico va al destino, así que no se pierde: lo que puede perderse es el posicionamiento para una consulta concreta que el destino no sirva igual de bien. Mitigación disponible y barata: si la Search Console API está operativa antes de ejecutar, cruzar el mapa con las impresiones por URL y sacar del lote cualquier origen que reciba tráfico apreciable.

**Se elige mal el superviviente.** Reversible: basta con invertir la fila de `PostRedirect` y volver a publicar el otro. Por eso los orígenes se despublican en vez de borrarse.

**Efecto sobre el enlazado interno.** Los artículos del blog se enlazan entre sí (`internalLinker`, `backlinker`). Al despublicar 34, habrá enlaces internos apuntando a URLs que ahora redirigen. Funciona —un 301 no rompe nada— pero es un salto innecesario en cada uno. El plan debe decidir si se reescriben esos enlaces al destino o se dejan.

## Fuera de alcance

**Las dos parejas de artículos largos que se solapan.** Detectadas en este mismo análisis y deliberadamente no tocadas:

- `accesibilidad-no-es-una-feature-es-infraestructura` (10.152, julio) y `accesibilidad-como-deuda` (12.659, agosto)
- `ia-en-produccion` (11.484, junio) y `el-piloto-que-nunca-escala` (11.086, julio)

Aquí no son restos de la fase corta: son cuatro de los 22 artículos buenos compitiendo de dos en dos. Redirigir uno que rinde sería un error caro y difícil de detectar. **Se decide con datos de Search Console o no se decide.**

**Los 28 cortos restantes sin grupo.** De los 76 cortos, 48 entran en el mapa (34 como origen y 14 como superviviente de un grupo huérfano). Los otros 28 tienen tema propio y no canibalizan a nadie. Que sean cortos no es motivo suficiente para tocarlos.

**Reescribir o alargar contenido.** Esta consolidación no edita ni un párrafo.
