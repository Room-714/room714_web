import Image from "next/image";

// El carrusel de logos, extraído tal cual de la portada. En la portada su
// sitio lo ocupa ahora el bloque de prueba con los tres casos, que dice más;
// los logos se mudan a "Cómo trabajamos", junto a los sectores.
//
// Sin cambios de estilo: mismos anchos, mismo degradado en los laterales,
// misma animación y misma pausa al pasar el ratón.
export default function ClientLogos({ alts }) {
  return (
    <div className="relative w-full mb-10 overflow-hidden group py-6">
      {/* Degradados laterales */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>

      {/* Contenedor de la animación */}
      <div className="flex w-max animate-infinite-scroll hover:[animation-play-state:paused]">
        {/* Renderizamos el bloque de logos 2 veces para el loop infinito */}
        {[1, 2].map((block) => (
          <div key={block} className="flex flex-nowrap">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <div
                key={`${block}-${num}`}
                className="flex-none flex justify-center items-center
                       w-50 md:w-75 lg:w-100
                       px-8 md:px-12 lg:px-20"
              >
                {/* El alt nombra la empresa y su sector: "Client-01" no decía
                    nada, y con dos logos de telecos el sector a secas
                    tampoco los distinguiría. */}
                <div className="relative w-full h-20 md:h-28 lg:h-32 transition-all duration-500 transform hover:scale-110">
                  <Image
                    src={`/clients/client-0${num}.svg`}
                    alt={alts[num - 1]}
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
  );
}
