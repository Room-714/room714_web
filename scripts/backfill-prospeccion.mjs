// Relleno de las filas de ProspectDiscovery que ya existían antes de que la
// tabla se convirtiera en la cola diaria. Se ejecuta UNA vez, después del db
// push, y es idempotente: solo toca lo que sigue sin rellenar.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Todas las filas anteriores se crearon en el momento de enriquecer, así que su
// crédito ya está gastado y el contador del ciclo tiene que verlo. Sin esto, el
// primer ciclo diría cero gastados.
const conCredito = await prisma.$executeRawUnsafe(
  `UPDATE "ProspectDiscovery" SET "enrichedAt" = "createdAt" WHERE "enrichedAt" IS NULL`,
);

// Y ya están decididas de hecho. El reasonCode 'legacy' es deliberado: las no
// importadas se descartaron por un fallo técnico (un bug de validación de URL ya
// corregido), no porque nadie las rechazara. 'legacy' las mantiene fuera de las
// reglas derivadas, y eso vale tanto para los 'no' como para los 'yes': un 'yes'
// que nadie aceptó salvaría tramos de plantilla y contaría como acierto de
// sector, falseando el aprendizaje desde el primer día.
const decididas = await prisma.$executeRawUnsafe(
  `UPDATE "ProspectDiscovery"
      SET decision = CASE WHEN imported THEN 'yes' ELSE 'no' END,
          "reasonCode" = 'legacy',
          "decidedAt" = "createdAt"
    WHERE decision = 'pending'`,
);

console.log(`enrichedAt rellenado: ${conCredito} · decisiones marcadas: ${decididas}`);

const resumen = await prisma.prospectDiscovery.groupBy({
  by: ["decision", "reasonCode"],
  _count: true,
});
console.log("Reparto:", JSON.stringify(resumen));

await prisma.$disconnect();
