import bcrypt from 'bcrypt';
import { ProjectStatus, Role, type Project, type User } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { createDbTestContext } from './helpers/db';

describe.skipIf(!process.env.DATABASE_URL)('projects api', () => {
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
    return db.prisma.user.create({
      data: {
        name: input.name ?? 'Project User',
        email: input.email ?? `project-user-${crypto.randomUUID()}@example.com`,
        passwordHash: await bcrypt.hash('password123', 10),
        role: input.role ?? Role.USER,
      },
    });
  }

  async function createProject(owner: Pick<User, 'id'>, input: Partial<Pick<Project, 'title' | 'description' | 'status'>> = {}): Promise<Project> {
    return db.prisma.project.create({
      data: {
        title: input.title ?? 'Owned Project',
        description: input.description ?? 'Project description',
        status: input.status ?? ProjectStatus.PENDING,
        ownerId: owner.id,
      },
    });
  }

  function authHeader(user: Pick<User, 'id'>): { authorization: string } {
    return { authorization: `Bearer ${app.jwt.sign({ sub: user.id })}` };
  }

  it('creates projects for the authenticated owner and ignores client ownerId input', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const otherUser = await createUser({ email: 'other@example.com' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: authHeader(owner),
      payload: {
        title: 'Authenticated Owner Project',
        description: 'Created through the projects API',
        status: 'ACTIVE',
        ownerId: otherUser.id,
      },
    });

    const storedProject = await db.prisma.project.findUniqueOrThrow({ where: { id: response.json().project.id } });
    expect(response.statusCode).toBe(201);
    expect(response.json().project).toEqual(expect.objectContaining({
      title: 'Authenticated Owner Project',
      description: 'Created through the projects API',
      status: 'ACTIVE',
      ownerId: owner.id,
    }));
    expect(storedProject.ownerId).toBe(owner.id);
    expect(storedProject.ownerId).not.toBe(otherUser.id);
  });

  it('lists only owned projects for regular users with the users pagination shape', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const otherUser = await createUser({ email: 'other@example.com' });
    await createProject(owner, { title: 'Visible Project', status: ProjectStatus.ACTIVE });
    await createProject(otherUser, { title: 'Hidden Project', status: ProjectStatus.ACTIVE });

    const response = await app.inject({
      method: 'GET',
      url: '/api/projects?page=1&limit=10',
      headers: authHeader(owner),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [expect.objectContaining({ title: 'Visible Project', ownerId: owner.id })],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    expect(response.json().data).toHaveLength(1);
  });

  it('allows admins to list projects across owners and filters by status', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: Role.ADMIN });
    const firstOwner = await createUser({ email: 'first-owner@example.com' });
    const secondOwner = await createUser({ email: 'second-owner@example.com' });
    await createProject(firstOwner, { title: 'Active Project', status: ProjectStatus.ACTIVE });
    await createProject(secondOwner, { title: 'Archived Project', status: ProjectStatus.ARCHIVED });

    const allResponse = await app.inject({
      method: 'GET',
      url: '/api/projects?page=1&limit=10',
      headers: authHeader(admin),
    });
    const filteredResponse = await app.inject({
      method: 'GET',
      url: '/api/projects?status=ARCHIVED&page=1&limit=10',
      headers: authHeader(admin),
    });

    expect(allResponse.statusCode).toBe(200);
    expect(allResponse.json().data).toHaveLength(2);
    expect(filteredResponse.statusCode).toBe(200);
    expect(filteredResponse.json()).toEqual({
      data: [expect.objectContaining({ title: 'Archived Project', status: 'ARCHIVED', ownerId: secondOwner.id })],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it('filters project lists by optional search text', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    await createProject(owner, { title: 'Searchable Roadmap', description: 'Visible planning work' });
    await createProject(owner, { title: 'Hidden Backlog', description: 'Unmatched work' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/projects?search=roadmap&page=1&limit=10',
      headers: authHeader(owner),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [expect.objectContaining({ title: 'Searchable Roadmap', ownerId: owner.id })],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    expect(response.json().data).toHaveLength(1);
  });

  it('allows owners and admins to read, update, and delete projects', async () => {
    const admin = await createUser({ email: 'admin@example.com', role: Role.ADMIN });
    const owner = await createUser({ email: 'owner@example.com' });
    const ownerProject = await createProject(owner, { title: 'Owner Read Project' });
    const adminProject = await createProject(owner, { title: 'Admin Delete Project' });

    const ownerReadResponse = await app.inject({ method: 'GET', url: `/api/projects/${ownerProject.id}`, headers: authHeader(owner) });
    const ownerUpdateResponse = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${ownerProject.id}`,
      headers: authHeader(owner),
      payload: { title: 'Owner Updated Project', status: 'COMPLETED' },
    });
    const adminReadResponse = await app.inject({ method: 'GET', url: `/api/projects/${ownerProject.id}`, headers: authHeader(admin) });
    const adminDeleteResponse = await app.inject({ method: 'DELETE', url: `/api/projects/${adminProject.id}`, headers: authHeader(admin) });

    const deletedProject = await db.prisma.project.findUnique({ where: { id: adminProject.id } });
    expect(ownerReadResponse.statusCode).toBe(200);
    expect(ownerReadResponse.json().project.ownerId).toBe(owner.id);
    expect(ownerUpdateResponse.statusCode).toBe(200);
    expect(ownerUpdateResponse.json().project).toEqual(expect.objectContaining({ title: 'Owner Updated Project', status: 'COMPLETED' }));
    expect(adminReadResponse.statusCode).toBe(200);
    expect(adminDeleteResponse.statusCode).toBe(204);
    expect(deletedProject).toBeNull();
  });

  it('denies non-owner access while returning not found for missing projects', async () => {
    const owner = await createUser({ email: 'owner@example.com' });
    const otherUser = await createUser({ email: 'other@example.com' });
    const project = await createProject(owner, { title: 'Private Project' });
    const missingProjectId = crypto.randomUUID();

    const readResponse = await app.inject({ method: 'GET', url: `/api/projects/${project.id}`, headers: authHeader(otherUser) });
    const updateResponse = await app.inject({ method: 'PATCH', url: `/api/projects/${project.id}`, headers: authHeader(otherUser), payload: { title: 'Denied' } });
    const deleteResponse = await app.inject({ method: 'DELETE', url: `/api/projects/${project.id}`, headers: authHeader(otherUser) });
    const missingResponse = await app.inject({ method: 'GET', url: `/api/projects/${missingProjectId}`, headers: authHeader(otherUser) });

    expect(readResponse.statusCode).toBe(403);
    expect(updateResponse.statusCode).toBe(403);
    expect(deleteResponse.statusCode).toBe(403);
    expect(readResponse.json().error.code).toBe('AUTH_FORBIDDEN');
    expect(updateResponse.json().error.code).toBe('AUTH_FORBIDDEN');
    expect(deleteResponse.json().error.code).toBe('AUTH_FORBIDDEN');
    expect(missingResponse.statusCode).toBe(404);
    expect(missingResponse.json().error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('rejects invalid status values and invalid pagination input', async () => {
    const user = await createUser({ email: 'owner@example.com' });
    const project = await createProject(user);

    const invalidCreateStatus = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: authHeader(user),
      payload: { title: 'Invalid Status Project', status: 'INVALID' },
    });
    const invalidUpdateStatus = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${project.id}`,
      headers: authHeader(user),
      payload: { status: 'INVALID' },
    });
    const invalidFilterStatus = await app.inject({ method: 'GET', url: '/api/projects?status=INVALID', headers: authHeader(user) });
    const invalidPage = await app.inject({ method: 'GET', url: '/api/projects?page=0&limit=10', headers: authHeader(user) });
    const invalidLowLimit = await app.inject({ method: 'GET', url: '/api/projects?page=1&limit=0', headers: authHeader(user) });
    const invalidHighLimit = await app.inject({ method: 'GET', url: '/api/projects?page=1&limit=101', headers: authHeader(user) });

    expect(invalidCreateStatus.statusCode).toBe(422);
    expect(invalidUpdateStatus.statusCode).toBe(422);
    expect(invalidFilterStatus.statusCode).toBe(422);
    expect(invalidPage.statusCode).toBe(422);
    expect(invalidLowLimit.statusCode).toBe(422);
    expect(invalidHighLimit.statusCode).toBe(422);
    expect(invalidCreateStatus.json().error.code).toBe('VALIDATION_ERROR');
  });
});
