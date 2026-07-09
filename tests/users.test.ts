import bcrypt from 'bcrypt';
import { Role, type User } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { createDbTestContext } from './helpers/db';

describe.skipIf(!process.env.DATABASE_URL)('users api', () => {
  const db = createDbTestContext();
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    await db.prisma.$connect();
    app = await buildTestApp({ prisma: true });
  });

  afterEach(async () => {
    await db.reset();
  });

  afterAll(async () => {
    await app.close();
    await db.close();
  });

  async function createUser(input: Partial<Pick<User, 'name' | 'email' | 'role'>> = {}): Promise<User> {
    const email = input.email ?? `user-${crypto.randomUUID()}@example.com`;

    return db.prisma.user.create({
      data: {
        name: input.name ?? 'Test User',
        email,
        passwordHash: await bcrypt.hash('password123', 10),
        role: input.role ?? Role.USER,
      },
    });
  }

  function authHeader(user: Pick<User, 'id'>): { authorization: string } {
    return { authorization: `Bearer ${app.jwt.sign({ sub: user.id })}` };
  }

  it('allows admins to list paginated searched users without password hashes', async () => {
    const admin = await createUser({ name: 'Admin User', email: 'admin@example.com', role: Role.ADMIN });
    await createUser({ name: 'Alice Searchable', email: 'alice@example.com' });
    await createUser({ name: 'Bob Hidden', email: 'bob@example.com' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/users?page=1&limit=10&search=alice',
      headers: authHeader(admin),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [
        expect.objectContaining({
          name: 'Alice Searchable',
          email: 'alice@example.com',
          role: 'USER',
        }),
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
    expect(response.json().data[0].passwordHash).toBeUndefined();
  });

  it('denies regular users from listing users', async () => {
    const regularUser = await createUser({ email: 'regular@example.com' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: authHeader(regularUser),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('AUTH_FORBIDDEN');
  });

  it('rejects invalid user list query values and invalid UUID params', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: Role.ADMIN });

    const invalidPageResponse = await app.inject({
      method: 'GET',
      url: '/api/users?page=0&limit=10',
      headers: authHeader(admin),
    });
    const invalidLimitResponse = await app.inject({
      method: 'GET',
      url: '/api/users?page=1&limit=101',
      headers: authHeader(admin),
    });
    const invalidSearchResponse = await app.inject({
      method: 'GET',
      url: `/api/users?search=${'x'.repeat(101)}`,
      headers: authHeader(admin),
    });
    const invalidUuidResponse = await app.inject({
      method: 'GET',
      url: '/api/users/not-a-uuid',
      headers: authHeader(admin),
    });

    expect(invalidPageResponse.statusCode).toBe(422);
    expect(invalidLimitResponse.statusCode).toBe(422);
    expect(invalidSearchResponse.statusCode).toBe(422);
    expect(invalidUuidResponse.statusCode).toBe(422);
    expect(invalidPageResponse.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('allows self and admin reads without password hashes', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: Role.ADMIN });
    const regularUser = await createUser({ name: 'Regular User', email: 'regular@example.com' });

    const selfResponse = await app.inject({
      method: 'GET',
      url: `/api/users/${regularUser.id}`,
      headers: authHeader(regularUser),
    });
    const adminResponse = await app.inject({
      method: 'GET',
      url: `/api/users/${regularUser.id}`,
      headers: authHeader(admin),
    });

    expect(selfResponse.statusCode).toBe(200);
    expect(adminResponse.statusCode).toBe(200);
    expect(selfResponse.json().user).toEqual(expect.objectContaining({
      id: regularUser.id,
      name: 'Regular User',
      email: 'regular@example.com',
      role: 'USER',
    }));
    expect(selfResponse.json().user.passwordHash).toBeUndefined();
    expect(adminResponse.json().user.passwordHash).toBeUndefined();
  });

  it('allows users to update their own non-role fields', async () => {
    const regularUser = await createUser({ email: 'regular@example.com' });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/users/${regularUser.id}`,
      headers: authHeader(regularUser),
      payload: { name: 'Updated Regular', email: 'UPDATED@example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toEqual(expect.objectContaining({
      id: regularUser.id,
      name: 'Updated Regular',
      email: 'updated@example.com',
      role: 'USER',
    }));
    expect(response.json().user.passwordHash).toBeUndefined();
  });

  it('rejects self role changes by regular users', async () => {
    const regularUser = await createUser({ email: 'regular@example.com' });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/users/${regularUser.id}`,
      headers: authHeader(regularUser),
      payload: { role: 'ADMIN' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ROLE_CHANGE_FORBIDDEN');
  });

  it('allows admins to change another user role', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: Role.ADMIN });
    const regularUser = await createUser({ email: 'regular@example.com' });

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/users/${regularUser.id}`,
      headers: authHeader(admin),
      payload: { role: 'ADMIN' },
    });

    const updatedUser = await db.prisma.user.findUniqueOrThrow({ where: { id: regularUser.id } });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.role).toBe('ADMIN');
    expect(updatedUser.role).toBe(Role.ADMIN);
  });

  it('rejects admin self-delete', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: Role.ADMIN });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/users/${admin.id}`,
      headers: authHeader(admin),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ADMIN_SELF_DELETE_FORBIDDEN');
  });

  it('forbids regular users from deleting users', async () => {
    const regularUser = await createUser({ email: 'regular@example.com' });
    const targetUser = await createUser({ email: 'target@example.com' });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/users/${targetUser.id}`,
      headers: authHeader(regularUser),
    });

    const existingUser = await db.prisma.user.findUnique({ where: { id: targetUser.id } });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('AUTH_FORBIDDEN');
    expect(existingUser?.id).toBe(targetUser.id);
  });

  it('allows admins to delete another user', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: Role.ADMIN });
    const targetUser = await createUser({ email: 'target@example.com' });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/users/${targetUser.id}`,
      headers: authHeader(admin),
    });

    const deletedUser = await db.prisma.user.findUnique({ where: { id: targetUser.id } });
    expect(response.statusCode).toBe(204);
    expect(deletedUser).toBeNull();
  });
});
