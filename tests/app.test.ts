import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp } from './helpers/app';

describe('app bootstrap', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('can build a route-only app without opening a database connection', async () => {
    app = await buildTestApp({ prisma: false });

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
  });

  describe.skipIf(!process.env.DATABASE_URL)('database bootstrap', () => {
    it('registers the Prisma decorator when database bootstrapping is enabled', async () => {
      app = await buildTestApp({ prisma: true });

      const users = await app.prisma.user.findMany();

      expect(Array.isArray(users)).toBe(true);
    });
  });

  it('wires the Prisma plugin into the default app boot path', async () => {
    vi.resetModules();
    vi.doMock('@prisma/client', () => {
      class PrismaClient {
        async $connect() {
          return undefined;
        }

        async $disconnect() {
          return undefined;
        }
      }

      return {
        PrismaClient,
        Prisma: { PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {} },
        Role: { ADMIN: 'ADMIN', USER: 'USER' },
        ProjectStatus: { PENDING: 'PENDING', ACTIVE: 'ACTIVE', COMPLETED: 'COMPLETED', ARCHIVED: 'ARCHIVED' },
      };
    });

    const { buildApp } = await import('../src/app');
    app = await buildApp({ logger: false });

    expect(app.hasDecorator('prisma')).toBe(true);
  });
});
