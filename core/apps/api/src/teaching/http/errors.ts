import { type Context } from 'hono';
import { InvalidTeachingPlatformAssertionError } from '../../utils/teaching_platform_assertion.js';
import { TeachingApiException } from '../errors.js';

export function errorResponse(c: Context, error: unknown, requestId: string): Response {
  c.header('Cache-Control', 'no-store');
  if (error instanceof TeachingApiException) {
    return c.json({ error: { code: error.code, message: error.message, requestId } }, error.status);
  }
  if (error instanceof InvalidTeachingPlatformAssertionError) {
    return c.json({ error: { code: 'INVALID_PLATFORM_ASSERTION', message: error.message, requestId } }, 401);
  }
  if (error instanceof Error && error.message.includes('Authentication required')) {
    return c.json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required', requestId } }, 401);
  }
  console.error(`[500] teaching SaaS ${requestId}`, error);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Teaching service request failed', requestId } }, 500);
}
