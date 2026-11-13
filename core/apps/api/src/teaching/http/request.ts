import { type Context } from 'hono';
import { randomUUID } from 'node:crypto';
import { sha256 } from '../encoding.js';
import { type ConversationMessagePageInput, type PageInput, type JsonObject } from '../types.js';
import { TeachingApiException } from '../errors.js';

export function trainingReviewRequestHash(assignmentId: string, studentId: string, rawBody: string): string {
  return sha256(JSON.stringify([assignmentId, studentId, rawBody]));
}

export function conversationMessagePaginationOf(c: Context): ConversationMessagePageInput {
  assertQueryKeys(c, ['afterSequence', 'limit']);
  const afterRaw = c.req.query('afterSequence');
  const limitRaw = c.req.query('limit');
  const afterSequence = afterRaw === undefined ? 0 : Number(afterRaw);
  const limit = limitRaw === undefined ? 50 : Number(limitRaw);
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0 || afterSequence > 2_147_483_647
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new TeachingApiException(
      'INVALID_INPUT', 400,
      'afterSequence must be a non-negative integer and limit must be 1 to 100',
    );
  }
  return { afterSequence, limit };
}

export function requestIdOf(c: Context): string {
  const supplied = c.req.header('X-Request-ID')?.trim();
  return supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
}

export function idempotencyKeyOf(c: Context): string {
  const key = c.req.header('Idempotency-Key')?.trim() ?? '';
  if (!key) {
    throw new TeachingApiException('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
  }
  if (key.length > 200 || !/^[\x21-\x7e]+$/.test(key)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'Idempotency-Key must be 1 to 200 visible ASCII characters');
  }
  return key;
}

export function paginationOf(c: Context): PageInput {
  const pageRaw = c.req.query('page');
  const pageSizeRaw = c.req.query('pageSize');
  const page = pageRaw === undefined ? 1 : Number(pageRaw);
  const pageSize = pageSizeRaw === undefined ? 30 : Number(pageSizeRaw);
  if (
    !Number.isSafeInteger(page) || page < 1 || page > 1_000_000 ||
    !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100
  ) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'page must be positive and pageSize must be 1 to 100');
  }
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function assertQueryKeys(c: Context, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unexpected = [...new URL(c.req.url).searchParams.keys()].find((key) => !allowedSet.has(key));
  if (unexpected) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${unexpected} is not accepted in this query`);
  }
}

export function trainingPaginationOf(c: Context, extra: readonly string[] = []): PageInput {
  assertQueryKeys(c, ['page', 'pageSize', ...extra]);
  return paginationOf(c);
}

export async function jsonBody(c: Context, maxBytes?: number): Promise<{ value: JsonObject; raw: string }> {
  const raw = await c.req.text();
  if (maxBytes !== undefined && Buffer.byteLength(raw, 'utf8') > maxBytes) {
    throw new TeachingApiException('INVALID_INPUT', 400, `Request body must not exceed ${maxBytes} bytes`);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TeachingApiException('INVALID_INPUT', 400, 'Request body must be valid JSON');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'Request body must be a JSON object');
  }
  return { value: value as JsonObject, raw };
}
