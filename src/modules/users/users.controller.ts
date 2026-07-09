import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '../../utils/sanitize';
import { UsersService } from './users.service';
import { listUsersQuerySchema, updateUserBodySchema, userParamsSchema } from './users.schema';

export class UsersController {
  constructor(private readonly service: UsersService) {}

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = listUsersQuerySchema.parse(request.query);
    await reply.send(await this.service.list(query));
  }

  async read(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = userParamsSchema.parse(request.params);
    const user = await this.service.read(request.user as AuthenticatedUser, params.id);
    await reply.send({ user });
  }

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = userParamsSchema.parse(request.params);
    const body = updateUserBodySchema.parse(request.body);
    const user = await this.service.update(request.user as AuthenticatedUser, params.id, body);
    await reply.send({ user });
  }

  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = userParamsSchema.parse(request.params);
    await this.service.delete(request.user as AuthenticatedUser, params.id);
    await reply.status(204).send();
  }
}
