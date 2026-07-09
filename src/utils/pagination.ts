export interface PaginationInput {
  page: number;
  limit: number;
}

export interface PaginationMeta extends PaginationInput {
  total: number;
  totalPages: number;
}

export function getPagination(input: PaginationInput): { skip: number; take: number } {
  return {
    skip: (input.page - 1) * input.limit,
    take: input.limit,
  };
}

export function getPaginationMeta(input: PaginationInput, total: number): PaginationMeta {
  return {
    page: input.page,
    limit: input.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / input.limit)),
  };
}
