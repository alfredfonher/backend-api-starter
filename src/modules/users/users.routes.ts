import type { FastifyInstance } from 'fastify';
import { bearerSecurity } from '../../config/swagger';
import { authenticate } from '../../middlewares/authenticate';
import { requireAdmin } from '../../middlewares/authorize';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

export async function registerUsersRoutes(app: FastifyInstance): Promise<void> {
  const repository = new UsersRepository(app.prisma);
  const service = new UsersService(repository);
  const controller = new UsersController(service);

  const protectedSchema = { tags: ['Users'], security: bearerSecurity };

  app.get('/api/users', { preHandler: [authenticate, requireAdmin], schema: protectedSchema }, (request, reply) => controller.list(request, reply));
  app.get('/api/users/:id', { preHandler: authenticate, schema: protectedSchema }, (request, reply) => controller.read(request, reply));
  app.patch('/api/users/:id', { preHandler: authenticate, schema: protectedSchema }, (request, reply) => controller.update(request, reply));
  app.delete('/api/users/:id', { preHandler: authenticate, schema: protectedSchema }, (request, reply) => controller.delete(request, reply));
}
