export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Sin /_next/: ahí viven los CSS y JS de la app, y bloquearlos impide
        // que Google renderice las páginas como las ve un usuario.
        disallow: ["/api/", "/private/", "/admin/"],
      },
    ],
    sitemap: "https://www.room714.com/sitemap.xml",
  };
}
