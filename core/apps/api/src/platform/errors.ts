import type { Context } from 'hono';

export type PlatformErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PAYMENT_NOT_CONFIGURED'
  | 'DATA_ENCRYPTION_NOT_CONFIGURED'
  | 'PRIVATE_DATA_UNREADABLE'
  | 'SERVICE_UNAVAILABLE'
  | 'PROVIDER_VERIFICATION_FAILED'
  | 'INVALID_STATE'
  | 'RATE_LIMITED';

export class PlatformApiError extends Error {
  constructor(
    public readonly code: PlatformErrorCode,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PlatformApiError';
  }
}

export function platformErrorHandler(error: Error, c: Context): Response {
  if (!(error instanceof PlatformApiError)) throw error;
  const body = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
  switch (error.status) {
    case 400: return c.json(body, 400);
    case 401: return c.json(body, 401);
    case 403: return c.json(body, 403);
    case 404: return c.json(body, 404);
    case 409: return c.json(body, 409);
    case 422: return c.json(body, 422);
    case 429: return c.json(body, 429);
    case 500: return c.json(body, 500);
    case 503: return c.json(body, 503);
  }
}

export function badRequest(message: string, details?: Record<string, unknown>): never {
  throw new PlatformApiError('BAD_REQUEST', 400, message, details);
}

export function notFound(resource: string): never {
  throw new PlatformApiError('NOT_FOUND', 404, `${resource} not found`);
}

export function forbidden(message = 'Platform access denied'): never {
  throw new PlatformApiError('FORBIDDEN', 403, message);
}

export function conflict(message: string, details?: Record<string, unknown>): never {
  throw new PlatformApiError('CONFLICT', 409, message, details);
}
