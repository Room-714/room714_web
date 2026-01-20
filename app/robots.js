export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/", "/private/", "/admin/"],
      },
      {
        // Regla opcional: Bloquear GPTBot si no quieres que usen tu web para entrenar a ChatGPT
        userAgent: "GPTBot",
        disallow: "/",
      },
    ],
    sitemap: "https://www.room714.com/sitemap.xml",
  };
}
