// Señal de peligro (triángulo con calavera y tibias) para la banda roja del
// problema. Blanco sobre el rojo de la banda; los huecos de la calavera van
// en ese mismo rojo para que se «recorten». SVG en línea, decorativo: el
// texto de al lado ya dice lo que significa.

const ROJO_BANDA = "#C10007"; // red-700, el fondo de la banda

export default function SenalPeligro({ className = "" }) {
  return (
    <svg
      viewBox="0 0 300 270"
      aria-hidden="true"
      focusable="false"
      className={`text-white ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* triángulo, con un leve temblor de trazo a mano */}
      <path
        d="M150 18 Q152 20 216 132 Q280 244 282 248 Q150 251 18 248 Q84 132 150 18 Z"
        strokeWidth="12"
      />

      {/* tibias cruzadas, detrás de la calavera */}
      <g strokeWidth="11">
        <path d="M100 172 L200 230" />
        <path d="M200 172 L100 230" />
      </g>
      <g fill="currentColor" stroke="none">
        <circle cx="94" cy="166" r="8" />
        <circle cx="102" cy="162" r="8" />
        <circle cx="206" cy="166" r="8" />
        <circle cx="198" cy="162" r="8" />
        <circle cx="94" cy="236" r="8" />
        <circle cx="102" cy="240" r="8" />
        <circle cx="206" cy="236" r="8" />
        <circle cx="198" cy="240" r="8" />
      </g>

      {/* calavera */}
      <g fill="currentColor" stroke="none">
        <circle cx="150" cy="138" r="40" />
        <rect x="124" y="156" width="52" height="34" rx="9" />
      </g>
      <g fill={ROJO_BANDA} stroke="none">
        <ellipse cx="134" cy="138" rx="11" ry="12" />
        <ellipse cx="166" cy="138" rx="11" ry="12" />
        <path d="M150 152 L143 165 L157 165 Z" />
      </g>
      <g stroke={ROJO_BANDA} strokeWidth="3.5">
        <path d="M138 174 L138 188" />
        <path d="M150 174 L150 188" />
        <path d="M162 174 L162 188" />
      </g>
    </svg>
  );
}
