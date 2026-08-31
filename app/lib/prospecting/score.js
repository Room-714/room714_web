// La puntuación de encaje. Lo importante de este módulo no es la fórmula, es
// QUIÉN la calcula: nosotros, no el modelo.
//
// Pedirle un número al modelo daría una cifra que nadie puede discutir —"¿por
// qué 68 y no 74?" no tiene respuesta—. Calculándolo aquí a partir de los
// cuatro veredictos, discrepar del 68 es discrepar de un veredicto concreto,
// que sí es una conversación que se puede tener mirando la evidencia de la
// ficha. Los pesos son la palanca para afinar el perfil.

export const PESOS = {
  revenue: 30, // el más caro de equivocar: define el tamaño de cliente
  digitalNeed: 30, // el que separa a un cliente de una competencia
  itTeam: 25,
  advisory: 15, // el más difícil de ver desde fuera, así que pesa menos
};

// `unclear` no vale cero: una empresa de la que no hemos podido confirmar nada
// no es lo mismo que una que sabemos que no encaja. Con el vistazo barato,
// `unclear` va a ser el veredicto más frecuente, y a cero la cola saldría vacía
// todos los días.
const FACTOR = { pass: 1, unclear: 0.4, fail: 0 };

// Por debajo del umbral no entra en la cola. Está deliberadamente bajo: el
// filtrado de verdad lo hacen las dos puertas duras de abajo, y el score sirve
// sobre todo para ORDENAR y para que se vea de un golpe cuál merece los 0,35 $
// del análisis a fondo.
export const QUALIFY_THRESHOLD = 50;

// Un `fail` en estos dos descarta pase lo que pase con el resto: una empresa de
// 300 M€ o una que hace software no encaja por mucho que su equipo de IT sea
// pequeño y necesite orientación.
const PUERTAS_DURAS = {
  revenue: "revenue",
  digitalNeed: "no_digital_need",
};

function factorDe(criterio) {
  const veredicto = criterio?.verdict;
  // Un veredicto ausente o que no reconocemos se trata como duda, nunca como
  // acierto: si el modelo devuelve basura, el sesgo tiene que ir hacia mirar
  // más, no hacia colar un candidato.
  return FACTOR[veredicto] ?? FACTOR.unclear;
}

export function scoreOf(veredictos) {
  if (!veredictos || typeof veredictos !== "object") return 0;
  const total = Object.entries(PESOS).reduce(
    (suma, [clave, peso]) => suma + peso * factorDe(veredictos[clave]),
    0,
  );
  return Math.round(total);
}

// ¿Entra en la cola? Devuelve también el porqué, para que el resumen del cron
// sea diagnosticable sin abrir la base de datos.
export function passesGate(veredictos) {
  const score = scoreOf(veredictos);

  for (const [clave, reasonCode] of Object.entries(PUERTAS_DURAS)) {
    if (veredictos?.[clave]?.verdict === "fail") {
      return { ok: false, score, reasonCode };
    }
  }

  if (score < QUALIFY_THRESHOLD) {
    return { ok: false, score, reasonCode: "other" };
  }

  return { ok: true, score, reasonCode: null };
}
