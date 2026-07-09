import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { createDbTestContext } from './helpers/db';

describe.skipIf(!process.env.DATABASE_URL)('end-to-end API', () => {
  const db = createDbTestContext();
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    await db.prisma.$connect();
    app = await buildTestApp({ prisma: true });
  });

  beforeEach(async () => {
    await db.reset();
  });

  afterAll(async () => {
    await app.close();
    await db.close();
  });

  it('exposes public health and docs while enforcing auth on protected resources', async () => {
    const healthResponse = await app.inject({ method: 'GET', url: '/health' });
    const docsRedirectResponse = await app.inject({ method: 'GET', url: '/docs' });
    const openApiResponse = await app.inject({ method: 'GET', url: '/docs/json' });
    const unauthenticatedProjectsResponse = await app.inject({ method: 'GET', url: '/api/projects' });
    const unauthenticatedMeResponse = await app.inject({ method: 'GET', url: '/api/auth/me' });

    const openApi = openApiResponse.json();

    expect(healthResponse.statusCode).toBe(200);
    expect(healthResponse.json()).toEqual({ status: 'ok', timestamp: expect.any(String) });
    expect(docsRedirectResponse.statusCode).toBe(302);
    expect(docsRedirectResponse.headers.location).toContain('docs/static/index.html');
    expect(openApiResponse.statusCode).toBe(200);
    expect(openApi.info.title).toBe('Backend API Starter');
    expect(openApi.paths['/api/auth/register'].post.security).toBeUndefined();
    expect(openApi.paths['/api/auth/login'].post.security).toBeUndefined();
    expect(openApi.paths['/api/auth/me'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(openApi.paths['/api/projects'].post.security).toEqual([{ bearerAuth: [] }]);
    expect(unauthenticatedProjectsResponse.statusCode).toBe(401);
    expect(unauthenticatedProjectsResponse.json().error.code).toBe('AUTH_UNAUTHORIZED');
    expect(unauthenticatedMeResponse.statusCode).toBe(401);
    expect(unauthenticatedMeResponse.json().error.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('runs a realistic authenticated user and project lifecycle through the API', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'E2E User',
        email: 'E2E.USER@example.com',
        password: 'password123',
      },
    });

    expect(registerResponse.statusCode).toBe(201);
    expect(registerResponse.json().user).toEqual(expect.objectContaining({
      name: 'E2E User',
      email: 'e2e.user@example.com',
      role: 'USER',
    }));
    expect(registerResponse.json().user.passwordHash).toBeUndefined();

    const userId = registerResponse.json().user.id as string;
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'e2e.user@example.com',
        password: 'password123',
      },
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json().user).toEqual(expect.objectContaining({ id: userId, email: 'e2e.user@example.com' }));
    expect(typeof loginResponse.json().accessToken).toBe('string');

    const authHeaders = { authorization: `Bearer ${loginResponse.json().accessToken as string}` };
    const meResponse = await app.inject({ method: 'GET', url: '/api/auth/me', headers: authHeaders });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json()).toEqual({ user: { id: userId, email: 'e2e.user@example.com', role: 'USER' } });

    const readUserResponse = await app.inject({ method: 'GET', url: `/api/users/${userId}`, headers: authHeaders });
    const updateUserResponse = await app.inject({
      method: 'PATCH',
      url: `/api/users/${userId}`,
      headers: authHeaders,
      payload: { name: 'Updated E2E User', email: 'UPDATED.E2E@example.com' },
    });

    expect(readUserResponse.statusCode).toBe(200);
    expect(readUserResponse.json().user.passwordHash).toBeUndefined();
    expect(updateUserResponse.statusCode).toBe(200);
    expect(updateUserResponse.json().user).toEqual(expect.objectContaining({
      id: userId,
      name: 'Updated E2E User',
      email: 'updated.e2e@example.com',
      role: 'USER',
    }));
    expect(updateUserResponse.json().user.passwordHash).toBeUndefined();

    const createProjectResponse = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: authHeaders,
      payload: {
        title: 'E2E Project',
        description: 'Created from an end-to-end API test',
        status: 'ACTIVE',
      },
    });

    expect(createProjectResponse.statusCode).toBe(201);
    expect(createProjectResponse.json().project).toEqual(expect.objectContaining({
      title: 'E2E Project',
      description: 'Created from an end-to-end API test',
      status: 'ACTIVE',
      ownerId: userId,
    }));

    const projectId = createProjectResponse.json().project.id as string;
    const listProjectsResponse = await app.inject({ method: 'GET', url: '/api/projects?page=1&limit=10&search=E2E', headers: authHeaders });
    const readProjectResponse = await app.inject({ method: 'GET', url: `/api/projects/${projectId}`, headers: authHeaders });
    const updateProjectResponse = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${projectId}`,
      headers: authHeaders,
      payload: { title: 'Completed E2E Project', status: 'COMPLETED' },
    });
    const deleteProjectResponse = await app.inject({ method: 'DELETE', url: `/api/projects/${projectId}`, headers: authHeaders });
    const deletedProjectReadResponse = await app.inject({ method: 'GET', url: `/api/projects/${projectId}`, headers: authHeaders });

    expect(listProjectsResponse.statusCode).toBe(200);
    expect(listProjectsResponse.json()).toEqual({
      data: [expect.objectContaining({ id: projectId, title: 'E2E Project', ownerId: userId })],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    expect(readProjectResponse.statusCode).toBe(200);
    expect(readProjectResponse.json().project).toEqual(expect.objectContaining({ id: projectId, title: 'E2E Project' }));
    expect(updateProjectResponse.statusCode).toBe(200);
    expect(updateProjectResponse.json().project).toEqual(expect.objectContaining({
      id: projectId,
      title: 'Completed E2E Project',
      status: 'COMPLETED',
    }));
    expect(deleteProjectResponse.statusCode).toBe(204);
    expect(deletedProjectReadResponse.statusCode).toBe(404);
    expect(deletedProjectReadResponse.json().error.code).toBe('PROJECT_NOT_FOUND');
  });
});
