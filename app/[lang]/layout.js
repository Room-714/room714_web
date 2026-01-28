import "@/app/globals.css";
import Link from "next/link";
import Script from "next/script";
import Image from "next/image";
import { getDictionary } from "@/app/dictionaries";
import {
  Montserrat,
  Gantari,
  Montserrat_Alternates,
  Mynerve,
} from "next/font/google";
import { GoogleTagManager } from "@next/third-parties/google";
import CookieBanner from "@/app/components/CookieBanner";
import { cookies } from "next/headers";

const fontGantari = Gantari({
  subsets: ["latin"],
  variable: "--font-gantari",
  weight: ["300", "400", "500", "700"],
});

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
  const baseUrl = "https://www.room714.com";

  const titles = {
    en: "Room 714 | Digital Product Studio",
    es: "Room 714 | Estudio de Productos Digitales",
  };

  const descriptions = {
    en: "We build scalable, high-performance digital products through UX methodology and technical excellence.",
    es: "Construimos productos digitales escalables y de alto rendimiento mediante metodología UX y excelencia técnica.",
  };

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: titles[lang],
      template: `%s | Room 714`,
    },
    description: descriptions[lang],
    alternates: {
      canonical: `${baseUrl}/${lang}`, // Siempre absoluta
      languages: {
        "en-US": "/en",
        "es-ES": "/es",
        "x-default": "/en", // Muy importante para SEO internacional
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      title: titles[lang],
      description: descriptions[lang],
      url: `${baseUrl}/${lang}`,
      siteName: "Room 714",
      images: [
        {
          url: "/og-image.png", // Next.js lo resolverá a absoluta gracias a metadataBase
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
  const { lang = "en" } = await params;
  const dict = await getDictionary(lang);
  const cookieStore = await cookies();
  const hasConsent = cookieStore.get("cookie_consent")?.value === "true";

  // --- DATOS ESTRUCTURADOS MEJORADOS ---
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": "https://www.room714.com/#organization",
    name: "Room 714",
    image: "https://www.room714.com/og-image.png",
    url: "https://www.room714.com",
    priceRange: "$$$", // Ayuda a segmentar en búsquedas
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
        ? "Estudio de producto digital especializado en UX/UI, investigación CX y desarrollo a medida."
        : "Digital product studio specializing in UX/UI, CX research, and custom development.",
  };

  return (
    <html
      lang={lang}
      className={`${fontGantari.variable} ${fontMontserrat.variable} ${fontAlternates.variable} ${fontMynerve.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>

      {/* Solo cargamos tracking si hay consentimiento explícito */}
      {hasConsent && (
        <>
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
        </>
      )}

      <body
        className="font-body antialiased bg-[#1A1A1A]"
        suppressHydrationWarning={true}
      >
        <div className="relative w-full mx-auto max-w-8xl overflow-x-clip">
          <main className="relative">{children}</main>

          {/* FOOTER */}
          <footer className="w-full bg-[#1A1A1A] relative z-10 -mt-1">
            {/* BLOQUE PRINCIPAL */}
            <div className="w-full mx-auto flex justify-between items-start py-8 px-6">
              {/* LADO IZQUIERDO: Personaje y frase */}
              <div className="flex flex-col justify-start items-center pl-2 gap-2">
                <span className="font-hand text-center text-base sm:text-lg md:text-xl lg:text-2xl mb-2 text-white">
                  {dict.footer.we_are}
                </span>
                <div className="relative w-40 h-20 sm:w-48 sm:h-24 md:w-64 md:h-32 lg:w-80 lg:h-40">
                  <Image
                    src="/fig-footer.svg"
                    alt="Footer figure"
                    fill
                    sizes="(max-width: 768px) 128px, (max-width: 1024px) 256px, 320px"
                    className="object-contain object-left"
                    priority={false}
                  />
                </div>
              </div>

              {/* LADO DERECHO: Logo y Links */}
              <div className="flex flex-col items-end gap-2 w-auto">
                {/* LOGO */}
                <div className="relative w-30 h-15 sm:w-36 sm:h-18 md:w-48 md:h-24 lg:w-60 lg:h-30 self-end">
                  <Image
                    src="/logo-dark.svg"
                    alt="Room 714 logo"
                    fill
                    className="object-contain object-right"
                  />
                </div>

                {/* SOCIAL LINKS} */}
                <div>
                  <p className="font-hand text-white text-sm sm:text-base md:text-xl lg:text-2xl mb-3">
                    {dict.footer.text_links}
                  </p>
                  <div className="flex items-center justify-end gap-4">
                    {/* LinkedIn */}
                    <Link
                      href="https://www.linkedin.com/company/room-714"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white rounded-full hover:opacity-70 transition-opacity"
                    >
                      <Image
                        src="/linkedin.svg"
                        alt="LinkedIn logo"
                        width={30}
                        height={30}
                        className="filter"
                      />
                    </Link>
                    {/* Blog */}
                    <Link
                      href="/blog"
                      className="p-2 bg-white rounded-full hover:opacity-70 transition-opacity"
                    >
                      <Image
                        src="/blog.svg"
                        alt="Blog logo"
                        width={30}
                        height={30}
                        className="filter"
                      />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* LINKS PRIVACY, COOKIES AND TERMS */}
            <div className="flex justify-center items-center gap-x-3 md:gap-x-6 text-white text-sm sm:text-base md:text-xl lg:text-2xl font-light">
              <Link
                href="/privacy"
                className="hover:text-red-500 transition-colors duration-300"
              >
                {dict.footer.privacy}
              </Link>
              <span className="w-px h-5 bg-white" aria-hidden="true" />
              <Link
                href="/terms"
                className="hover:text-red-500 transition-colors duration-300"
              >
                {dict.footer.terms}
              </Link>
              <span className="w-px h-5 bg-white" aria-hidden="true" />
              <Link
                href="/cookies"
                className="hover:text-red-500 transition-colors duration-300"
              >
                {dict.footer.cookies}
              </Link>
            </div>

            {/* COPYRIGHT */}
            <div className="py-8 text-center text-xs sm:text-sm md:text-base lg:text-lg text-white font-title font-light">
              © {new Date().getFullYear()} {dict.footer.copyright}
            </div>
          </footer>
        </div>
        <CookieBanner dict={dict} lang={lang} />
      </body>
    </html>
  );
}
