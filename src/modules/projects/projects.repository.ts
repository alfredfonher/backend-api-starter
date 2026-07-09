import type { Prisma, PrismaClient, Project } from '@prisma/client';
import { getPagination } from '../../utils/pagination';
import type { CreateProjectBody, ListProjectsQuery, UpdateProjectBody } from './projects.schema';

const publicProjectSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

export type ProjectRecord = Pick<Project, 'id' | 'title' | 'description' | 'status' | 'ownerId' | 'createdAt' | 'updatedAt'>;

interface ProjectListInput extends ListProjectsQuery {
  ownerId?: string;
}

function buildProjectWhere(query: ProjectListInput): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {};

  if (query.ownerId) {
    where.ownerId = query.ownerId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

export class ProjectsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ProjectListInput): Promise<{ projects: ProjectRecord[]; total: number }> {
    const where = buildProjectWhere(query);
    const { skip, take } = getPagination(query);
    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({ where, select: publicProjectSelect, orderBy: { createdAt: 'asc' }, skip, take }),
      this.prisma.project.count({ where }),
    ]);

    return { projects, total };
  }

  create(ownerId: string, data: CreateProjectBody): Promise<ProjectRecord> {
    return this.prisma.project.create({ data: { ...data, ownerId }, select: publicProjectSelect });
  }

  findById(id: string): Promise<ProjectRecord | null> {
    return this.prisma.project.findUnique({ where: { id }, select: publicProjectSelect });
  }

  update(id: string, data: UpdateProjectBody): Promise<ProjectRecord> {
    return this.prisma.project.update({ where: { id }, data, select: publicProjectSelect });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }
}
