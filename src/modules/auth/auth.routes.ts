import type { FastifyInstance } from 'fastify';
import { bearerSecurity } from '../../config/swagger';
import { authenticate } from '../../middlewares/authenticate';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const service = new AuthService(app.prisma);
  const controller = new AuthController(service);

  app.post('/api/auth/register', { schema: { tags: ['Auth'] } }, (request, reply) => controller.register(request, reply));
  app.post('/api/auth/login', { schema: { tags: ['Auth'] } }, (request, reply) => controller.login(request, reply));
  app.get('/api/auth/me', { preHandler: authenticate, schema: { tags: ['Auth'], security: bearerSecurity } }, (request, reply) => controller.me(request, reply));
}
