"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Send, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import PrimaryButton from "@/app/components/PrimaryButton";

export default function ContactClient({ dict, interests }) {
  const [status, setStatus] = useState("idle");
  const [selectedInterests, setSelectedInterests] = useState([]);
  const params = useParams();
  const lang = params?.lang || "en";

  const toggleInterest = (interest) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    const formData = new FormData(e.target);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      message: formData.get("message"),
      interests: selectedInterests,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) setStatus("success");
      else setStatus("error");
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <main className="bg-black text-white relative overflow-hidden flex flex-col">
      {/* ILUSTRACIÓN DESKTOP (Fondo) */}
      <div className="hidden lg:block absolute left-0 top-0 w-full h-full pointer-events-none z-0">
        <Image
          src="/contact-tablet.svg"
          alt="Contact illustration desktop"
          fill
          className="object-contain object-bottom-left"
          priority
        />
      </div>

      {/* 2. CONTENIDO (Form o Éxito) */}
      {/* Ajustamos el padding inferior a 0 para que no haya gap con la imagen/skyline */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start lg:justify-between pt-12 lg:pt-24 pb-0 px-6 lg:px-24 z-10">
        <div className="hidden lg:block lg:w-[40%]" />

        <div className="w-full lg:w-[60%]">
          {status === "success" ? (
            <div className="flex flex-col jusfity-center items-end animate-in fade-in duration-500 lg:mb-12">
              <CheckCircle2 size={60} className="text-red-600 mb-4" />
              <h1 className="font-hand text-6xl md:text-8xl mb-4 text-white leading-none">
                {dict.contact.success.title}
              </h1>
              <p className="font-body text-xl text-gray-400 mb-8 max-w-2xl">
                {dict.contact.success.description}
              </p>

              <Link href={`/${lang}`} className="text-white font-bold text-sm">
                {dict.contact.success.link}
              </Link>
            </div>
          ) : (
            <div className="pb-12 lg:pb-24">
              <h1 className="font-hand text-5xl md:text-6xl lg:text-8xl mb-12 text-center lg:text-left">
                {dict.contact.title}
              </h1>
              <form
                onSubmit={handleSubmit}
                className="w-full flex flex-col gap-8"
              >
                <div className="flex flex-col gap-4">
                  <p className="font-body font-bold text-xl uppercase tracking-tighter">
                    {dict.contact.interested.question}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {interests.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleInterest(item)}
                        className={`px-6 py-1 border rounded-full text-sm font-bold transition-all ${
                          selectedInterests.includes(item)
                            ? "bg-white text-black border-white"
                            : "border-white hover:bg-white/10"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="font-body font-bold text-xl uppercase tracking-tighter">
                    {dict.contact.name.title}
                  </label>
                  <input
                    name="name"
                    required
                    type="text"
                    className="w-full bg-[#E5E5E5] text-gray-700 font-bold rounded-full px-6 py-3 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <label className="font-body font-bold text-xl uppercase tracking-tighter">
                    {dict.contact.info.title}
                  </label>
                  <input
                    name="email"
                    required
                    type="email"
                    className="w-full bg-[#E5E5E5] text-gray-700 font-bold rounded-full px-6 py-3 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <label className="font-body font-bold text-xl uppercase tracking-tighter">
                    {dict.contact.message.title}
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={4}
                    className="w-full bg-[#E5E5E5] text-gray-700 font-bold rounded-3xl px-6 py-4 outline-none"
                  />
                </div>
                <div className="flex justify-center lg:justify-end mt-4">
                  <PrimaryButton
                    text={
                      status === "loading"
                        ? dict.contact.buttons.sending
                        : dict.contact.buttons.send
                    }
                    isRed={true}
                    icon={status === "loading" ? Loader2 : Send}
                    type="submit"
                    className={
                      status === "loading"
                        ? "opacity-70 pointer-events-none"
                        : ""
                    }
                  />
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* 3. ILUSTRACIÓN MÓVIL/TABLET: Siempre presente al final */}
      <div className="w-full lg:hidden leading-none overflow-hidden">
        <Image
          src="/contact-tablet.svg"
          alt="Contact illustration"
          width={1500}
          height={800}
          className="w-full h-auto block align-bottom"
          priority
        />
      </div>
    </main>
  );
}
