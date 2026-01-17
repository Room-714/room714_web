export default function sitemap() {
  const baseUrl = "https://www.room714.com"; // Cambia esto por tu dominio real
  const languages = ["en", "es"];
  const pages = ["", "/about", "/projects", "/contact"];

  // Generamos las rutas combinando idiomas y páginas
  const routes = languages.flatMap((lang) =>
    pages.map((page) => ({
      url: `${baseUrl}/${lang}${page}`,
      lastModified: new Date().toISOString(),
      changeFrequency: "monthly",
      priority: page === "" ? 1 : 0.8, // Prioridad 1 para la home, 0.8 para el resto
    }))
  );

  return routes;
}
