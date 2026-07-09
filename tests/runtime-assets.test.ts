import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('runtime assets', () => {
  it('documents required environment variables without committed runtime secrets', async () => {
    const content = await readFile('.env.example', 'utf8');

    expect(content).toContain('DATABASE_URL=postgresql://postgres:postgres@localhost:5050/backend_api_starter?schema=public');
    expect(content).toContain('TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5050/backend_api_starter_test?schema=public');
    expect(content).toContain('JWT_SECRET=replace-with-at-least-32-characters');
    expect(content).toContain('CORS_ORIGIN=*');
    expect(content).toContain('SEED_ADMIN_PASSWORD=change-me-in-local-env');
    expect(content).not.toContain('supersecret');
  });

  it('defines Docker runtime services and package scripts for local API and PostgreSQL startup', async () => {
    const [dockerfile, compose, packageJson] = await Promise.all([
      readFile('Dockerfile', 'utf8'),
      readFile('docker-compose.yml', 'utf8'),
      readFile('package.json', 'utf8'),
    ]);
    const scripts = JSON.parse(packageJson).scripts;

    expect(dockerfile).toContain('FROM node:20-slim');
    expect(dockerfile).toContain('CMD ["node", "dist/server.js"]');
    expect(compose).toContain('api:');
    expect(compose).toContain('postgres:');
    expect(compose).toContain('DATABASE_URL');
    expect(compose).toContain("'5055:3000'");
    expect(compose).toContain("'5050:5432'");
    expect(scripts['docker:up']).toBe('docker compose up -d');
    expect(scripts['docker:down']).toBe('docker compose down');
  });

  it('provides reviewer-facing README and license documentation', async () => {
    const [readme, license, gitignore, dockerignore] = await Promise.all([
      readFile('README.md', 'utf8'),
      readFile('LICENSE', 'utf8'),
      readFile('.gitignore', 'utf8'),
      readFile('.dockerignore', 'utf8'),
    ]);

    expect(readme).toContain('# Backend API Starter');
    expect(readme).toContain('## Quick path');
    expect(readme).toContain('## API documentation');
    expect(readme).toContain('## Architecture');
    expect(readme).toContain('pnpm test');
    expect(readme).toContain('The Compose file exposes the development PostgreSQL service on host port `5050`.');
    expect(readme).toContain('The API is published at `http://localhost:5055`');
    expect(readme).toContain('Use `TEST_DATABASE_URL` to point tests at a dedicated test database.');
    expect(readme).not.toContain('a test database on port `5004`');
    expect(license).toContain('MIT License');
    expect(gitignore).toContain('node_modules/');
    expect(gitignore).toContain('dist/');
    expect(gitignore).toContain('.env');
    expect(dockerignore).toContain('node_modules');
    expect(dockerignore).toContain('.env');
  });
});
