// Ilustración del hero: un maniquí de madera articulado (el de los
// dibujantes), con barba y sin más rasgos, sentado en el suelo y desbordado
// por pequeños robots que lo rodean (la IA sin control le puede). Trazo
// blanco a mano alzada sobre negro, como las ilustraciones del sitio, y el
// rojo de la marca en los ojos de los robots. SVG en línea: no pesa ni se
// pixela.
//
// Las piezas del maniquí van rellenas de negro para que, donde se cruzan
// (la pierna doblada sobre la estirada), la de delante tape a la de detrás.

const NEGRO = "#000";
const ROJO = "#EF4444"; // red-500, el de los rótulos a mano

const r2 = (n) => Math.round(n * 100) / 100;

/** Una pieza del maniquí: una cápsula entre dos puntos, de grosor w. */
function Pieza({ a, b, w }) {
  const [x1, y1] = a;
  const [x2, y2] = b;
  const largo = Math.hypot(x2 - x1, y2 - y1);
  const angulo = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <rect
      x={r2(-largo / 2)}
      y={-w / 2}
      width={r2(largo)}
      height={w}
      rx={w / 2}
      fill={NEGRO}
      transform={`translate(${r2((x1 + x2) / 2)} ${r2((y1 + y2) / 2)}) rotate(${r2(angulo)})`}
    />
  );
}

/** Una articulación: la bola de madera. */
function Bola({ x, y, r }) {
  return <circle cx={x} cy={y} r={r} fill={NEGRO} />;
}

/** Un robot de caja, como en el boceto, dibujado alrededor de (0,0). */
function Robot({ x, y, rotar = 0, escala = 1, boca = "recta" }) {
  const bocas = {
    recta: "M-5 6 L5 6",
    sonrisa: "M-5 4 Q0 9 5 4",
    enfado: "M-5 8 Q0 3 5 8",
  };
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotar}) scale(${escala})`}>
      {/* brazos, por detrás del cuerpo */}
      <path d="M-13 -2 L-28 4 M13 -6 L28 -12" />
      {/* patas con sus pies */}
      <path d="M-5 20 L-6 32 L-10 33 M5 20 L7 32 L11 32" />
      {/* cuerpo-cabeza */}
      <rect x="-13" y="-20" width="26" height="40" rx="3" fill={NEGRO} />
      <circle cx="-5" cy="-7" r="2.2" fill={ROJO} stroke="none" />
      <circle cx="5" cy="-7" r="2.2" fill={ROJO} stroke="none" />
      <path d={bocas[boca]} />
      <path d="M-13 12 L13 12" strokeWidth="2" />
    </g>
  );
}

// Rayas de la barba, recortadas por su silueta.
const RAYAS_BARBA = Array.from({ length: 12 }, (_, i) => 160 + i * 5);

export default function DibujoRobots({ className = "" }) {
  return (
    <svg
      viewBox="0 0 420 360"
      role="img"
      aria-labelledby="dibujo-robots-titulo"
      className={`text-white ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title id="dibujo-robots-titulo">
        Un maniquí de madera con barba, sentado en el suelo, rodeado de pequeños robots
      </title>
      <defs>
        <clipPath id="dibujo-robots-barba">
          <path d="M165 150 Q166 184 186 188 Q206 184 207 150 Q197 163 186 163 Q175 163 165 150 Z" />
        </clipPath>
      </defs>

      {/* suelo, a mano */}
      <path d="M30 324 C100 319 170 327 240 322 S350 319 395 324" />

      {/* brazo apoyado detrás, en el suelo */}
      <Pieza a={[166, 204]} b={[146, 248]} w={12} />
      <Bola x={144} y={252} r={6} />
      <Pieza a={[142, 256]} b={[124, 298]} w={11} />
      <Bola x={122} y={302} r={4.5} />
      <ellipse cx="118" cy="313" rx="7" ry="10" transform="rotate(20 118 313)" fill={NEGRO} />

      {/* pierna estirada */}
      <Pieza a={[210, 293]} b={[268, 301]} w={16} />
      <Bola x={272} y={302} r={7} />
      <Pieza a={[276, 303]} b={[338, 313]} w={13} />
      <Bola x={342} y={314} r={5} />
      <Pieza a={[346, 313]} b={[366, 302]} w={10} />

      {/* pelvis y tronco */}
      <Bola x={208} y={291} r={7} />
      <path
        d="M174 258 Q194 252 214 258 Q216 278 206 290 Q192 296 180 290 Q170 278 174 258 Z"
        fill={NEGRO}
      />
      <Bola x={192} y={249} r={8} />
      <path
        d="M166 198 Q190 190 214 196 Q212 222 202 238 Q190 243 180 238 Q168 222 166 198 Z"
        fill={NEGRO}
      />
      <Bola x={166} y={201} r={7} />

      {/* pierna doblada, con la rodilla arriba, por delante de la estirada */}
      <Bola x={183} y={293} r={7} />
      <Pieza a={[185, 291]} b={[236, 268]} w={16} />
      <Bola x={240} y={266} r={7} />
      <Pieza a={[243, 270]} b={[282, 313]} w={13} />
      <Bola x={285} y={317} r={5} />
      <Pieza a={[289, 319]} b={[310, 321]} w={10} />

      {/* cuello y cabeza, con barba y sin más rasgos */}
      <Pieza a={[188, 178]} b={[190, 193]} w={9} />
      <ellipse cx="186" cy="150" rx="21" ry="27" transform="rotate(-8 186 150)" fill={NEGRO} />
      <path d="M165 150 Q166 184 186 188 Q206 184 207 150 Q197 163 186 163 Q175 163 165 150 Z" fill={NEGRO} />
      <g clipPath="url(#dibujo-robots-barba)" strokeWidth="2.2">
        {RAYAS_BARBA.map((x) => (
          <path key={x} d={`M${x} 148 L${x + 4} 192`} />
        ))}
      </g>

      {/* brazo que se cubre, por delante */}
      <Bola x={214} y={199} r={7} />
      <Pieza a={[216, 203]} b={[244, 227]} w={12} />
      <Bola x={248} y={230} r={6} />
      <Pieza a={[252, 226]} b={[270, 192]} w={11} />
      <Bola x={272} y={188} r={4.5} />
      <ellipse cx="275" cy="178" rx="7" ry="10" transform="rotate(20 275 178)" fill={NEGRO} />

      {/* los robots, alrededor */}
      <Robot x={118} y={96} rotar={-8} escala={1.15} boca="enfado" />
      <Robot x={330} y={150} rotar={10} escala={1.25} boca="sonrisa" />
      <Robot x={62} y={214} rotar={18} escala={1.05} boca="recta" />
      <Robot x={262} y={70} rotar={-14} escala={0.85} boca="enfado" />

      {/* movimiento y golpes */}
      <path d="M150 78 L162 70 M152 92 L166 90 M300 128 L290 118 M298 144 L286 142" strokeWidth="2" />
      <path d="M88 236 L100 244 M84 250 L98 254 M282 166 L292 158 M288 176 L300 172" strokeWidth="2" />
    </svg>
  );
}
