// app/admin/layout.js
import "@/app/globals.css";
import SessionWrapper from "@/app/components/SessionWrapper"; // Importas tu wrapper

export default function AdminLayout({ children }) {
  return (
    <html lang="es">
      <body className="antialiased bg-gray-100">
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
