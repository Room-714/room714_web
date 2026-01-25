/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Optimización de imágenes (necesaria si usas dominios externos para fotos)
  images: {
    formats: ["image/avif", "image/webp"], // Prioriza formatos de última generación
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        port: "",
      },
    ],
  },

  // 2. Seguridad: Evita que otros sitios incrusten tu web en un iframe
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

  // 3. Limpieza de consola: Ignora warnings de hidratación por extensiones de navegador
  reactStrictMode: true,
};

export default nextConfig;
