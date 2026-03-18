export default async function sitemap() {
  const baseUrl = "https://www.room714.com";
  const languages = ["en", "es"];
  const pages = ["", "/about", "/projects", "/contact"];

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

  /* 3. CUANDO TENGAS EL BLOG:
  Descomenta esto y haz el fetch de tus posts.
  
  const posts = await getPosts(); // Tu función para traer los posts
  const blogRoutes = posts.flatMap((post) => 
    languages.map((lang) => ({
      url: `${baseUrl}/${lang}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    }))
  );
  */

  return [root, ...routes]; // Añade , ...blogRoutes cuando lo tengas
}
