// Cuánto ha costado una llamada. Es una ESTIMACIÓN nuestra, no la factura de
// Anthropic: la interfaz lo dice con esas palabras. Sirve para dos cosas que sí
// necesitan un número, aunque sea aproximado — el tope de gasto del cron y la
// métrica de coste por prospecto validado.
//
// Precios verificados el 2026-08-31, en dólares por millón de tokens.
// Si cambian, se cambian AQUÍ y en ningún otro sitio.
const PRECIOS = {
  "claude-opus-5": { entrada: 5, salida: 25 },
  "claude-sonnet-5": { entrada: 2, salida: 10 },
  "claude-haiku-4-5": { entrada: 1, salida: 5 },
};

// La búsqueda web se factura aparte de los tokens: 10 $ por cada mil búsquedas.
export const PRECIO_BUSQUEDA_WEB = 10 / 1000;

// La lectura de caché cuesta una décima parte del precio de entrada.
const FACTOR_CACHE = 0.1;

// Escribir en caché tiene RECARGO, al contrario que leer: 1,25× el precio de
// entrada con TTL de 5 minutos y 2× con TTL de 1 hora.
const FACTOR_ESCRITURA_5M = 1.25;
const FACTOR_ESCRITURA_1H = 2;

// Fallar en CERRADO ante un modelo desconocido. Creerse más barato de lo que
// uno es lleva a pasarse del tope diario sin que nada avise; creerse más caro
// solo hace que el cron pare antes, que es el lado seguro.
const MAS_CARO = Object.values(PRECIOS).reduce(
  (peor, p) => ({
    entrada: Math.max(peor.entrada, p.entrada),
    salida: Math.max(peor.salida, p.salida),
  }),
  { entrada: 0, salida: 0 },
);

function num(valor) {
  return Number.isFinite(valor) ? valor : 0;
}

// El desglose por TTL (`usage.cache_creation`) es lo que trae la API cuando lo
// trae. Si solo llega el agregado `cache_creation_input_tokens` sin desglose,
// no sabemos si esos tokens son de 5 minutos o de 1 hora — y la diferencia de
// precio es de casi el doble. Igual que con MAS_CARO, se falla en CERRADO: se
// cobra al peor caso (2x), no a una media ni al más barato. Que alguien
// "optimice" esto a 1,25x sin leer este comentario sería exactamente el tipo
// de cambio silencioso que hace que el tope de gasto deje de proteger nada.
function costoEscrituraCache(usage, precio) {
  const desglose = usage.cache_creation;
  if (desglose) {
    const cincoMin = num(desglose.ephemeral_5m_input_tokens);
    const unaHora = num(desglose.ephemeral_1h_input_tokens);
    return (
      (cincoMin * precio.entrada * FACTOR_ESCRITURA_5M) / 1e6 +
      (unaHora * precio.entrada * FACTOR_ESCRITURA_1H) / 1e6
    );
  }
  const agregado = num(usage.cache_creation_input_tokens);
  return (agregado * precio.entrada * FACTOR_ESCRITURA_1H) / 1e6;
}

export function costOf(model, usage) {
  if (!usage) return 0;
  const precio = PRECIOS[model] ?? MAS_CARO;

  const entrada = num(usage.input_tokens);
  const salida = num(usage.output_tokens);
  const cache = num(usage.cache_read_input_tokens);
  const busquedas = num(usage.server_tool_use?.web_search_requests);

  return (
    (entrada * precio.entrada) / 1e6 +
    (salida * precio.salida) / 1e6 +
    (cache * precio.entrada * FACTOR_CACHE) / 1e6 +
    costoEscrituraCache(usage, precio) +
    busquedas * PRECIO_BUSQUEDA_WEB
  );
}

// Suma las llamadas de una ejecución. Cada elemento es `{ model, usage }`.
export function sumCosts(llamadas = []) {
  return llamadas.reduce((total, l) => total + costOf(l?.model, l?.usage), 0);
}
