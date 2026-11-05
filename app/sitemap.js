import { unstable_cache } from "next/cache";
import { prisma } from "@/app/lib/prisma";
import { listAllCategoryRoutes } from "@/app/lib/categoryRoutes";
import { SITE_URL, blogUrl } from "@/app/lib/seo/urls";
import { EN_SITEMAP, IDIOMAS, pathsOf } from "@/app/lib/routes.mjs";
import { estaRedirigido } from "@/app/lib/seo/postsRedirigidos.mjs";

// El sitemap se genera en cada petición, no en el build. Con
// `revalidate = 3600` Next lo prerenderizaba como ISR, pero en Vercel la copia
// del build no se regeneraba nunca: en noviembre de 2026 seguía sirviendo los
// posts del despliegue del 19/10, mientras llms.txt, con el mismo revalidate,
// sí se refrescaba. Lo que se cachea ahora son los datos (abajo), así que la
// base de datos sigue viendo como mucho una consulta por hora.
export const dynamic = "force-dynamic";

// Una sola consulta, con solo las columnas que el sitemap usa (sin el
// `content` de cada post), cacheada una hora. La BD de producción se ha
// quedado sin conexiones otras veces: cada visita de un rastreador no puede
// convertirse en una consulta. Las fechas se devuelven como ISO porque la
// caché serializa a JSON.
//
// `now() AT TIME ZONE 'UTC'`: Prisma guarda DateTime como timestamp sin zona
// en UTC, así que se compara con el "ahora" en UTC, sea cual sea la zona de
// la sesión. Es el mismo filtro que getAllPosts: publicado y con fecha ya
// alcanzada.
const postsDelSitemap = unstable_cache(
  async () => {
    const filas = await prisma.$queryRaw`
      SELECT t."lang", t."slug", p."date", p."updatedAt"
      FROM "PostTranslation" t
      JOIN "Post" p ON p."id" = t."postId"
      WHERE p."published" = true
        AND p."date" <= (now() AT TIME ZONE 'UTC')
      ORDER BY p."date" DESC`;
    return filas.map((f) => ({
      lang: f.lang,
      slug: f.slug,
      date: f.date ? new Date(f.date).toISOString() : null,
      updatedAt: f.updatedAt ? new Date(f.updatedAt).toISOString() : null,
    }));
  },
  ["sitemap-posts-v1"],
  { revalidate: 3600 },
);

// El inglés va a media prioridad que su equivalente español. De las 119
// páginas que Google conoce y nunca ha rastreado, 60 son inglesas: compiten
// por el mismo presupuesto de rastreo y hoy no aportan tráfico. Esto no las
// excluye, solo las pone detrás en la cola.
const priorityFor = (base, lang) => (lang === "en" ? base / 2 : base);

export default async function sitemap() {
  const baseUrl = SITE_URL;
  const languages = IDIOMAS;
  // Las rutas salen del mapa: cada idioma tiene la suya, que desde la Fase 2
  // ya no coinciden (/es/casos y /en/cases).
  const pages = EN_SITEMAP;
  // Páginas que reflejan el contenido más reciente (llevan lastmod real).
  const dynamicPages = new Set(["home", "blog"]);

  // Traemos los posts primero: sirven para las rutas de blog y para calcular
  // el lastmod real del contenido (evita poner new Date() en cada build, que
  // le decía a Google que "todo cambió" en cada deploy).
  // Si la consulta falla no se cachea nada (unstable_cache solo guarda
  // resultados), y el sitemap sale con las páginas fijas, como antes.
  let esPosts = [];
  let enPosts = [];
  try {
    const posts = await postsDelSitemap();
    esPosts = posts.filter((p) => p.lang === "es");
    enPosts = posts.filter((p) => p.lang === "en");
  } catch (error) {
    console.error("Sitemap: error fetching blog posts", error);
  }

  const postMod = (post) =>
    post.updatedAt
      ? new Date(post.updatedAt)
      : post.date
        ? new Date(post.date)
        : null;

  const latestMod = [...esPosts, ...enPosts]
    .map(postMod)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  const latestModIso = latestMod ? latestMod.toISOString() : undefined;

  // 1. Páginas estáticas. Home y /blog llevan lastmod del contenido; el resto
  // (about, contact, etc.) NO lleva lastmod (es más honesto que inventar una
  // fecha que cambia en cada build).
  const routes = languages.flatMap((lang) =>
    pages.map((clave) => {
      const rutas = pathsOf(clave);
      const entry = {
        url: `${baseUrl}${rutas[lang]}`,
        alternates: {
          languages: {
            en: `${baseUrl}${rutas.en}`,
            es: `${baseUrl}${rutas.es}`,
          },
        },
        changeFrequency: dynamicPages.has(clave) ? "daily" : "monthly",
        priority: priorityFor(
          clave === "home" ? 1 : clave === "blog" ? 0.9 : 0.8,
          lang,
        ),
      };
      if (dynamicPages.has(clave) && latestModIso) {
        entry.lastModified = latestModIso;
      }
      return entry;
    }),
  );

  // 1b. Páginas de categoría: cambian cuando hay post nuevo → lastmod del
  // contenido más reciente.
  const categoryRoutes = listAllCategoryRoutes().map((r) => {
    const entry = {
      url: `${baseUrl}${r.url}`,
      changeFrequency: "daily",
      priority: priorityFor(0.85, r.lang),
    };
    if (latestModIso) entry.lastModified = latestModIso;
    return entry;
  });

  // 2. Blog posts: su fecha real (updatedAt o date).
  // El slug va percent-encodeado: uno con caracteres no ASCII interpolado en
  // crudo produce una URL que el servidor rechaza antes de enrutar (500), y
  // aquí la estaríamos anunciando a Google.
  const toRoute = (post, lang) => {
    const mod = postMod(post);
    return {
      url: blogUrl(lang, post.slug),
      ...(mod ? { lastModified: mod.toISOString() } : {}),
      changeFrequency: "weekly",
      priority: priorityFor(0.6, lang),
    };
  };
  // Los posts fusionados siguen en la BD pero su URL redirige: fuera.
  const anunciable = (lang) => (p) => p.slug && !estaRedirigido(lang, p.slug);
  const blogRoutes = [
    ...esPosts.filter(anunciable("es")).map((p) => toRoute(p, "es")),
    ...enPosts.filter(anunciable("en")).map((p) => toRoute(p, "en")),
  ];

  return [...routes, ...categoryRoutes, ...blogRoutes];
}
