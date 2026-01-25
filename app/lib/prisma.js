import { PrismaClient } from "@prisma/client";

const globalForPrisma = global;

// En la v6, el constructor vacío es la forma más estable
export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
