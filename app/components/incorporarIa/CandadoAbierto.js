// Ilustración de la banda roja del problema: un candado abierto del que se
// escapan hojas (los datos de la empresa saliendo sin control). Trazo blanco
// a mano alzada sobre el rojo de la banda, como el resto de dibujos del
// sitio. SVG en línea, decorativo: el texto de al lado ya dice lo que
// significa.

/** Una hoja con la esquina doblada y tres renglones, centrada en (0,0). */
function Hoja({ x, y, rotar = 0, escala = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotar}) scale(${escala})`}>
      <path d="M-18 -24 L8 -24 L18 -14 L18 24 L-18 24 Z" />
      <path d="M8 -24 L8 -14 L18 -14" />
      <path d="M-10 -8 L10 -8 M-10 2 L10 2 M-10 12 L4 12" strokeWidth="3" />
    </g>
  );
}

export default function CandadoAbierto({ className = "" }) {
  return (
    <svg
      viewBox="0 0 300 270"
      aria-hidden="true"
      focusable="false"
      className={`text-white ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* arco abierto: la pata derecha ha salido de su hueco */}
      <path d="M86 140 L86 92 Q86 46 128 44 Q170 44 172 90 L172 104" strokeWidth="11" />

      {/* cuerpo, con un leve temblor de trazo */}
      <path
        d="M58 142 Q130 138 202 141 Q206 196 202 250 Q130 254 58 250 Q54 196 58 142 Z"
        strokeWidth="10"
      />
      {/* bocallave */}
      <g fill="currentColor" stroke="none">
        <circle cx="130" cy="186" r="13" />
        <path d="M124 192 L136 192 L140 222 L120 222 Z" />
      </g>

      {/* las hojas que se escapan */}
      <Hoja x={214} y={112} rotar={14} escala={0.9} />
      <Hoja x={248} y={62} rotar={-12} escala={1} />
      <Hoja x={192} y={36} rotar={22} escala={0.75} />

      {/* estelas del vuelo */}
      <path d="M180 132 Q190 126 194 118 M232 92 Q238 86 238 80 M210 62 Q206 56 200 54" strokeWidth="3.5" />
    </svg>
  );
}
