import Image from "next/image";

// El carrusel de logos, extraído tal cual de la portada. Su sitio es ahora
// el final de Casos: después de los casos, quién los encargó.
//
// Sin cambios de estilo: mismos anchos, mismo degradado en los laterales,
// misma animación y misma pausa al pasar el ratón.
//
// Cuántos logos hay lo dice la lista de alt, no un array de números a mano:
// añadir un cliente es añadir su alt en el diccionario y su SVG en
// public/clients con el número siguiente. El -50% de la animación es
// relativo al contenedor, así que el bucle sigue cuadrando con cualquier
// número de logos.
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
            {alts.map((alt, indice) => (
              <div
                key={`${block}-${alt}`}
                className="flex-none flex justify-center items-center
                       w-50 md:w-75 lg:w-100
                       px-8 md:px-12 lg:px-20"
              >
                {/* El alt nombra la empresa y su sector: "Client-01" no decía
                    nada, y con dos logos de telecos el sector a secas
                    tampoco los distinguiría. */}
                <div className="relative w-full h-20 md:h-28 lg:h-32 transition-all duration-500 transform hover:scale-110">
                  <Image
                    src={`/clients/client-${String(indice + 1).padStart(2, "0")}.svg`}
                    alt={alt}
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
