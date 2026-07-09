import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';

describe('API documentation', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('serves Swagger UI at /docs and exposes OpenAPI metadata', async () => {
    app = await buildTestApp({ prisma: false });

    const docsResponse = await app.inject({ method: 'GET', url: '/docs' });
    const specResponse = await app.inject({ method: 'GET', url: '/docs/json' });
    const spec = specResponse.json();

    expect(docsResponse.statusCode).toBe(302);
    expect(docsResponse.headers.location).toContain('docs/static/index.html');
    expect(specResponse.statusCode).toBe(200);
    expect(spec.info.title).toBe('Backend API Starter');
    expect(spec.info.version).toBe('0.0.0');
    expect(spec.components.securitySchemes.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('groups endpoints by module tags and marks protected operations with bearer auth', async () => {
    app = await buildTestApp({ prisma: true });

    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    const spec = response.json();

    expect(response.statusCode).toBe(200);
    expect(spec.tags.map((tag: { name: string }) => tag.name)).toEqual(['Health', 'Auth', 'Users', 'Projects']);
    expect(spec.paths['/health'].get.tags).toEqual(['Health']);
    expect(spec.paths['/api/auth/register'].post.tags).toEqual(['Auth']);
    expect(spec.paths['/api/auth/login'].post.security).toBeUndefined();
    expect(spec.paths['/api/auth/me'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.paths['/api/users'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.paths['/api/projects'].post.security).toEqual([{ bearerAuth: [] }]);
  });
});
