import { RENOMBRADAS, guardasDeIdioma } from "./app/lib/routes.mjs";

// Las redirecciones del rediseño no se escriben a mano: salen del mapa de
// rutas, así que añadir una página añade sus guardas sola y no hay forma de
// que el menú apunte a una URL y la redirección a otra.
const desdeElMapa = [...RENOMBRADAS, ...guardasDeIdioma()].map(({ de, a }) => ({
  source: de,
  destination: a,
  statusCode: 301,
}));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Redirecciones de Dominio (SEO Force 301)
  async redirects() {
    return [
      ...desdeElMapa,
      {
        // Redirige cualquier ruta de room714.es (con o sin www) al .com
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "room714.es",
          },
        ],
        destination: "https://www.room714.com/es/:path*",
        statusCode: 301, // `permanent: true` emite 308, no 301
      },
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.room714.es",
          },
        ],
        destination: "https://www.room714.com/es/:path*",
        statusCode: 301,
      },
      {
        // URL legacy '/legal' que Google sigue recordando. El i18n
        // auto-redirect de Vercel manda /legal a /en/legal primero, por
        // eso cubrimos también las variantes con locale.
        source: "/legal",
        destination: "/en/privacy",
        statusCode: 301,
      },
      {
        source: "/en/legal",
        destination: "/en/privacy",
        statusCode: 301,
      },
      {
        source: "/es/legal",
        destination: "/es/privacy",
        statusCode: 301,
      },
    ];
  },

  // 2. Optimización de imágenes
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        port: "",
      },
    ],
  },

  // 3. Seguridad
  async headers() {
    return [
      {
        // Clickjacking protection en todo el sitio EXCEPTO el proxy de CVs,
        // que necesita SAMEORIGIN (lo pone su propio route handler) para
        // poder incrustarse en el <iframe> del detalle. Un X-Frame-Options
        // duplicado/conflictivo hace que el navegador bloquee el iframe.
        source: "/((?!api/admin/candidates/).*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },

  reactStrictMode: true,
};

export default nextConfig;
