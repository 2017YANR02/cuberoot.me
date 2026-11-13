import { type TeachingErrorCode } from '@cuberoot/shared/teaching';

export class TeachingApiException extends Error {
  constructor(
    readonly code: TeachingErrorCode,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429,
    message: string,
  ) {
    super(message);
    this.name = 'TeachingApiException';
  }
}

export class ConcealedTeachingPermissionDeniedException extends TeachingApiException {
  readonly auditReason = 'PERMISSION_DENIED';

  constructor(message: string) {
    super('RESOURCE_NOT_FOUND', 404, message);
    this.name = 'ConcealedTeachingPermissionDeniedException';
  }
}

export function uniqueConflict(error: unknown, message: string): never {
  const code = (error as { code?: string }).code;
  if (code === '23505') throw new TeachingApiException('CONFLICT', 409, message);
  throw error;
}

export function crmConflict(error: unknown, message: string): never {
  const code = (error as { code?: string }).code;
  if (code === '23505' || code === '23503' || code === '23514' || code === '23P01' || code === '55000') {
    throw new TeachingApiException('CONFLICT', 409, message);
  }
  if (code === '40001' || code === '40P01') {
    throw new TeachingApiException('CONFLICT', 409, 'Concurrent teaching update; retry the complete request');
  }
  throw error;
}
