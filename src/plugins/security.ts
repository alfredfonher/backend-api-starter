import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

export async function securityPlugin(app: FastifyInstance): Promise<void> {
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? '*',
  });
}
