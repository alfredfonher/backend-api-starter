import { Prisma, Role, type PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { emailConflict, invalidCredentials } from '../../utils/errors';
import { hashPassword, verifyPassword } from '../../utils/password';
import { sanitizeUser, type AuthenticatedUser, type PublicUser } from '../../utils/sanitize';
import type { LoginBody, RegisterBody } from './auth.schema';

interface LoginResult {
  accessToken: string;
  user: PublicUser;
}

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async register(input: RegisterBody): Promise<PublicUser> {
    try {
      const user = await this.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: await hashPassword(input.password),
          role: Role.USER,
        },
      });

      return sanitizeUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw emailConflict();
      }

      throw error;
    }
  }

  async login(app: FastifyInstance, input: LoginBody): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw invalidCredentials();
    }

    return {
      accessToken: app.jwt.sign({ sub: user.id }),
      user: sanitizeUser(user),
    };
  }

  me(user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
