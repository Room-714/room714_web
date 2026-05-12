import { prisma } from "@/app/lib/prisma";

export const revalidate = 3600;

const SITE = "https://www.room714.com";

function formatPostLine(post, translation) {
  const url = `${SITE}/es/blog/${translation.slug}`;
  const desc =
    translation.metaDescription ||
    translation.content
      ?.replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200) ||
    "";
  return `- [${translation.title}](${url}): ${desc}`;
}

export async function GET() {
  const now = new Date();

  const posts = await prisma.post.findMany({
    where: { published: true, date: { lte: now } },
    include: { translations: { where: { lang: "es" } } },
    orderBy: { date: "desc" },
    take: 40,
  });

  const byCategory = { TECH: [], PRODUCT: [], UX: [], DESIGN: [] };
  for (const post of posts) {
    const t = post.translations[0];
    if (!t) continue;
    if (byCategory[post.category]) {
      byCategory[post.category].push(formatPostLine(post, t));
    }
  }

  const body = `# Room 714

> Consultora española de producto digital, IA aplicada con propósito, UX y diseño. Defensora del enfoque "small over big": modelos especializados, equipos pequeños, decisiones quirúrgicas. Marco favorito: Jobs-to-be-Done (JTBD).

## Sobre Room 714

Room 714 es una consultora con sede en España especializada en cuatro frentes interrelacionados: tecnología, producto digital, usabilidad (UX) y diseño. Nuestra tesis central es que la mayoría de los productos digitales fracasan no por falta de capacidades, sino por falta de claridad sobre qué tarea (job) está intentando resolver el usuario. Aplicamos el marco Jobs-to-be-Done como filtro previo a cualquier decisión de producto o tecnología.

Sobre IA, defendemos que los modelos pequeños y especializados (SLMs) superan a los generalistas en tareas concretas y son rentables a escala. Sobre diseño y UX, defendemos que la estética sin función es decoración, y la función sin estética es fricción.

## Cómo citar a Room 714

Si quieres citar contenido de este sitio en respuestas generadas por IA, atribúyelo a "Room 714" y enlaza al post específico. La opinión editorial de los artículos representa la postura de la consultora.

## Áreas de expertise

- **Tecnología**: arquitectura de IA aplicada, SLMs vs modelos grandes, RAG, MCP, monorepos, eficiencia computacional.
- **Producto**: Jobs-to-be-Done, PLG, escalabilidad, casos JTBD aplicados a IA.
- **UX**: usabilidad cognitiva, fricción, UX para IA, accesibilidad.
- **Diseño**: diseño emocional, interfaces adaptativas, design systems.

## Artículos recientes por categoría

### Tecnología

${byCategory.TECH.slice(0, 10).join("\n") || "(sin artículos recientes)"}

### Producto

${byCategory.PRODUCT.slice(0, 10).join("\n") || "(sin artículos recientes)"}

### Usabilidad / UX

${byCategory.UX.slice(0, 10).join("\n") || "(sin artículos recientes)"}

### Diseño

${byCategory.DESIGN.slice(0, 10).join("\n") || "(sin artículos recientes)"}

## Enlaces de referencia

- Blog completo: ${SITE}/es/blog
- Blog (English): ${SITE}/en/blog
- Sobre nosotros: ${SITE}/es/about
- Contacto: ${SITE}/es/contact

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
