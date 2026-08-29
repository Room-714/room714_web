// Vuelca a un fichero las tablas que el cambio de esquema va a tocar. No es una
// copia de la base entera: es el seguro concreto de este cambio, que borra una
// tabla y seis columnas y no se puede deshacer con git.
//
// El fichero lleva datos personales de gente real (nombres, cargos, URLs de
// LinkedIn), así que está en .gitignore y no debe salir de la máquina.
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Consultas crudas a propósito: el cliente de Prisma ya está generado contra el
// esquema NUEVO, así que un findMany no vería las columnas que estamos a punto
// de borrar, que son justo las que hay que salvar.
const datos = {
  exportadoEn: new Date().toISOString(),
  prospect: await prisma.$queryRawUnsafe(`SELECT * FROM "Prospect"`),
  prospectDiscovery: await prisma.$queryRawUnsafe(`SELECT * FROM "ProspectDiscovery"`),
  prospectEngagement: await prisma.$queryRawUnsafe(`SELECT * FROM "ProspectEngagement"`),
};

const destino = `backup-prospeccion-${datos.exportadoEn.slice(0, 10)}.json`;
writeFileSync(destino, JSON.stringify(datos, null, 2));

console.log(
  `${destino}: ${datos.prospect.length} prospectos, ` +
    `${datos.prospectDiscovery.length} descubrimientos, ` +
    `${datos.prospectEngagement.length} engagements`,
);

await prisma.$disconnect();
