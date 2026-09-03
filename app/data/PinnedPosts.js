// Los tres artículos que se ven en la portada.
//
// A mano y por slug, no los tres últimos por fecha: la portada la lee alguien
// que está decidiendo si llamarnos, y lo que le sirve es una pieza por
// situación, no lo que se publicó el lunes. Se cambian aquí cuando haya algo
// mejor.
//
// El orden importa: es el orden en el que se pintan. Cada uno responde a una
// de las situaciones del menú:
//
//   1. IA que no llega a producción  → "IA dentro del producto"
//   2. Fricción en el flujo de cliente → "Producto para tus clientes"
//   3. Deuda técnica y software interno → "Producto para tu equipo"
//
// Un slug que no exista o que esté despublicado se ignora sin romper nada, y
// el hueco se rellena con lo más reciente.
export const PINNED_SLUGS = {
  es: [
    "piloto-ia-empresarial-que-nunca-escala-demo-a-produccion",
    "codigo-correcto-experiencia-rota-el-fallo-que-el-ticket-no-describe",
    "codigo-barato-ingenieria-cara-ia-deuda-tecnica",
  ],
  en: [
    "enterprise-ai-pilot-that-never-scales-demo-to-production",
    "technically-correct-experientially-broken-the-bug-no-ticket-captures",
    "cheap-code-expensive-engineering-ai-technical-debt",
  ],
};

export const PINNED_COUNT = 3;
