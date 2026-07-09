import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';

describe('health', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('GET /health responds publicly with a server-generated timestamp', async () => {
    app = await buildTestApp({ prisma: false });

    const startedAt = Date.now();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['status', 'timestamp']);
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');

    const timestampMs = Date.parse(body.timestamp);
    expect(Number.isNaN(timestampMs)).toBe(false);
    expect(timestampMs).toBeGreaterThanOrEqual(startedAt - 1000);
    expect(timestampMs).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('GET /health ignores auth headers and stays public', async () => {
    app = await buildTestApp({ prisma: false });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        authorization: 'Bearer not-required',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.json()).sort()).toEqual(['status', 'timestamp']);
    expect(response.json().status).toBe('ok');
  });
});
