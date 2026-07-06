import { getAllPosts } from "@/app/lib/blog";
import { listAllCategoryRoutes } from "@/app/lib/categoryRoutes";

export default async function sitemap() {
  const baseUrl = "https://www.room714.com";
  const languages = ["en", "es"];
  const pages = ["", "/about", "/projects", "/contact", "/diagnostic", "/blog", "/careers"];

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
      changeFrequency: page === "" || page === "/blog" ? "daily" : "monthly",
      priority: page === "" ? 1 : page === "/blog" ? 0.9 : 0.8,
    })),
  );

  // 1b. Páginas de categoría del blog
  const categoryRoutes = listAllCategoryRoutes().map((r) => ({
    url: `${baseUrl}${r.url}`,
    lastModified: new Date().toISOString(),
    changeFrequency: "daily",
    priority: 0.85,
  }));

  // 2. Blog posts
  let blogRoutes = [];
  try {
    const esPosts = await getAllPosts("es");
    const enPosts = await getAllPosts("en");

    const esRoutes = esPosts
      .filter((post) => post.slug)
      .map((post) => ({
        url: `${baseUrl}/es/blog/${post.slug}`,
        lastModified: post.updatedAt
          ? new Date(post.updatedAt).toISOString()
          : post.date
            ? new Date(post.date).toISOString()
            : new Date().toISOString(),
        changeFrequency: "weekly",
        priority: 0.6,
      }));

    const enRoutes = enPosts
      .filter((post) => post.slug)
      .map((post) => ({
        url: `${baseUrl}/en/blog/${post.slug}`,
        lastModified: post.updatedAt
          ? new Date(post.updatedAt).toISOString()
          : post.date
            ? new Date(post.date).toISOString()
            : new Date().toISOString(),
        changeFrequency: "weekly",
        priority: 0.6,
      }));

    blogRoutes = [...esRoutes, ...enRoutes];
  } catch (error) {
    console.error("Sitemap: error fetching blog posts", error);
  }

  return [...routes, ...categoryRoutes, ...blogRoutes];
}
