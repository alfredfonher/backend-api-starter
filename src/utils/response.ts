import type { PaginationMeta } from './pagination';

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export function paginatedResponse<T>(data: T[], pagination: PaginationMeta): PaginatedResponse<T> {
  return { data, pagination };
}
