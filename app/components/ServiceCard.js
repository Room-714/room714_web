import Image from "next/image";

export default function ServiceCard({ number, title, description, image }) {
  return (
    <div className="bg-white rounded-[40px] md:p-12 flex flex-col items-center justify-center md:flex-row md:gap-16 mx-auto transition-all duration-300">
      {/* Contenedor de Imagen: Ajusta el tamaño según dispositivo */}
      <div
        className="relative aspect-square shrink-0 
                      w-[60%] max-w-55
                      md:w-1/3 md:max-w-none
                      lg:w-1/4 
                      mt-8 md:mt-0"
      >
        <Image
          src={image}
          alt={title}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
          priority
        />
      </div>

      {/* Contenedor de Texto */}
      <div className="w-full flex flex-col justify-center text-black px-4 pb-8 md:px-0 md:pb-0 mt-4 md:mt-0">
        {/* Número con estilo sutil */}
        <span className="font-body text-sm md:text-lg lg:text-3xl block tracking-widest">
          {number}
        </span>

        {/* Título: Crece en pantallas grandes */}
        <h3 className="font-title font-bold text-xl md:text-3xl lg:text-5xl mb-2 lg:mb-8 leading-tight uppercase">
          {title}
        </h3>

        {/* Descripción: Ajuste de lectura */}
        <p className="font-body text-sm leading-4.8 md:text-xl md:leading-6 lg:text-3xl lg:leading-9 lg:pr-20">
          {description}
        </p>
      </div>
    </div>
  );
}
