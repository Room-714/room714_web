// Ordena el pozo de candidatos antes de gastar un céntimo en mirarlos.
//
// POR QUÉ ESTO EXISTE: Apollo devuelve hasta 125 caras cada mañana. Embeberlas
// todas cuesta cero; pasarles el vistazo a todas costaría 2,75 $. Ordenarlas
// por parecido con lo ya decidido es lo que permite mirar solo a los ocho o
// diez primeros y parar en cuanto hay cinco que pasan.
//
// LO QUE ESTE MÓDULO NO HACE, Y NO DEBE HACER NUNCA: filtrar. Solo decide a
// quién se MIRA primero. Si además descartara, un mal recuerdo temprano
// condenaría a todo lo que se le parezca sin que nadie llegue a mirarlo jamás
// —y con la memoria casi vacía, los primeros recuerdos son casi arbitrarios—.
// Es el mismo trinquete que rules.js ya evita con la guarda de "ningún sí".

import { textoDeCandidato } from "./embeddings";

// Cuántos vecinos se conservan por candidato. Tres bastan para el "se parece a"
// de la ficha y para una afinidad estable.
const VECINOS = 3;

// Peso de un vecino según lo cerca que esté. `<=>` da distancia coseno, donde 0
// es idéntico. Se convierte en un peso que cae con la distancia, para que un
// parecido flojo no arrastre tanto como uno fuerte.
function peso(distancia) {
  const d = Number.isFinite(distancia) ? Math.max(0, distancia) : 2;
  return 1 / (1 + d * d);
}

// Cuánto se parece este candidato a lo que aceptaste, menos cuánto se parece a
// lo que descartaste. Positivo = mirar antes.
export function afinidad(vecinos) {
  if (!Array.isArray(vecinos) || vecinos.length === 0) return 0;

  return vecinos
    // Solo las decisiones enseñan algo sobre si mirar o no. El documento de
    // criterio comercial y las conclusiones del chat sirven de contexto para el
    // modelo, no para ordenar.
    .filter((v) => (v.kind ?? "decision") === "decision")
    .reduce((suma, v) => {
      const decision = v.metadata?.decision;
      // Solo cuentan los veredictos EXPLÍCITOS, igual que hace `esMemorizabe`
      // en memory.js. Un documento sin decisión —o con `kind` mal puesto por un
      // error de escritura en otro punto— no es un descarte: es ausencia de
      // señal, y restar por ausencia de señal es inventarse información.
      if (decision !== "yes" && decision !== "no") return suma;
      return suma + (decision === "yes" ? 1 : -1) * peso(v.distance);
    }, 0);
}

// Ordena los candidatos. `embed` y `buscarVecinos` se inyectan para poder
// probar esto sin red ni base de datos.
//
// Si algo falla —Voyage caído, falta la clave— devuelve el orden original. La
// capa vectorial se degrada, no rompe: sin ella el sistema sigue llenando la
// cola, solo que mirando más empresas para conseguirlo.
export async function rankPool(candidatos = [], { embed, buscarVecinos } = {}) {
  if (candidatos.length === 0) return [];

  let vectores;
  try {
    vectores = await embed(
      candidatos.map((c) =>
        textoDeCandidato({ title: c.title, company: c.organization?.name }),
      ),
    );
  } catch (err) {
    console.error("[prospeccion] no se pudieron embeber los candidatos:", err.message);
    // Se devuelven con la MISMA forma que el camino normal, no los candidatos
    // en crudo. Un consumidor que lea `_vecinos.length` reventaría justo
    // cuando Voyage está caído, que es exactamente el momento que esta
    // degradación existe para sobrevivir.
    return candidatos.map((c, i) => ({ ...c, _vecinos: [], _afinidad: 0, _orden: i }));
  }

  const conAfinidad = [];
  for (let i = 0; i < candidatos.length; i++) {
    let vecinos = [];
    try {
      vecinos = vectores[i] ? await buscarVecinos(vectores[i], i) : [];
    } catch (err) {
      console.error("[prospeccion] consulta de vecinos falló:", err.message);
    }
    conAfinidad.push({
      ...candidatos[i],
      _vecinos: vecinos.slice(0, VECINOS),
      _afinidad: afinidad(vecinos),
      _orden: i, // el orden original de Apollo, para desempatar
    });
  }

  // Desempate por el orden de Apollo: con la memoria vacía todas las afinidades
  // son 0 y el resultado tiene que ser exactamente la lista de entrada.
  return conAfinidad.sort((a, b) => b._afinidad - a._afinidad || a._orden - b._orden);
}
