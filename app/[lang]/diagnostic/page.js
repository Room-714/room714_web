import { getDictionary } from "@/app/dictionaries";
import Navbar from "@/app/components/Navbar";
import DiagnosticClient from "@/app/components/DiagnosticClient";

export async function generateMetadata({ params }) {
  const { lang = "en" } = await params;
  const titles = {
    en: "Discover what you need",
    es: "Descubre qué necesitas",
  };
  const descriptions = {
    en: "Answer a few questions and find out how Room 714 can help your business grow.",
    es: "Responde unas preguntas y descubre cómo Room 714 puede ayudar a crecer tu negocio.",
  };

  return {
    title: titles[lang],
    description: descriptions[lang],
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
