import type { FastifyInstance } from 'fastify';
import { bearerSecurity } from '../../config/swagger';
import { authenticate } from '../../middlewares/authenticate';
import { ProjectsController } from './projects.controller';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

export async function registerProjectsRoutes(app: FastifyInstance): Promise<void> {
  const repository = new ProjectsRepository(app.prisma);
  const service = new ProjectsService(repository);
  const controller = new ProjectsController(service);

  const protectedSchema = { tags: ['Projects'], security: bearerSecurity };

  app.post('/api/projects', { preHandler: authenticate, schema: protectedSchema }, (request, reply) => controller.create(request, reply));
  app.get('/api/projects', { preHandler: authenticate, schema: protectedSchema }, (request, reply) => controller.list(request, reply));
  app.get('/api/projects/:id', { preHandler: authenticate, schema: protectedSchema }, (request, reply) => controller.read(request, reply));
  app.patch('/api/projects/:id', { preHandler: authenticate, schema: protectedSchema }, (request, reply) => controller.update(request, reply));
  app.delete('/api/projects/:id', { preHandler: authenticate, schema: protectedSchema }, (request, reply) => controller.delete(request, reply));
}
