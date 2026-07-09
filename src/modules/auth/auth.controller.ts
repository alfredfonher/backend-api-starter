import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '../../utils/sanitize';
import { AuthService } from './auth.service';
import { loginBodySchema, registerBodySchema } from './auth.schema';

export class AuthController {
  constructor(private readonly service: AuthService) {}

  async register(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = registerBodySchema.parse(request.body);
    const user = await this.service.register(body);

    await reply.status(201).send({ user });
  }

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const body = loginBodySchema.parse(request.body);
    const result = await this.service.login(request.server, body);

    await reply.send(result);
  }

  async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await reply.send({ user: this.service.me(request.user as AuthenticatedUser) });
  }
}
