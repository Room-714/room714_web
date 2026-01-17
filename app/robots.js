// app/robots.js
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/", // Bloqueamos la carpeta de APIs para los bots
    },
    sitemap: "https://www.room714.com/sitemap.xml",
  };
}
