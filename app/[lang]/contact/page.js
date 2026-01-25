import { getDictionary } from "@/app/dictionaries";
import Navbar from "@/app/components/Navbar";
import Image from "next/image";
import ContactClient from "@/app/components/ContactClient";
import { getInterests } from "@/app/data/Interests";

export default async function ContactPage({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const interests = getInterests(dict);

  return (
    <>
      <div className="bg-white flex flex-col">
        <Navbar dict={dict} isDark={true} />
        <ContactClient dict={dict} interests={interests} />
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
    </>
  );
}
