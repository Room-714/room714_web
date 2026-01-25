// app/(admin-zone)/auth/layout.js
import "@/app/globals.css";

export default function AuthLayout({ children }) {
  return (
    <html lang="es">
      <body className="antialiased bg-gray-300">{children}</body>
    </html>
  );
}
