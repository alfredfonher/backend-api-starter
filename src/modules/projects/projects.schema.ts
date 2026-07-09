import { ProjectStatus } from '@prisma/client';
import { z } from 'zod';

export const projectParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.nativeEnum(ProjectStatus).optional(),
  search: z.string().trim().max(100).optional().transform((value) => value || undefined),
});

export const createProjectBodySchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().max(1000).optional().transform((value) => value || undefined),
  status: z.nativeEnum(ProjectStatus).optional(),
});

export const updateProjectBodySchema = z.object({
  title: z.string().trim().min(3).optional(),
  description: z.string().trim().max(1000).optional().transform((value) => value || undefined),
  status: z.nativeEnum(ProjectStatus).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

export type ProjectParams = z.infer<typeof projectParamsSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;
