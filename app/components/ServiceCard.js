// components/ServiceCard.js
import Image from "next/image";

export default function ServiceCard({ number, title, description, image }) {
  return (
    <div className="bg-white rounded-[40px] p-4 py-12 mb-6 flex flex-col items-center">
      <div className="relative w-full h-40 mb-6">
        <Image
          src={image}
          alt={title}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      </div>
      <div className="w-full text-left">
        <span className="font-body block">{number}</span>
        <h3 className="font-title font-semibold text-2xl mb-3 leading-tight">
          {title}
        </h3>
        <p className="font-body text-sm leading-4.5 text-black">
          {description}
        </p>
      </div>
    </div>
  );
}
