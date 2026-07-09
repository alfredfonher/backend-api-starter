import { PrismaClient } from '@prisma/client';

export interface DbTestContext {
  prisma: PrismaClient;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export function createDbTestContext(): DbTestContext {
  const prisma = new PrismaClient();

  return {
    prisma,
    async reset() {
      await prisma.project.deleteMany();
      await prisma.user.deleteMany();
    },
    async close() {
      await prisma.$disconnect();
    },
  };
}
