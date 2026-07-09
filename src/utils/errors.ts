export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'AUTH_UNAUTHORIZED'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_FORBIDDEN'
  | 'USER_NOT_FOUND'
  | 'PROJECT_NOT_FOUND'
  | 'EMAIL_CONFLICT'
  | 'ADMIN_SELF_DELETE_FORBIDDEN'
  | 'ROLE_CHANGE_FORBIDDEN'
  | 'INTERNAL_SERVER_ERROR';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: AppErrorCode,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export function unauthorized(message = 'Unauthorized'): AppError {
  return new AppError(message, 'AUTH_UNAUTHORIZED', 401);
}

export function invalidCredentials(): AppError {
  return new AppError('Invalid credentials', 'AUTH_INVALID_CREDENTIALS', 401);
}

export function emailConflict(): AppError {
  return new AppError('Email already exists', 'EMAIL_CONFLICT', 409);
}

export function forbidden(message = 'Forbidden'): AppError {
  return new AppError(message, 'AUTH_FORBIDDEN', 403);
}

export function userNotFound(): AppError {
  return new AppError('User not found', 'USER_NOT_FOUND', 404);
}

export function projectNotFound(): AppError {
  return new AppError('Project not found', 'PROJECT_NOT_FOUND', 404);
}

export function roleChangeForbidden(): AppError {
  return new AppError('Role change forbidden', 'ROLE_CHANGE_FORBIDDEN', 403);
}

export function adminSelfDeleteForbidden(): AppError {
  return new AppError('Admin self-delete forbidden', 'ADMIN_SELF_DELETE_FORBIDDEN', 403);
}
