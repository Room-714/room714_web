// La memoria de la prospección: qué se guarda, cómo se representa en texto y
// cómo se consultan los vecinos.
//
// Prisma no tiene tipo nativo para `vector`, así que todo lo que toca la
// columna `embedding` pasa por SQL en crudo. Las funciones puras (el texto, el
// filtro de memorizables, el literal) están arriba y separadas para poder
// probarlas sin base de datos.

import { embedTexts, textoDeCandidato } from "./embeddings";

// ─── Puro ───────────────────────────────────────────────────────────────────

// El texto que se embebe de una decisión. La decisión va AL FINAL porque es la
// etiqueta: lo que queremos que el modelo asocie con el resto de la frase.
export function textoDeDecision(fila = {}) {
  const cabecera = textoDeCandidato(fila);
  const criterio = [
    fila.sectorQuery,
    fila.sizeQuery ? `${String(fila.sizeQuery).replace(",", "-")} empleados` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const resumen = fila.dossier?.summary ?? null;

  const etiqueta =
    fila.decision === "yes"
      ? "ACEPTADO"
      : `DESCARTADO por ${fila.reasonCode ?? "sin motivo"}`;

  return [cabecera, criterio ? `buscado como ${criterio}` : null, resumen, etiqueta]
    .filter(Boolean)
    .join(" · ");
}

// Qué filas entran en la memoria. La guarda de `legacy` es la misma que ya
// aplica rules.js y por el mismo motivo: son decisiones que puso una migración,
// no una persona. En producción son 48 de 52, así que dejarlas entrar sería
// llenar la memoria de criterio inventado desde el primer día.
export function esMemorizabe(fila = {}) {
  if (fila.reasonCode === "legacy") return false;
  return fila.decision === "yes" || fila.decision === "no";
}

// pgvector acepta el vector como literal de texto: '[0.1,-0.2,0]'.
export function vectorLiteral(vector) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("vector vacío o no es un array");
  }
  if (!vector.every((n) => Number.isFinite(n))) {
    throw new Error("el vector lleva valores que no son números finitos");
  }
  return `[${vector.join(",")}]`;
}

// ─── Con base de datos ──────────────────────────────────────────────────────

// Guarda un documento. `prisma` se inyecta para poder probar el resto sin base.
export async function remember(
  prisma,
  { kind, sourceId = null, text, metadata = {}, embedding },
) {
  const literal = vectorLiteral(embedding);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProspectMemory" (kind, "sourceId", text, metadata, embedding)
     VALUES ($1, $2, $3, $4::jsonb, $5::vector)`,
    kind,
    sourceId,
    text,
    JSON.stringify(metadata),
    literal,
  );
}

// Guarda la decisión de un candidato. Se llama al aceptar y al descartar.
export async function rememberDecision(prisma, fila, opciones = {}) {
  if (!esMemorizabe(fila)) return { guardado: false, motivo: "no memorizable" };

  const text = textoDeDecision(fila);
  const [embedding] = await embedTexts([text], { ...opciones, inputType: "document" });
  if (!embedding) return { guardado: false, motivo: "sin embedding" };

  await remember(prisma, {
    kind: "decision",
    sourceId: fila.apolloId ?? null,
    text,
    metadata: {
      decision: fila.decision,
      reasonCode: fila.reasonCode ?? null,
      company: fila.company ?? null,
      title: fila.title ?? null,
      sectorQuery: fila.sectorQuery ?? null,
      sizeQuery: fila.sizeQuery ?? null,
      score: fila.score ?? null,
    },
    embedding,
  });

  return { guardado: true };
}

// Los `k` documentos más cercanos a un vector. `<=>` es distancia coseno: 0 es
// idéntico, 2 es opuesto. Se devuelve también la distancia para poder decidir
// si el parecido es lo bastante bueno como para enseñarlo en la ficha.
export async function nearest(prisma, embedding, { k = 5, kinds = null } = {}) {
  const literal = vectorLiteral(embedding);
  const filtroKind = kinds?.length ? `WHERE kind = ANY($3)` : "";

  const params = [literal, k];
  if (kinds?.length) params.push(kinds);

  return prisma.$queryRawUnsafe(
    `SELECT id, kind, "sourceId", text, metadata,
            (embedding <=> $1::vector) AS distance
       FROM "ProspectMemory"
       ${filtroKind}
      ORDER BY embedding <=> $1::vector
      LIMIT $2`,
    ...params,
  );
}

// Cuántos documentos hay. La pantalla lo usa para explicar el arranque en frío:
// con la memoria casi vacía, el orden de la cola es poco más que el de Apollo.
export async function memorySize(prisma) {
  const [fila] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM "ProspectMemory" WHERE kind = 'decision'`,
  );
  return fila?.n ?? 0;
}
