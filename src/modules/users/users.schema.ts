import { Role } from '@prisma/client';
import { z } from 'zod';

export const userParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional().transform((value) => value || undefined),
});

export const updateUserBodySchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  role: z.nativeEnum(Role).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

export type UserParams = z.infer<typeof userParamsSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
