import type { Prisma, PrismaClient, User } from '@prisma/client';
import { getPagination } from '../../utils/pagination';
import type { ListUsersQuery, UpdateUserBody } from './users.schema';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

export type UserRecord = Pick<User, 'id' | 'name' | 'email' | 'role'>;

function buildSearchWhere(search: string | undefined): Prisma.UserWhereInput {
  if (!search) {
    return {};
  }

  return {
    OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ],
  };
}

export class UsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ListUsersQuery): Promise<{ users: UserRecord[]; total: number }> {
    const where = buildSearchWhere(query.search);
    const { skip, take } = getPagination(query);
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, select: publicUserSelect, orderBy: { createdAt: 'asc' }, skip, take }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  }

  update(id: string, data: UpdateUserBody): Promise<UserRecord> {
    return this.prisma.user.update({ where: { id }, data, select: publicUserSelect });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
