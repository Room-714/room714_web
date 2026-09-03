import { getDictionary } from "@/app/dictionaries";
import Navbar from "@/app/components/Navbar";
import DiagnosticClient from "@/app/components/DiagnosticClient";
import { SITE_URL, buildAlternates, samePath } from "@/app/lib/seo/urls";

const baseUrl = SITE_URL;

export async function generateMetadata({ params }) {
  const { lang = "en" } = await params;
  const titles = {
    en: "Free Digital Diagnosis — Find Out What You Need",
    es: "Diagnóstico Digital Gratuito — Descubre Qué Necesitas",
  };
  const descriptions = {
    en: "Answer a few questions and find out if you need product strategy, UX design, or software development. Free diagnosis by Room 714.",
    es: "Responde unas preguntas y descubre si necesitas estrategia de producto, diseño UX o desarrollo de software. Diagnóstico gratuito de Room 714.",
  };

  return {
    title: titles[lang],
    description: descriptions[lang],
    alternates: buildAlternates(lang, samePath("/diagnostic")),
    openGraph: {
      title: titles[lang],
      description: descriptions[lang],
      url: `${baseUrl}/${lang}/diagnostic`,
      type: "website",
    },
  };
}

export default async function DiagnosticPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <div className="bg-black flex flex-col">
      <Navbar dict={dict} isDark={true} />
      <DiagnosticClient dict={dict} />
    </div>
  );
}
