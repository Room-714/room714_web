// Las tres métricas que dicen si el sistema está mejorando de verdad.
//
// Existen porque "cada día más eficaz" es una HIPÓTESIS, no una propiedad. La
// memoria vectorial puede no aportar nada, y sin estos números eso no se
// sabría: un sistema que no se puede evaluar tiende a recibir el crédito de
// mejoras que no existen.
//
// Todo puro: recibe filas y devuelve números, y `ahora` se inyecta para que los
// tests puedan situarse en cualquier día.

const VENTANA_DIAS = 7;
const DIA_MS = 24 * 60 * 60 * 1000;

function dentroDeVentana(fecha, ahora) {
  if (!fecha) return false;
  return ahora.getTime() - new Date(fecha).getTime() <= VENTANA_DIAS * DIA_MS;
}

export function efficiencyMetrics({
  ejecuciones = [],
  decisiones = [],
  costeTotal = 0,
  ahora = new Date(),
} = {}) {
  const recientes = ejecuciones.filter((e) => dentroDeVentana(e.shownOn, ahora));

  // "Decidida" es un yes o un no explícito, nunca "distinto de pending": si la
  // columna acabara admitiendo null, todo lo pendiente contaría como decidido y
  // la tasa de aceptación se hundiría sin que nada hubiera cambiado.
  const decididas = decisiones.filter(
    (d) => (d.decision === "yes" || d.decision === "no") && dentroDeVentana(d.decidedAt, ahora),
  );

  const miradas = recientes.reduce((s, e) => s + (e.miradas ?? 0), 0);
  const encoladas = recientes.reduce((s, e) => s + (e.encoladas ?? 0), 0);
  const aceptadas = decididas.filter((d) => d.decision === "yes").length;

  return {
    // Cuántas empresas hay que mirar para llenar un hueco de la cola. Es la
    // métrica que debe BAJAR si la memoria está ordenando bien.
    vistazosPorFicha: encoladas > 0 ? miradas / encoladas : null,

    // De las fichas que llegan a la cola, cuántas acabas aceptando. Debe SUBIR
    // si el cualificador está calibrando bien contra tu criterio.
    tasaAceptacion: decididas.length > 0 ? aceptadas / decididas.length : null,

    // Lo que cuesta cada prospecto validado. Debe BAJAR. Null y no Infinity
    // cuando no hay aceptados: en pantalla se pinta "—", que es la verdad.
    costePorValidado: aceptadas > 0 ? costeTotal / aceptadas : null,

    ventanaDias: VENTANA_DIAS,

    // La muestra va con el resultado a propósito: una tasa del 100% con una
    // sola decisión no significa nada, y quien mire la pantalla tiene que poder
    // desconfiar del número sin ir a buscar el denominador a otra parte.
    muestra: { miradas, encoladas, decididas: decididas.length, aceptadas },
  };
}
