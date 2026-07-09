import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('environment example', () => {
  it('documents database and admin seed variables without real secrets', async () => {
    const content = await readFile('.env.example', 'utf8');

    expect(content).toContain('DATABASE_URL=postgresql://postgres:postgres@localhost:5050/backend_api_starter?schema=public');
    expect(content).toContain('TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5050/backend_api_starter_test?schema=public');
    expect(content).toContain('SEED_ADMIN_NAME=Admin User');
    expect(content).toContain('SEED_ADMIN_EMAIL=admin@example.com');
    expect(content).toContain('SEED_ADMIN_PASSWORD=change-me-in-local-env');
    expect(content).not.toContain('supersecret');
  });
});
