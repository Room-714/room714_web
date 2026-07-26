import { getAllPosts } from "@/app/lib/blog";
import { listAllCategoryRoutes } from "@/app/lib/categoryRoutes";

// Regenera el sitemap cada hora aunque no haya deploy, para que los posts
// generados por cron (lunes/miércoles) aparezcan sin esperar a un despliegue.
export const revalidate = 3600;

export default async function sitemap() {
  const baseUrl = "https://www.room714.com";
  const languages = ["en", "es"];
  const pages = ["", "/about", "/projects", "/contact", "/diagnostic", "/blog", "/careers"];
  // Páginas que reflejan el contenido más reciente (llevan lastmod real).
  const dynamicPages = new Set(["", "/blog"]);

  // Traemos los posts primero: sirven para las rutas de blog y para calcular
  // el lastmod real del contenido (evita poner new Date() en cada build, que
  // le decía a Google que "todo cambió" en cada deploy).
  let esPosts = [];
  let enPosts = [];
  try {
    [esPosts, enPosts] = await Promise.all([
      getAllPosts("es"),
      getAllPosts("en"),
    ]);
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
    pages.map((page) => {
      const entry = {
        url: `${baseUrl}/${lang}${page}`,
        alternates: {
          languages: {
            en: `${baseUrl}/en${page}`,
            es: `${baseUrl}/es${page}`,
          },
        },
        changeFrequency: page === "" || page === "/blog" ? "daily" : "monthly",
        priority: page === "" ? 1 : page === "/blog" ? 0.9 : 0.8,
      };
      if (dynamicPages.has(page) && latestModIso) {
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
      priority: 0.85,
    };
    if (latestModIso) entry.lastModified = latestModIso;
    return entry;
  });

  // 2. Blog posts: su fecha real (updatedAt o date).
  const toRoute = (post, lang) => {
    const mod = postMod(post);
    return {
      url: `${baseUrl}/${lang}/blog/${post.slug}`,
      ...(mod ? { lastModified: mod.toISOString() } : {}),
      changeFrequency: "weekly",
      priority: 0.6,
    };
  };
  const blogRoutes = [
    ...esPosts.filter((p) => p.slug).map((p) => toRoute(p, "es")),
    ...enPosts.filter((p) => p.slug).map((p) => toRoute(p, "en")),
  ];

  return [...routes, ...categoryRoutes, ...blogRoutes];
}
