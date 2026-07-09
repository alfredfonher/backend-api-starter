import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError, unauthorized } from '../utils/errors';
import { sanitizeAuthenticatedUser } from '../utils/sanitize';

interface JwtSubjectPayload {
  sub?: unknown;
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    const payload = await request.jwtVerify<JwtSubjectPayload>();

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw unauthorized();
    }

    const user = await request.server.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw unauthorized();
    }

    request.user = sanitizeAuthenticatedUser(user);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw unauthorized();
  }
}
