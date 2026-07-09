import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createDbTestContext } from './helpers/db';
import { buildTestApp } from './helpers/app';
import { main as seed } from '../prisma/seed';

const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME,
  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
};

describe.skipIf(!process.env.DATABASE_URL)('database slice', () => {
  const db = createDbTestContext();

  beforeAll(async () => {
    await db.prisma.$connect();
  });

  afterEach(async () => {
    await db.reset();
  });

  afterAll(async () => {
    await db.close();
    process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    process.env.SEED_ADMIN_NAME = originalEnv.SEED_ADMIN_NAME;
    process.env.SEED_ADMIN_EMAIL = originalEnv.SEED_ADMIN_EMAIL;
    process.env.SEED_ADMIN_PASSWORD = originalEnv.SEED_ADMIN_PASSWORD;
  });

  it('enforces unique user email and allows owner relation discovery', async () => {
    const user = await db.prisma.user.create({
      data: {
        name: 'Owner',
        email: 'owner@example.com',
        passwordHash: 'hash',
      },
    });

    await expect(
      db.prisma.user.create({
        data: {
          name: 'Duplicate Owner',
          email: 'owner@example.com',
          passwordHash: 'hash-2',
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    });

    const project = await db.prisma.project.create({
      data: {
        title: 'Owned project',
        description: 'Project relation smoke test',
        ownerId: user.id,
      },
      include: {
        owner: true,
      },
    });

    expect(project.owner.email).toBe(user.email);
    expect(project.owner.id).toBe(user.id);
  });

  it('seed is idempotent, lowercases email, and keeps the original admin password hash on rerun', async () => {
    process.env.SEED_ADMIN_NAME = 'Seed Admin';
    process.env.SEED_ADMIN_EMAIL = 'ADMIN@EXAMPLE.COM';
    process.env.SEED_ADMIN_PASSWORD = 'InitialPass123!';

    await seed();

    const firstAdmin = await db.prisma.user.findUniqueOrThrow({
      where: { email: 'admin@example.com' },
    });

    process.env.SEED_ADMIN_PASSWORD = 'ChangedPass456!';
    await seed();

    const admins = await db.prisma.user.findMany({
      where: { email: 'admin@example.com' },
    });
    const secondAdmin = await db.prisma.user.findUniqueOrThrow({
      where: { email: 'admin@example.com' },
    });

    expect(firstAdmin.email).toBe('admin@example.com');
    expect(firstAdmin.role).toBe('ADMIN');
    expect(secondAdmin.passwordHash).toBe(firstAdmin.passwordHash);
    expect(admins).toHaveLength(1);
  });
});

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe.skipIf(!process.env.DATABASE_URL)('auth api', () => {
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

  it('registers a user with a hashed password and no password hash in the response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'New User',
        email: 'NEW.USER@example.com',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      user: expect.objectContaining({
        name: 'New User',
        email: 'new.user@example.com',
        role: 'USER',
      }),
    });
    expect(response.json().user.passwordHash).toBeUndefined();

    const storedUser = await db.prisma.user.findUniqueOrThrow({
      where: { email: 'new.user@example.com' },
    });
    expect(storedUser.passwordHash).not.toBe('password123');
    await expect(bcrypt.compare('password123', storedUser.passwordHash)).resolves.toBe(true);
  });

  it('returns a conflict error when registering a duplicate email', async () => {
    await db.prisma.user.create({
      data: {
        name: 'Existing User',
        email: 'duplicate@example.com',
        passwordHash: 'hash',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Duplicate User',
        email: 'DUPLICATE@example.com',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        message: 'Email already exists',
        code: 'EMAIL_CONFLICT',
        statusCode: 409,
      },
    });
  });

  it('maps invalid registration data to the standard validation error shape', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'A',
        email: 'not-an-email',
        password: 'short',
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 422,
      },
    });
  });

  it('logs in with valid credentials and returns a minimal JWT payload', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await db.prisma.user.create({
      data: {
        name: 'Login User',
        email: 'login@example.com',
        passwordHash,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'LOGIN@example.com',
        password: 'password123',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toEqual(expect.objectContaining({
      id: user.id,
      email: 'login@example.com',
      role: 'USER',
    }));
    expect(response.json().user.passwordHash).toBeUndefined();
    expect(typeof response.json().accessToken).toBe('string');
    expect(decodeJwtPayload(response.json().accessToken)).toEqual({
      sub: user.id,
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
  });

  it('rejects invalid login credentials', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    await db.prisma.user.create({
      data: {
        name: 'Login User',
        email: 'login@example.com',
        passwordHash,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'login@example.com',
        password: 'wrong-password',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        message: 'Invalid credentials',
        code: 'AUTH_INVALID_CREDENTIALS',
        statusCode: 401,
      },
    });
  });

  it('returns the current DB-backed user for a valid bearer token', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await db.prisma.user.create({
      data: {
        name: 'Current User',
        email: 'current@example.com',
        passwordHash,
      },
    });
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'current@example.com', password: 'password123' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${loginResponse.json().accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: user.id,
        email: 'current@example.com',
        role: 'USER',
      },
    });
  });

  it('rejects /api/auth/me without a bearer token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/me' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        message: 'Unauthorized',
        code: 'AUTH_UNAUTHORIZED',
        statusCode: 401,
      },
    });
  });

  it('rejects a valid token when the token subject user was deleted', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await db.prisma.user.create({
      data: {
        name: 'Deleted User',
        email: 'deleted@example.com',
        passwordHash,
      },
    });
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'deleted@example.com', password: 'password123' },
    });
    await db.prisma.user.delete({ where: { id: user.id } });

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${loginResponse.json().accessToken}` },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('uses the current database role on the next authenticated request after a role downgrade', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await db.prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin-auth@example.com',
        passwordHash,
        role: Role.ADMIN,
      },
    });
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'admin-auth@example.com', password: 'password123' },
    });
    const token = loginResponse.json().accessToken as string;

    const adminResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    await db.prisma.user.update({ where: { id: user.id }, data: { role: Role.USER } });
    const downgradedResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(adminResponse.json().user.role).toBe('ADMIN');
    expect(downgradedResponse.json().user.role).toBe('USER');
  });
});
