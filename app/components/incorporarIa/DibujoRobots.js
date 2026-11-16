// Ilustración del bloque del problema: un muñeco de palitos, por los suelos,
// acosado por pequeños robots (la IA sin control le puede). Trazo blanco a
// mano alzada sobre negro, como las ilustraciones del sitio, y el rojo de la
// marca en los ojos de los robots. SVG en línea: no pesa ni se pixela.

const BLANCO = "currentColor";
const ROJO = "#EF4444"; // red-500, el de los rótulos a mano

/** Un robot pequeño, dibujado alrededor de (0,0). */
function Robot({ x, y, rotar = 0, escala = 1, piernas = true }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotar}) scale(${escala})`}>
      {/* antena */}
      <path d="M0 -21 L1 -29" />
      <circle cx="1" cy="-31" r="2.5" fill={ROJO} stroke="none" />
      {/* cabeza */}
      <rect x="-10" y="-21" width="21" height="15" rx="4" fill="#000" />
      <circle cx="-4" cy="-13.5" r="2.2" fill={ROJO} stroke="none" />
      <circle cx="5" cy="-13.5" r="2.2" fill={ROJO} stroke="none" />
      {/* cuerpo */}
      <rect x="-12" y="-5" width="25" height="18" rx="4" fill="#000" />
      <path d="M-6 3 L7 3" />
      {/* brazos */}
      <path d="M-12 0 L-19 -6" />
      <path d="M13 0 L20 -6" />
      {piernas && (
        <>
          <path d="M-6 13 L-8 21" />
          <path d="M7 13 L9 21" />
        </>
      )}
    </g>
  );
}

export default function DibujoRobots({ className = "" }) {
  return (
    <svg
      viewBox="0 0 420 360"
      role="img"
      aria-labelledby="dibujo-robots-titulo"
      className={`text-white ${className}`}
      fill="none"
      stroke={BLANCO}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title id="dibujo-robots-titulo">
        Un muñeco de palitos, caído en el suelo, al que atacan pequeños robots por todas partes
      </title>

      {/* suelo, a mano */}
      <path d="M30 318 C100 313 170 321 240 316 S350 313 395 318" />

      {/* muñeco caído de culo, echado hacia atrás */}
      {/* cabeza: ojos en cruz y boca abierta */}
      <circle cx="160" cy="214" r="24" />
      <path d="M149 206 L156 213 M156 206 L149 213" />
      <path d="M165 206 L172 213 M172 206 L165 213" />
      <ellipse cx="161" cy="226" rx="5" ry="4" />
      {/* gotas de sudor */}
      <path d="M192 196 Q196 204 192 207 Q188 204 192 196 Z" fill={BLANCO} stroke="none" />
      <path d="M128 192 Q131 198 128 200 Q125 198 128 192 Z" fill={BLANCO} stroke="none" />
      {/* tronco */}
      <path d="M170 237 L205 300" />
      {/* brazo que se cubre la cara */}
      <path d="M180 254 L140 252 L124 222" />
      {/* brazo apoyado detrás, en el suelo */}
      <path d="M184 262 L140 286 L118 314" />
      {/* pierna estirada en el suelo */}
      <path d="M205 300 L258 306 L300 314" />
      {/* pierna levantada, pataleando */}
      <path d="M205 300 L242 264 L276 252" />

      {/* robots encima */}
      <Robot x={178} y={140} rotar={-12} escala={1.35} />
      <Robot x={292} y={240} rotar={22} escala={1.3} />
      <Robot x={72} y={212} rotar={28} escala={1.3} piernas={false} />
      <path d="M34 200 L50 204 M32 216 L48 217 M36 232 L50 229" strokeWidth="2" />
      {/* y otro que llega */}
      <Robot x={316} y={130} rotar={24} escala={1.1} piernas={false} />
      <path d="M348 112 L364 106 M352 128 L370 126 M348 144 L364 148" strokeWidth="2" />

      {/* golpes y chispas */}
      <path d="M206 124 L216 114 M214 132 L228 130 M198 114 L200 102" strokeWidth="2.5" />
      <path d="M262 214 L270 204 M270 222 L282 218" strokeWidth="2.5" />
    </svg>
  );
}
