import { Prisma } from '@prisma/client';
import { canAccessUser, isAdmin, isSelf } from '../../middlewares/authorize';
import { adminSelfDeleteForbidden, emailConflict, forbidden, roleChangeForbidden, userNotFound } from '../../utils/errors';
import { getPaginationMeta } from '../../utils/pagination';
import { paginatedResponse, type PaginatedResponse } from '../../utils/response';
import type { AuthenticatedUser, PublicUser } from '../../utils/sanitize';
import { UsersRepository } from './users.repository';
import type { ListUsersQuery, UpdateUserBody } from './users.schema';

export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async list(query: ListUsersQuery): Promise<PaginatedResponse<PublicUser>> {
    const { users, total } = await this.repository.list(query);

    return paginatedResponse(users, getPaginationMeta(query, total));
  }

  async read(currentUser: AuthenticatedUser, targetUserId: string): Promise<PublicUser> {
    if (!canAccessUser(currentUser, targetUserId)) {
      throw forbidden();
    }

    const user = await this.repository.findById(targetUserId);
    if (!user) {
      throw userNotFound();
    }

    return user;
  }

  async update(currentUser: AuthenticatedUser, targetUserId: string, input: UpdateUserBody): Promise<PublicUser> {
    if (!canAccessUser(currentUser, targetUserId)) {
      throw forbidden();
    }

    if (input.role && !isAdmin(currentUser)) {
      throw roleChangeForbidden();
    }

    if (input.role && isSelf(currentUser, targetUserId)) {
      throw roleChangeForbidden();
    }

    try {
      return await this.repository.update(targetUserId, input);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw emailConflict();
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw userNotFound();
      }

      throw error;
    }
  }

  async delete(currentUser: AuthenticatedUser, targetUserId: string): Promise<void> {
    if (!isAdmin(currentUser)) {
      throw forbidden();
    }

    if (isSelf(currentUser, targetUserId)) {
      throw adminSelfDeleteForbidden();
    }

    try {
      await this.repository.delete(targetUserId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw userNotFound();
      }

      throw error;
    }
  }
}
