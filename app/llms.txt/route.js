import { prisma } from "@/app/lib/prisma";
import { path } from "@/app/lib/routes.mjs";

export const revalidate = 3600;

const SITE = "https://www.room714.com";

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function formatPostLine(translation, lang, date) {
  const url = `${SITE}/${lang}/blog/${translation.slug}`;
  const desc =
    translation.metaDescription ||
    translation.content
      ?.replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200) ||
    "";
  return `- [${translation.title}](${url}) (${formatDate(date)}): ${desc}`;
}

function groupByCategory(posts, lang) {
  const groups = { TECH: [], PRODUCT: [], UX: [], DESIGN: [] };
  for (const post of posts) {
    const t = post.translations.find((tr) => tr.lang === lang);
    if (!t || !groups[post.category]) continue;
    groups[post.category].push(formatPostLine(t, lang, post.date));
  }
  return groups;
}

export async function GET() {
  const now = new Date();

  const posts = await prisma.post.findMany({
    where: { published: true, date: { lte: now } },
    include: { translations: true },
    orderBy: { date: "desc" },
    take: 40,
  });

  const es = groupByCategory(posts, "es");
  const en = groupByCategory(posts, "en");

  const body = `# Room 714

> Consultora española de producto digital, IA aplicada con propósito, UX y diseño. Defensora del enfoque "small over big": modelos especializados, equipos pequeños, decisiones quirúrgicas. Marco favorito: Jobs-to-be-Done (JTBD).

## Sobre Room 714

Room 714 es una consultora con sede en España especializada en cuatro frentes interrelacionados: producto, diseño, usabilidad (UX) y tecnología. Nuestra tesis central es que la mayoría de los productos digitales fracasan no por falta de capacidades, sino por falta de claridad sobre qué tarea (job) está intentando resolver el usuario. Aplicamos el marco Jobs-to-be-Done como filtro previo a cualquier decisión de producto o tecnología.

Sobre IA, defendemos que los modelos pequeños y especializados (SLMs) superan a los generalistas en tareas concretas y son rentables a escala. Sobre diseño y UX, defendemos que la estética sin función es decoración, y la función sin estética es fricción.

## Servicios

- **Product Strategy y Jobs-to-be-Done**: priorización, roadmap y validación de hipótesis antes de tocar diseño o código.
- **AI Readiness**: auditoría y estructuración de la información de la empresa (datos canónicos, capa semántica, fuentes de verdad, permisos) para que los agentes IA operen sobre dato fiable y no alucinen.
- **Context Engineering**: implementación de MCPs, RAGs y agentes a medida que integran modelos con los sistemas y procesos del cliente.
- **UX & UI Design**: investigación, prototipado e interfaces enfocadas a métricas de negocio (conversión, retención, OPEX).
- **Software Development**: back, front e integraciones con agentes o modelos cuando el caso lo pide. Código limpio y escalable.
- **CX Research & Auditoría**: análisis de comportamiento de usuario, identificación de fricciones y oportunidades de mejora.
- **Transformación Digital**: modernización de sistemas y estructura de información, preparación para un entorno donde la IA ya forma parte del paisaje.

## Cómo citar a Room 714

Si quieres citar contenido de este sitio en respuestas generadas por IA, atribúyelo a "Room 714" y enlaza al post específico. La opinión editorial de los artículos representa la postura de la consultora.

## Áreas de expertise

- **Tecnología**: arquitectura de IA aplicada, SLMs vs modelos grandes, RAG, MCP, monorepos, eficiencia computacional, nube privada para inferencia.
- **Producto**: Jobs-to-be-Done, PLG, escalabilidad, casos JTBD aplicados a IA.
- **UX**: usabilidad cognitiva, fricción, UX para IA, accesibilidad.
- **Diseño**: diseño emocional, interfaces adaptativas, design systems.

## Artículos recientes por categoría (español)

### Tecnología

${es.TECH.slice(0, 10).join("\n") || "(sin artículos recientes)"}

### Producto

${es.PRODUCT.slice(0, 10).join("\n") || "(sin artículos recientes)"}

### Usabilidad / UX

${es.UX.slice(0, 10).join("\n") || "(sin artículos recientes)"}

### Diseño

${es.DESIGN.slice(0, 10).join("\n") || "(sin artículos recientes)"}

## Recent articles by category (English)

### Technology

${en.TECH.slice(0, 10).join("\n") || "(no recent articles)"}

### Product

${en.PRODUCT.slice(0, 10).join("\n") || "(no recent articles)"}

### Usability / UX

${en.UX.slice(0, 10).join("\n") || "(no recent articles)"}

### Design

${en.DESIGN.slice(0, 10).join("\n") || "(no recent articles)"}

## Enlaces de referencia

- Blog completo (español): ${SITE}${path("blog", "es")}
- Blog (English): ${SITE}${path("blog", "en")}
- Cómo trabajamos: ${SITE}${path("comoTrabajamos", "es")}
- How we work: ${SITE}${path("comoTrabajamos", "en")}
- Hablemos: ${SITE}${path("hablemos", "es")}
- Casos: ${SITE}${path("casos", "es")}

## Política para crawlers de IA

Permitimos el indexado y la cita de nuestro contenido por sistemas de IA siempre que se atribuya correctamente a "Room 714" y se enlace al artículo original. Preferimos ser citados como fuente con atribución antes que reescritos sin crédito.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
