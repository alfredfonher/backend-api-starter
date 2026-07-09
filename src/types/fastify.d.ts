import type { PrismaClient } from '@prisma/client';
import type { AuthenticatedUser } from '../utils/sanitize';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    user: AuthenticatedUser;
  }
}
