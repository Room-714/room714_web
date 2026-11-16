// Cronograma del programa de tres meses: una barra por línea de trabajo
// sobre doce semanas. Componente nuevo (no había nada equivalente), con las
// piezas del sitio: la pastilla redonda de los formularios para la barra, el
// rojo de los CTA y el texto gris de las listas.
//
// Cada barra lleva su etiqueta de texto encima, así que el significado no
// depende del color, y el tramo de semanas va en texto para lectores de
// pantalla.

const COLOR = {
  arranque: "bg-gray-400",
  formacion: "bg-red-600",
  consultoria: "bg-white",
};

export default function Cronograma({ meses, semanas, lineas }) {
  const semanasPorMes = semanas / meses.length;

  return (
    <div className="w-full">
      {/* Cabecera de meses */}
      <div
        className="grid border-b border-white/20 pb-3 mb-6"
        style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {meses.map((mes) => (
          <p
            key={mes}
            className="font-hand text-red-500 text-xl md:text-2xl leading-[1.45]"
          >
            {mes}
          </p>
        ))}
      </div>

      <ol className="flex flex-col gap-6">
        {lineas.map((l) => (
          <li key={l.etiqueta}>
            <p className="font-body text-sm md:text-base lg:text-lg text-gray-300 leading-normal mb-2">
              {l.etiqueta}
              <span className="sr-only">
                {l.desde === l.hasta
                  ? `, semana ${l.desde}`
                  : `, de la semana ${l.desde} a la semana ${l.hasta}`}
              </span>
            </p>
            <div
              className="relative grid h-3 md:h-4 rounded-full bg-white/10"
              style={{ gridTemplateColumns: `repeat(${semanas}, minmax(0, 1fr))` }}
              aria-hidden="true"
            >
              {/* Separadores de mes */}
              {meses.slice(1).map((mes, i) => (
                <span
                  key={mes}
                  className="absolute top-0 bottom-0 w-px bg-white/30"
                  style={{ left: `${(((i + 1) * semanasPorMes) / semanas) * 100}%` }}
                />
              ))}
              <span
                className={`rounded-full ${COLOR[l.linea]}`}
                style={{ gridColumn: `${l.desde} / ${l.hasta + 1}` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
