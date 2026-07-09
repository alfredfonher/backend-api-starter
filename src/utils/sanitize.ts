import type { Role, User } from '@prisma/client';

export interface PublicUser {
  id: string;
  name?: string;
  email: string;
  role: Role;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

export function sanitizeUser(user: Pick<User, 'id' | 'name' | 'email' | 'role'>): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export function sanitizeAuthenticatedUser(user: Pick<User, 'id' | 'email' | 'role'>): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}
