import { Prisma } from '@prisma/client';
import { isAdmin } from '../../middlewares/authorize';
import { forbidden, projectNotFound } from '../../utils/errors';
import { getPaginationMeta } from '../../utils/pagination';
import { paginatedResponse, type PaginatedResponse } from '../../utils/response';
import type { AuthenticatedUser } from '../../utils/sanitize';
import { ProjectsRepository, type ProjectRecord } from './projects.repository';
import type { CreateProjectBody, ListProjectsQuery, UpdateProjectBody } from './projects.schema';

export class ProjectsService {
  constructor(private readonly repository: ProjectsRepository) {}

  async create(currentUser: AuthenticatedUser, input: CreateProjectBody): Promise<ProjectRecord> {
    return this.repository.create(currentUser.id, input);
  }

  async list(currentUser: AuthenticatedUser, query: ListProjectsQuery): Promise<PaginatedResponse<ProjectRecord>> {
    const ownerId = isAdmin(currentUser) ? undefined : currentUser.id;
    const { projects, total } = await this.repository.list({ ...query, ownerId });

    return paginatedResponse(projects, getPaginationMeta(query, total));
  }

  async read(currentUser: AuthenticatedUser, id: string): Promise<ProjectRecord> {
    return this.findAuthorizedProject(currentUser, id);
  }

  async update(currentUser: AuthenticatedUser, id: string, input: UpdateProjectBody): Promise<ProjectRecord> {
    await this.findAuthorizedProject(currentUser, id);

    try {
      return await this.repository.update(id, input);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw projectNotFound();
      }

      throw error;
    }
  }

  async delete(currentUser: AuthenticatedUser, id: string): Promise<void> {
    await this.findAuthorizedProject(currentUser, id);

    try {
      await this.repository.delete(id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw projectNotFound();
      }

      throw error;
    }
  }

  private async findAuthorizedProject(currentUser: AuthenticatedUser, id: string): Promise<ProjectRecord> {
    const project = await this.repository.findById(id);

    if (!project) {
      throw projectNotFound();
    }

    if (!isAdmin(currentUser) && project.ownerId !== currentUser.id) {
      throw forbidden();
    }

    return project;
  }
}
