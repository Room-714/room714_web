// app/page.js
import { getDictionary } from "@/app/dictionaries";
import Image from "next/image";
import { Phone } from "lucide-react";
import ServiceCard from "@/app/components/ServiceCard";
import PrimaryButton from "@/app/components/PrimaryButton";
import SERVICES from "@/app/data/Services";

export default async function Home({ params }) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return (
    <div className="flex flex-col bg-black">
      {/* Hero Section */}
      <section className="py-12 bg-white text-center flex flex-col items-center z-10">
        <div className="my-16 p-24">
          <Image
            src="/hero.svg"
            alt="hero image"
            width={120}
            height={150}
            priority
            className="w-auto h-auto"
          />
        </div>

        <h1 className="font-body font-bold text-4xl md:text-[50px] lg:text-[80px] mb-16">
          {dict.home.hero.title}
        </h1>

        <p className="font-body text-2xl md:text-3xl lg:text-[40px] mb-8 px-4 md:px-8 lg:px-30">
          {dict.home.hero.description}
        </p>

        <PrimaryButton text={dict.home.buttons.discover} />

        <div className="w-full max-w-200px mt-12">
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
      <section className="bg-black rounded-t-[50px] -mt-10 pt-24 pb-10 mb-6 z-20">
        <div className="flex flex-col items-center">
          <div className="sticky top-30 mb-16 h-30 flex items-center justify-center px-4">
            <h2 className="text-white z-30 font-title font-bold text-3xl text-center px-2 leading-tight">
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
                className="sticky z-40 w-full"
                style={{ top: "270px", marginBottom: "40px" }}
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

        <h2 className="font-title font-bold text-red-500 text-3xl px-2 mb-6 leading-tight">
          {dict.home.customers.title.line1} <br />{" "}
          {dict.home.customers.title.line2}
        </h2>

        <p className="font-body text-lg px-4 leading-5.5 text-black mb-10">
          {dict.home.customers.description}
        </p>

        {/* Container of Logos with Horizontal Scroll */}
        <div className="w-full mb-10">
          <div className="flex flex-nowrap overflow-x-auto gap-8 pb-4 scrollbar-hide snap-x snap-mandatory">
            {[1, 2, 3, 4].map((num) => (
              <div
                key={`client-0${num}`}
                className="flex-none w-32 h-16 relative snap-center hover:grayscale-0 transition-all duration-500"
              >
                <Image
                  src={`/client-0${num}.svg`}
                  alt={`Client-0${num}`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 128px, 128px"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="w-2/3 mb-10 flex justify-center">
          <PrimaryButton text="contact us" icon={Phone} />
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-white">
        <Image
          src="/footer.svg"
          alt="City Skyline"
          width={1920}
          height={400}
          className="w-full h-auto"
        />
      </footer>
    </div>
  );
}
