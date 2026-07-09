import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '../../utils/sanitize';
import { ProjectsService } from './projects.service';
import { createProjectBodySchema, listProjectsQuerySchema, projectParamsSchema, updateProjectBodySchema } from './projects.schema';

export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = createProjectBodySchema.parse(request.body);
    const project = await this.service.create(request.user as AuthenticatedUser, body);
    await reply.status(201).send({ project });
  }

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = listProjectsQuerySchema.parse(request.query);
    await reply.send(await this.service.list(request.user as AuthenticatedUser, query));
  }

  async read(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = projectParamsSchema.parse(request.params);
    const project = await this.service.read(request.user as AuthenticatedUser, params.id);
    await reply.send({ project });
  }

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = projectParamsSchema.parse(request.params);
    const body = updateProjectBodySchema.parse(request.body);
    const project = await this.service.update(request.user as AuthenticatedUser, params.id, body);
    await reply.send({ project });
  }

  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = projectParamsSchema.parse(request.params);
    await this.service.delete(request.user as AuthenticatedUser, params.id);
    await reply.status(204).send();
  }
}
