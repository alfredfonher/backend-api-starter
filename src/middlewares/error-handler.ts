import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError, emailConflict } from '../utils/errors';

function toErrorBody(message: string, code: string, statusCode: number) {
  return { error: { message, code, statusCode } };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(toErrorBody(error.message, error.code, error.statusCode));
    }

    if (error instanceof ZodError) {
      return reply.status(422).send(toErrorBody('Validation failed', 'VALIDATION_ERROR', 422));
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return reply.status(409).send(toErrorBody(emailConflict().message, 'EMAIL_CONFLICT', 409));
    }

    app.log.error(error);
    return reply.status(500).send(toErrorBody('Internal server error', 'INTERNAL_SERVER_ERROR', 500));
  });
}
