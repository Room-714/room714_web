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
        : [...prev, interest]
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
    <main className="min-h-screen bg-black text-white relative overflow-x-hidden">
      <div className="flex flex-col lg:flex-row items-center lg:items-start lg:justify-between py-12 lg:py-24 px-6 lg:px-24">
        {/* Ilustración Desktop */}
        <div className="hidden lg:block fixed left-0 bottom-0 w-full h-full pointer-events-none">
          <Image
            src="/contact-tablet.svg"
            alt="Contact illustration"
            fill
            className="object-contain"
            style={{ objectPosition: "0% 120%" }}
            priority
          />
        </div>

        <div className="hidden lg:block lg:w-1/3" />

        <div className="w-full lg:w-2/3 z-10">
          {status === "success" ? (
            <div className="flex flex-col items-center lg:items-start justify-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CheckCircle2 size={80} className="text-red-600 mb-6" />
              <h1 className="font-hand text-6xl md:text-8xl mb-4 text-center lg:text-left">
                {dict.contact.success.title}
              </h1>
              <p className="font-body text-xl text-gray-400 text-center lg:text-left">
                {dict.contact.success.description}
              </p>
              <Link
                href={`/${lang}`}
                className="mt-8 text-sm uppercase font-bold tracking-widest hover:text-red-600"
              >
                {dict.contact.success.link}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-hand text-5xl md:text-6xl lg:text-8xl mb-12 text-center lg:text-left">
                {dict.contact.title}
              </h1>

              <form
                onSubmit={handleSubmit}
                className="w-full flex flex-col gap-8 relative"
              >
                {status === "loading" && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center rounded-3xl">
                    <Loader2 className="animate-spin text-red-600" size={50} />
                  </div>
                )}

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
                    placeholder={dict.contact.name.placeholder}
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
                    placeholder={dict.contact.info.placeholder}
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
                    placeholder={dict.contact.message.placeholder}
                    className="w-full bg-[#E5E5E5] text-gray-700 font-bold rounded-3xl px-6 py-4 outline-none"
                  />
                </div>

                {status === "error" && (
                  <div className="flex items-center gap-2 text-red-500 font-bold">
                    <AlertCircle size={20} />
                    <span>Something went wrong.</span>
                  </div>
                )}

                <div className="flex justify-center lg:justify-end mt-4">
                  <PrimaryButton
                    text={dict.contact.buttons.send}
                    isRed={true}
                    icon={Send}
                    type="submit"
                  />
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {status !== "success" && (
        <div className="w-full flex justify-end mt-12 lg:hidden">
          <div className="w-[85%] md:w-full relative">
            <Image
              src="/contact-mobile.svg"
              alt="mobile"
              width={1000}
              height={800}
              className="h-auto block md:hidden object-contain object-right"
              priority
            />
            <Image
              src="/contact-tablet.svg"
              alt="tablet"
              width={1500}
              height={1100}
              className="hidden md:block lg:hidden w-full h-auto object-contain object-right"
              priority
            />
          </div>
        </div>
      )}
    </main>
  );
}
