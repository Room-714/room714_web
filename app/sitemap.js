import { getAllPosts } from "@/app/lib/blog";

export default async function sitemap() {
  const baseUrl = "https://www.room714.com";
  const languages = ["en", "es"];
  const pages = ["", "/about", "/projects", "/contact", "/diagnostic"];

  // 1. Páginas estáticas para cada idioma
  const routes = languages.flatMap((lang) =>
    pages.map((page) => ({
      url: `${baseUrl}/${lang}${page}`,
      lastModified: new Date().toISOString(),
      alternates: {
        languages: {
          en: `${baseUrl}/en${page}`,
          es: `${baseUrl}/es${page}`,
        },
      },
      changeFrequency: page === "" ? "daily" : "monthly",
      priority: page === "" ? 1 : 0.8,
    })),
  );

  // 2. Ruta raíz (/) que suele redirigir al idioma por defecto
  const root = {
    url: baseUrl,
    lastModified: new Date().toISOString(),
    changeFrequency: "monthly",
    priority: 1,
  };

  // 3. Blog posts
  let blogRoutes = [];
  try {
    const esPosts = await getAllPosts("es");
    const enPosts = await getAllPosts("en");

    const esRoutes = esPosts
      .filter((post) => post.slug)
      .map((post) => ({
        url: `${baseUrl}/es/blog/${post.slug}`,
        lastModified: post.date ? new Date(post.date).toISOString() : new Date().toISOString(),
        changeFrequency: "weekly",
        priority: 0.6,
      }));

    const enRoutes = enPosts
      .filter((post) => post.slug)
      .map((post) => ({
        url: `${baseUrl}/en/blog/${post.slug}`,
        lastModified: post.date ? new Date(post.date).toISOString() : new Date().toISOString(),
        changeFrequency: "weekly",
        priority: 0.6,
      }));

    blogRoutes = [...esRoutes, ...enRoutes];
  } catch (error) {
    console.error("Sitemap: error fetching blog posts", error);
  }

  return [root, ...routes, ...blogRoutes];
}
