// app/page.js
import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
import { Phone } from "lucide-react";
import ServiceCard from "@/app/components/ServiceCard";
import PrimaryButton from "@/app/components/PrimaryButton";
import Navbar from "@/app/components/Navbar";
import { getServicesData } from "@/app/data/Services";

export default async function Home({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const services = getServicesData(dict);
  const BLOB_URL =
    "https://tzhsvjcv6h2qp8xy.public.blob.vercel-storage.com/Animacion%20final.mp4";

  return (
    <div className="flex flex-col bg-black">
      {/* Navbar con modo light */}
      <Navbar dict={dict} isDark={false} />

      {/* Hero Section */}
      <section className="bg-white text-center flex flex-col lg:flex-row items-center z-10">
        <div className="flex pb-10 justify-center w-full">
          <div
            className="relative transition-all duration-300
                 w-[90%] 
                 max-w-200
                 aspect-square
                 overflow-hidden"
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="w-full h-full object-contain"
            >
              <source src={BLOB_URL} type="video/mp4" />
            </video>
          </div>
        </div>

        <div className="px-4 md:px-12 flex flex-col justify-center items-center w-full">
          <p className="font-hand font-black text-red-500 text-2xl md:text-3xl lg:text-5xl mb-8 lg:mb-16 md:px-4">
            {dict.home.hero.title}
          </p>
          <p className="font-body text-base md:text-xl lg:text-2xl mb-8 lg:mb-16 md:px-4">
            {dict.home.hero.description}
          </p>
          <PrimaryButton
            text={dict.home.buttons.discover}
            href={`/${lang}/about`}
          />
        </div>
      </section>

      {/* Contenedor de la flecha con tamaño basado en Tailwind */}
      <section className="py-12 bg-white text-center flex flex-col items-center z-10 w-full">
        <div className="transition-all duration-300">
          <Image
            src="/arrow.svg"
            alt="Arrow pointing down"
            width={120} // El ancho base del SVG
            height={150} // El alto base del SVG
            className="h-auto w-full priority animate-bounce"
          />
        </div>
      </section>

      {/* Services Section */}
      <section className="bg-black rounded-t-[50px] -mt-10 pt-20 pb-8 mb-4 z-20 relative">
        <div className="block w-full max-w-7xl mx-auto">
          <div className="md:sticky top-12 mb-16 lg:mb-20 h-12 flex items-center justify-center px-4 md:px-8 lg:px-40">
            <h2 className="text-white z-30 font-title font-bold text-2xl md:text-4xl lg:text-5xl text-center px-2 md:px-8 lg:px-16 leading-tight">
              {dict.home.services.title}
            </h2>
          </div>
          {/* Dynamic mapping of Service Cards */}
          {services.map((service, index) => {
            return (
              <div
                key={service.id}
                className="md:sticky w-full"
                style={{
                  top: "140px",
                  marginBottom: "40px",
                  zIndex: 40 + index,
                }}
              >
                <ServiceCard
                  number={service.number}
                  image={service.image}
                  title={service.title}
                  description={service.description}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Customers Section */}
      <section className="bg-white rounded-t-[50px] overflow-hidden -mt-50px px-2 py-10 flex flex-col items-center text-center z-50">
        <div className="mb-8 p-4">
          <Image
            src="/clients-hero.svg"
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

        <p className="font-body text-xl px-4 lg:text-4xl leading relaxed lg:px-30 text-black mb-10">
          {dict.home.customers.description}
        </p>

        {/* Contenedor principal con ancho forzado */}
        <div className="relative w-full mb-10 overflow-hidden group py-6">
          {/* Degradados laterales */}
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>

          {/* Contenedor de la animación */}
          <div className="flex w-max animate-infinite-scroll hover:[animation-play-state:paused]">
            {/* Renderizamos el bloque de logos 2 veces para el loop infinito */}
            {[1, 2].map((block) => (
              <div key={block} className="flex flex-nowrap">
                {[1, 2, 3, 4].map((num) => (
                  <div
                    key={`${block}-${num}`}
                    className="flex-none flex justify-center items-center 
                       w-50 md:w-75 lg:w-100 
                       px-8 md:px-12 lg:px-20"
                  >
                    <div className="relative w-full h-20 md:h-28 lg:h-32 transition-all duration-500 transform hover:scale-110">
                      <Image
                        src={`/clients/client-0${num}.svg`}
                        alt={`Client-0${num}`}
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 200px, (max-width: 1024px) 300px, 400px"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="w-2/3 mb-10 flex justify-center">
          <PrimaryButton
            text={dict.home.buttons.clients}
            icon={Phone}
            href={`/${lang}/contact`}
          />
        </div>
      </section>

      {/* 1. Contenedor del Skyline: Proporcional y siempre visible */}
      <section className="w-full bg-white overflow-hidden">
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
