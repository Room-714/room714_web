import { getDictionary } from "@/app/dictionaries";
import Navbar from "@/app/components/Navbar";
import Image from "next/image";

export default async function CookiesPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <div className="flex flex-col bg-white">
      {/* Navbar con modo light */}
      <Navbar dict={dict} isDark={false} />

      <div className="w-full mt-20 px-6 py-8 md:px-10 md:py-10 lg:px-24 lg:py-12">
        <h1 className="font-title text-4xl md:text-6xl mb-12 text-black uppercase font-bold">
          {dict.cookiePolicy.title}
        </h1>

        <div className="space-y-12 font-body text-black leading-relaxed">
          {/* Sección 1 */}
          <section>
            <h2 className="font-title text-xl font-bold mb-4 uppercase tracking-wider text-red-600">
              1. {dict.cookiePolicy.sec1_title}
            </h2>
            <p>{dict.cookiePolicy.sec1_text}</p>
          </section>

          {/* Sección 2 */}
          <section>
            <h2 className="font-title text-xl font-bold mb-4 uppercase tracking-wider text-red-600">
              2. {dict.cookiePolicy.sec2_title}
            </h2>
            <p>{dict.cookiePolicy.sec2_text}</p>
          </section>

          {/* Tabla de Cookies (Sección 3) */}
          <section>
            <h2 className="font-title text-xl font-bold mb-4 uppercase tracking-wider text-red-600">
              3. {dict.cookiePolicy.sec3_title}
            </h2>
            <div className="overflow-x-auto mt-6">
              <table className="w-full text-left border-collapse border border-gray-100">
                <thead>
                  <tr className="bg-gray-50 font-title text-xs uppercase italic">
                    <th className="p-4 border border-gray-100">
                      {dict.cookiePolicy.table_name}
                    </th>
                    <th className="p-4 border border-gray-100">
                      {dict.cookiePolicy.table_provider}
                    </th>
                    <th className="p-4 border border-gray-100">
                      {dict.cookiePolicy.table_purpose}
                    </th>
                    <th className="p-4 border border-gray-100">
                      {dict.cookiePolicy.table_duration}
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr>
                    <td className="p-4 border border-gray-100 font-bold italic text-red-600">
                      cookie_consent
                    </td>
                    <td className="p-4 border border-gray-100">room714</td>
                    <td className="p-4 border border-gray-100">
                      {dict.cookiePolicy.desc_consent}
                    </td>
                    <td className="p-4 border border-gray-100">1 year</td>
                  </tr>
                  <tr>
                    <td className="p-4 border border-gray-100 font-bold italic text-red-600">
                      _clck / _clsk
                    </td>
                    <td className="p-4 border border-gray-100">
                      Microsoft Clarity
                    </td>
                    <td className="p-4 border border-gray-100">
                      {dict.cookiePolicy.desc_clarity}
                    </td>
                    <td className="p-4 border border-gray-100">1 year / 24h</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Sección 4 */}
          <section>
            <h2 className="font-title text-xl font-bold mb-4 uppercase tracking-wider text-red-600">
              4. {dict.cookiePolicy.sec4_title}
            </h2>
            <p>{dict.cookiePolicy.sec4_text}</p>
          </section>

          <p className="text-base text-red-500 pt-10">
            <strong>{dict.cookiePolicy.last_update.text}:</strong>{" "}
            {dict.cookiePolicy.last_update.date}
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
            className="w-full h-auto block"
            priority
          />
        </div>
      </section>
    </div>
  );
}
