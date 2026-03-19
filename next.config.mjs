/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Redirecciones de Dominio (SEO Force 301)
  async redirects() {
    return [
      {
        // Redirige cualquier ruta de room714.es (con o sin www) al .com
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "room714.es",
          },
        ],
        destination: "https://www.room714.com/en/:path*",
        permanent: true, // Esto genera el código 301 que Google exige
      },
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.room714.es",
          },
        ],
        destination: "https://www.room714.com/en/:path*",
        permanent: true,
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
        source: "/:path*",
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
