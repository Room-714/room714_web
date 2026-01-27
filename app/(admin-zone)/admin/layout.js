// app/admin/layout.js
import "@/app/globals.css";
import SessionWrapper from "@/app/components/SessionWrapper";
import { Gantari, Montserrat_Alternates, Mynerve } from "next/font/google";

// Volvemos a instanciar las fuentes para tener las variables disponibles
const fontGantari = Gantari({
  subsets: ["latin"],
  variable: "--font-gantari",
  weight: ["300", "400", "500", "700"],
});

const fontAlternates = Montserrat_Alternates({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-montserrat-alternates",
});

const fontMynerve = Mynerve({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-mynerve",
});

export default function AdminLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${fontGantari.variable} ${fontAlternates.variable} ${fontMynerve.variable}`}
    >
      <body className="antialiased bg-gray-300">
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
