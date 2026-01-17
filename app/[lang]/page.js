// app/page.js
import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
import { Phone } from "lucide-react";
import ServiceCard from "@/app/components/ServiceCard";
import PrimaryButton from "@/app/components/PrimaryButton";
import Navbar from "@/app/components/Navbar";
import SERVICES from "@/app/data/Services";

export default async function Home({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <div className="flex flex-col bg-black">
      {/* Navbar con modo light */}
      <Navbar dict={dict} isDark={false} />

      {/* Hero Section */}
      <section className="py-12 bg-white text-center flex flex-col items-center z-10">
        <div className="mt-8 mb-16 p-4 md:p-12 lg:p-24 flex justify-center w-full">
          <div
            className="relative transition-all duration-300
                  w-[50%] max-w-40
                  md:w-[30%] md:max-w-55
                  lg:w-[25%] lg:max-w-75
                  aspect-120/150"
          >
            <Image
              src="/hero.svg"
              alt="Discovery"
              fill
              priority
              className="object-contain"
              sizes="(max-width: 768px) 160px, (max-width: 1200px) 220px, 300px"
            />
          </div>
        </div>

        <h1 className="font-body font-bold text-4xl md:text-5xl lg:text-6xl mb-16">
          {dict.home.hero.title}
        </h1>

        <p className="font-body text-xl md:text-2xl lg:text-3xl mb-8 px-4 md:px-8 lg:px-30">
          {dict.home.hero.description}
        </p>

        <PrimaryButton text={dict.home.buttons.discover} />

        <div
          className="relative transition-all duration-300
                  min-w-15    /* Pero que nunca baje de 60px */
                  md:min-w-25 /* En Tablet no pasa de 100px */
                  lg:min-w-40 /* En PC tiene más aire hasta 140px */"
        >
          <Image
            src="/arrow.svg"
            alt="Arrow pointing down"
            width={120}
            height={150}
            className="h-auto w-full"
          />
        </div>
      </section>

      {/* Services Section */}
      <section className="bg-black rounded-t-[50px] -mt-10 pt-20 pb-8 mb-4 z-20">
        <div className="flex flex-col items-center">
          <div className="md:sticky top-12 mb-16 lg:mb-20 h-12 flex items-center justify-center px-4 md:px-8 lg:px-40">
            <h2 className="text-white z-30 font-title font-bold text-2xl md:text-4xl lg:text-5xl text-center px-2 md:px-8 lg:px-16 leading-tight">
              {dict.home.services.title}
            </h2>
          </div>
          {/* Dynamic mapping of Service Cards */}
          {SERVICES.map((service, index) => {
            const translation = dict.home.services[service.id];
            if (!translation) return null;
            return (
              <div
                key={service.id}
                className="md:sticky z-40 w-full"
                style={{ top: "140px", marginBottom: "40px" }}
              >
                <ServiceCard
                  number={service.number}
                  icon={service.icon}
                  image={service.image}
                  title={translation.title}
                  description={translation.description}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Customers Section */}
      <section className="bg-white rounded-t-[50px] -mt-50px px-2 py-10 flex flex-col items-center text-center z-50">
        <div className="mb-8 p-4">
          <Image
            src="/clients-image.svg"
            alt="Clients"
            width={280}
            height={280}
            className="w-auto h-auto mx-auto"
            priority
          />
        </div>

        <h2 className="font-title font-bold text-red-500 text-3xl lg:text-5xl px-2 mb-6 leading-tight">
          {dict.home.customers.title.line1}
        </h2>
        <h2 className="font-hand font-bold text-red-500 text-3xl lg:text-5xl px-2 mb-6 leading-tight">
          {dict.home.customers.title.line2}
        </h2>

        <p className="font-body text-xl px-4 lg:text-4xl lg:leading-9 lg:px-30 text-black mb-10">
          {dict.home.customers.description}
        </p>

        {/* Contenedor principal con degradados laterales opcionales para suavizar bordes */}
        <div className="relative w-full mb-10 overflow-hidden group py-6">
          {/* Degradados laterales (puedes quitarlos si prefieres bordes limpios) */}
          <div className="absolute inset-y-0 left-0 w-16 bg-linear-to-r from-white to-transparent z-10 pointer-events-none"></div>
          <div className="absolute inset-y-0 right-0 w-16 bg-linear-to-l from-white to-transparent z-10 pointer-events-none"></div>

          <div className="flex animate-infinite-scroll w-max hover:[animation-play-state:paused]">
            {[1, 2].map((block) => (
              <div key={block} className="flex">
                {[1, 2, 3, 4].map((num) => (
                  <div
                    key={`${block}-${num}`}
                    className="flex-none flex justify-center items-center
                       w-[50vw] md:w-[33vw] lg:w-[25vw] 
                       px-6 md:px-10 lg:px-14 transition-all duration-300"
                  >
                    {/* Altura aumentada de h-20 (80px) a h-[100px] para ese +25% */}
                    <div className="relative w-full h-25 transition-all duration-500 transform hover:scale-110">
                      <Image
                        src={`/client-0${num}.svg`}
                        alt={`Client-0${num}`}
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="w-2/3 mb-10 flex justify-center">
          <PrimaryButton text="contact us" icon={Phone} />
        </div>
      </section>
    </div>
  );
}
