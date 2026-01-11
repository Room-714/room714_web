// app/layout.js
import "@/app/globals.css";
import Navbar from "@/app/components/Navbar";
import { getDictionary } from "../dictionaries";
import { Montserrat, Montserrat_Alternates, Mynerve } from "next/font/google";

const fontMontserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
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

export default async function RootLayout({ children, params }) {
  const resolvedParams = await params;
  const lang = resolvedParams.lang || "en";

  const dict = await getDictionary(lang);
  return (
    <html
      lang={lang}
      className={`${fontMontserrat.variable} ${fontAlternates.variable} ${fontMynerve.variable}`}
    >
      <body
        className="bg-white text-black font-body antialiased"
        suppressHydrationWarning={true}
      >
        <Navbar dict={dict} />

        <main>{children}</main>
      </body>
    </html>
  );
}
