// scripts/setup-pgvector.mjs
// La extensión y el índice HNSW que `prisma db push` no crea. Idempotente:
// se puede ejecutar tantas veces como haga falta.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS vector");
  console.log("✅ extensión vector");

  // El índice HNSW hace la consulta de vecindad rápida. Con unos cientos de
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
} finally {
  await prisma.$disconnect();
}
