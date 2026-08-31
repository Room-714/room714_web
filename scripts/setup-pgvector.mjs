// La extensión y el índice HNSW que `prisma db push` no crea.
//
// ORDEN, y es un círculo vicioso si se hace mal: `db push` NO puede crear la
// tabla ProspectMemory si el tipo `vector` no existe todavía ("ERROR: type
// vector does not exist"), y el índice HNSW no se puede crear si la tabla no
// existe. Así que la secuencia correcta es:
//
//   1. node --env-file=.env.local scripts/setup-pgvector.mjs   → crea la extensión
//   2. npx prisma db push                                       → crea la tabla
//   3. node --env-file=.env.local scripts/setup-pgvector.mjs   → crea el índice
//
// Por eso este script es idempotente Y salta lo que todavía no puede hacer en
// vez de fallar: se ejecuta dos veces, antes y después del push, y la segunda
// vez completa lo que la primera no pudo.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
  console.log("✅ extensión vector");

  const [{ existe }] = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public."ProspectMemory"') IS NOT NULL AS existe`,
  );

  if (!existe) {
    console.log(
      "⏭️  la tabla ProspectMemory todavía no existe: ejecuta `npx prisma db push` y vuelve a lanzar este script",
    );
  } else {
    // El índice HNSW hace rápida la consulta de vecindad. Con unos cientos de
    // filas daría igual, pero crearlo ahora evita tener que acordarse después.
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS prospect_memory_embedding_idx
        ON "ProspectMemory" USING hnsw (embedding vector_cosine_ops)
    `);
    console.log("✅ índice HNSW");

    const [{ count }] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS count FROM "ProspectMemory"`,
    );
    console.log("filas en ProspectMemory:", count);
  }
} finally {
  await prisma.$disconnect();
}
