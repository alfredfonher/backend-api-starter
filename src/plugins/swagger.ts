import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { swaggerConfig } from '../config/swagger';

export async function swaggerPlugin(app: FastifyInstance): Promise<void> {
  await app.register(swagger, swaggerConfig);
  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });
}
