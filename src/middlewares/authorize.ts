import { Role } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { forbidden } from '../utils/errors';
import type { AuthenticatedUser } from '../utils/sanitize';

export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === Role.ADMIN;
}

export function isSelf(user: AuthenticatedUser, targetUserId: string): boolean {
  return user.id === targetUserId;
}

export function canAccessUser(user: AuthenticatedUser, targetUserId: string): boolean {
  return isAdmin(user) || isSelf(user, targetUserId);
}

export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!isAdmin(request.user as AuthenticatedUser)) {
    throw forbidden();
  }
}
