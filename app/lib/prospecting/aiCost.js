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

export function costOf(model, usage) {
  if (!usage) return 0;
  const precio = PRECIOS[model] ?? MAS_CARO;

  const entrada = num(usage.input_tokens);
  const salida = num(usage.output_tokens);
  const cache = num(usage.cache_read_input_tokens);
  const creacionCache = num(usage.cache_creation_input_tokens);
  const busquedas = num(usage.server_tool_use?.web_search_requests);

  return (
    ((entrada + creacionCache) * precio.entrada) / 1e6 +
    (salida * precio.salida) / 1e6 +
    (cache * precio.entrada * FACTOR_CACHE) / 1e6 +
    busquedas * PRECIO_BUSQUEDA_WEB
  );
}

// Suma las llamadas de una ejecución. Cada elemento es `{ model, usage }`.
export function sumCosts(llamadas = []) {
  return llamadas.reduce((total, l) => total + costOf(l?.model, l?.usage), 0);
}
