import "@/app/globals.css";
import Link from "next/link";
import Script from "next/script";
import Image from "next/image";
import { getDictionary } from "../dictionaries";
import { Montserrat, Montserrat_Alternates, Mynerve } from "next/font/google";
import { GoogleTagManager } from "@next/third-parties/google";

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

// --- CONFIGURACIÓN DE METADATOS DINÁMICOS (SEO) ---
export async function generateMetadata({ params }) {
  const { lang = "en" } = await params;

  const titles = {
    en: "Room 714 | Digital Product Studio",
    es: "Room 714 | Estudio de Productos Digitales",
  };

  const descriptions = {
    en: "We build scalable, high-performance digital products through UX methodology and technical excellence.",
    es: "Construimos productos digitales escalables y de alto rendimiento mediante metodología UX y excelencia técnica.",
  };

  const baseUrl = "https://www.room714.com";

  return {
    title: {
      default: titles[lang],
      template: `%s | Room 714`,
    },
    description: descriptions[lang],
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `/${lang}`,
      languages: {
        "en-US": "/en",
        "es-ES": "/es",
      },
    },
    openGraph: {
      title: titles[lang],
      description: descriptions[lang],
      url: `${baseUrl}/${lang}`,
      siteName: "Room 714",
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: "Room 714 Digital Product Studio",
        },
      ],
      locale: lang === "es" ? "es_ES" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: titles[lang],
      description: descriptions[lang],
      images: ["/og-image.png"],
    },
  };
}

export default async function RootLayout({ children, params }) {
  const resolvedParams = await params;
  const lang = resolvedParams.lang || "en";
  const dict = await getDictionary(lang);

  // --- DATOS ESTRUCTURADOS (GEO / AI ENGINES) ---
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Room 714",
    image: "https://www.room714.com/og-image.png",
    url: "https://www.room714.com",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Madrid",
      addressCountry: "ES",
    },
    sameAs: [
      "https://www.linkedin.com/company/room714",
      "https://www.instagram.com/room714",
    ],
    description:
      lang === "es"
        ? "Estudio de producto digital especializado en UX/UI, investigación CX y transformación digital."
        : "Digital product studio specializing in UX/UI, CX research, and digital transformation.",
  };

  return (
    <html
      lang={lang}
      className={`${fontMontserrat.variable} ${fontAlternates.variable} ${fontMynerve.variable}`}
    >
      <head>
        {/* Inyección de JSON-LD para motores de búsqueda de IA */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>

      {/* Herramientas de Marketing y Tracking */}
      <GoogleTagManager gtmId="GTM-M6HTKWS4" />

      <Script id="microsoft-clarity" strategy="afterInteractive">
        {`
          (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "v1w8qfn9bx");
        `}
      </Script>

      <body className="font-body antialiased" suppressHydrationWarning={true}>
        <main>{children}</main>
        {/* Footer completo */}
        <footer className="w-full">
          <div className="max-full flex flex-col bg-[#1A1A1A] md:flex-row md:justify-between items-start md:items-center px-2 py-10">
            {/* LADO IZQUIERDO: Personaje y frase */}
            <div className="flex flex-col items-center pl-2 gap-2 mb-6 md:mb-0">
              <span className="font-hand text-center text-base md:text-xl lg:text-2xl mb-2 text-white">
                {dict.footer.we_are}
              </span>
              <div className="relative w-36 h-18 sm:w-48 sm:h-24 md:w-64 md:h-32 lg:w-80 lg:h-40">
                <Image
                  src="/fig-footer.svg"
                  alt="Logo Footer"
                  fill
                  sizes="(max-width: 768px) 128px, (max-width: 1024px) 256px, 320px"
                  className="object-contain object-left"
                  priority={false}
                />
              </div>
            </div>
            {/* LADO DERECHO: Logo y Links */}
            <div className="flex flex-col items-end md:items-end -mt-5 pr-2 md:pr-4 md:mt-10 gap-8 w-full md:w-auto">
              {/* Logo */}
              <div className="relative w-40 h-12 self-end">
                <Image
                  src="/logo-dark.svg"
                  alt="Room 714 logo"
                  fill
                  className="object-contain object-right"
                />
              </div>

              {/* Links Grid */}
              <div className="w-[80%] grid grid-cols-2 md:w-full lg:grid-cols-3 justify-items-end gap-y-2 gap-x-8 text-sm md:text-base font-light text-white">
                <Link
                  href="/legal"
                  className="hover:text-white transition-colors"
                >
                  {dict.footer.legal}
                </Link>
                <Link
                  href="/privacy"
                  className="hover:text-white transition-colors"
                >
                  {dict.footer.privacy}
                </Link>
                <Link
                  href="/terms"
                  className="hover:text-white transition-colors"
                >
                  {dict.footer.terms}
                </Link>
                <Link
                  href="/cookies"
                  className="hover:text-white transition-colors"
                >
                  {dict.footer.cookies}
                </Link>
                <Link
                  href="https://linkedin.com"
                  className="hover:text-white transition-colors"
                >
                  {dict.footer.linkedin}
                </Link>
                <Link
                  href="/blog"
                  className="hover:text-white transition-colors"
                >
                  {dict.footer.blog}
                </Link>
              </div>
            </div>
          </div>

          {/* COPYRIGHT */}
          <div className="pb-8 bg-[#1A1A1A] text-center text-xs text-white">
            {dict.footer.copyright}
          </div>
        </footer>
      </body>
    </html>
  );
}
