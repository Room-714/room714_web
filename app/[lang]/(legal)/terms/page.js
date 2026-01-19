import { getDictionary } from "@/app/dictionaries";
import Navbar from "@/app/components/Navbar";
import Image from "next/image";

export default async function TermsPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <div className="flex flex-col bg-white">
      {/* Navbar con modo light */}
      <Navbar dict={dict} isDark={false} />

      <div className="w-full mt-20 px-6 py-8 md:px-10 md:py-10 lg:px-24 lg:py-12">
        <h1 className="font-title text-4xl md:text-6xl mb-12 text-black uppercase font-bold">
          {dict.terms.title}
        </h1>

        <div className="space-y-12 font-body text-black leading-relaxed">
          {/* Aceptación */}
          <section>
            <p className="text-lg">{dict.terms.acceptance}</p>
          </section>

          {/* Propiedad Intelectual */}
          <section>
            <h2 className="font-title text-xl font-bold mb-4 uppercase tracking-wider text-red-600">
              1. {dict.terms.ip_title}
            </h2>
            <p>{dict.terms.ip_text}</p>
          </section>

          {/* Uso de la web */}
          <section>
            <h2 className="font-title text-xl font-bold mb-4 uppercase tracking-wider text-red-600">
              2. {dict.terms.use_title}
            </h2>
            <p>{dict.terms.use_text}</p>
          </section>

          {/* Limitación de Responsabilidad */}
          <section>
            <h2 className="font-title text-xl font-bold mb-4 uppercase tracking-wider text-red-600">
              3. {dict.terms.liability_title}
            </h2>
            <p>{dict.terms.liability_text}</p>
          </section>

          <p className="text-base text-red-500 pt-10">
            <strong>{dict.terms.last_update.text}:</strong>{" "}
            {dict.terms.last_update.date}
          </p>
        </div>
      </div>
      {/* 1. Contenedor del Skyline: Proporcional y siempre visible */}
      <section className="w-full bg-white">
        <div className="w-[60%] ml-auto leading-0 flex">
          <Image
            src="/skyline.svg"
            alt="City Skyline"
            width={1920}
            height={400}
            className="w-full h-auto block -mb-1 md:-mb-3 lg:-mb-5"
            priority
          />
        </div>
      </section>
    </div>
  );
}
