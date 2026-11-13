import { sql, query } from '../db/connection.js';
import { type Tx, type MutationResult, type MutationStatus, type JsonObject } from './types.js';
import { TeachingApiException, ConcealedTeachingPermissionDeniedException } from './errors.js';

export async function withRepeatableReadRetry<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await sql.begin('isolation level repeatable read', operation) as T;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if ((code !== '40001' && code !== '40P01') || attempt === 4) {
        if (code === '40001' || code === '40P01') {
          throw new TeachingApiException('CONFLICT', 409, 'Concurrent training update; retry the complete request');
        }
        throw error;
      }
    }
  }
  throw new TeachingApiException('CONFLICT', 409, 'Concurrent training update; retry the complete request');
}

export async function withWeeklyReportGenerateRetry<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
  const retryableUniqueConstraints = new Set([
    'teaching_weekly_reports_revision_unique',
    'uq_teaching_weekly_reports_one_draft',
  ]);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await sql.begin('isolation level repeatable read', operation) as T;
    } catch (error) {
      const databaseError = error as { code?: string; constraint?: string; constraint_name?: string };
      const code = databaseError.code;
      const constraint = databaseError.constraint ?? databaseError.constraint_name;
      const generateRace = code === '23505'
        && constraint != null
        && retryableUniqueConstraints.has(constraint);
      if ((code !== '40001' && code !== '40P01' && !generateRace) || attempt === 4) {
        if (code === '40001' || code === '40P01' || generateRace) {
          throw new TeachingApiException('CONFLICT', 409, 'Concurrent weekly report update; retry the complete request');
        }
        throw error;
      }
    }
  }
  throw new TeachingApiException('CONFLICT', 409, 'Concurrent weekly report update; retry the complete request');
}

export async function beginIdempotency(
  tx: Tx,
  actorUserId: number,
  organizationId: string | null,
  operation: string,
  key: string,
  requestHash: string,
): Promise<{ id: number } | { replay: MutationResult }> {
  const scopeKey = organizationId ? `org:${organizationId}` : 'global';
  const idempotencyLockKey = `teaching-mutation:${actorUserId}:${operation}`;
  await tx`
    SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyLockKey}, 0))`;
  await tx`
    DELETE FROM teaching_idempotency_requests
    WHERE actor_user_id = ${actorUserId}
      AND scope_key = ${scopeKey}
      AND operation = ${operation}
      AND idempotency_key = ${key}
      AND expires_at <= NOW()`;
  await tx`
    DELETE FROM teaching_idempotency_requests
    WHERE id IN (
      SELECT id
      FROM teaching_idempotency_requests
      WHERE expires_at <= NOW()
      ORDER BY expires_at
      LIMIT 500
      FOR UPDATE SKIP LOCKED
    )`;
  const inserted = await tx`
    INSERT INTO teaching_idempotency_requests (
      organization_id, actor_user_id, scope_key, operation, idempotency_key,
      request_hash, expires_at
    ) VALUES (
      ${organizationId}, ${actorUserId}, ${scopeKey}, ${operation}, ${key},
      ${requestHash}, NOW() + INTERVAL '24 hours'
    )
    ON CONFLICT (actor_user_id, scope_key, operation, idempotency_key) DO NOTHING
    RETURNING id`;
  if (inserted.length) return { id: Number(inserted[0].id) };

  const existing = await tx`
    SELECT id, request_hash, state, response_status, response_body
    FROM teaching_idempotency_requests
    WHERE actor_user_id = ${actorUserId}
      AND scope_key = ${scopeKey}
      AND operation = ${operation}
      AND idempotency_key = ${key}
    FOR UPDATE`;
  const row = existing[0] as Record<string, unknown> | undefined;
  if (!row || row.request_hash !== requestHash || row.state !== 'completed') {
    throw new TeachingApiException('IDEMPOTENCY_CONFLICT', 409, 'Idempotency key was already used with a different request');
  }
  return {
    replay: {
      status: Number(row.response_status) as MutationStatus,
      body: row.response_body as JsonObject,
    },
  };
}

export async function completeIdempotency(
  tx: Tx,
  id: number,
  result: MutationResult,
  resourceType: string,
  resourceId: string,
): Promise<void> {
  await tx`
    UPDATE teaching_idempotency_requests
    SET state = 'completed', response_status = ${result.status}, response_body = ${sql.json(result.body)},
        resource_type = ${resourceType}, resource_id = ${resourceId}, completed_at = NOW()
    WHERE id = ${id}`;
}

/**
 * Call this before opening the business transaction. Every mutation attempt,
 * including an idempotent replay, is charged in its own committed statement so
 * a rollback cannot erase the counter and no transaction nests a pool checkout.
 * Lock the account before the counter, matching account deletion's lock order.
 */
export async function consumeMutationAttempt(
  actorUserId: number,
  operation: string,
  maxRequests: number,
  window: '1 minute' | '1 hour',
): Promise<void> {
  const rows = window === '1 minute'
    ? await query<Record<string, unknown>>(
        `WITH actor AS MATERIALIZED (
           SELECT id FROM app_users WHERE id = ? FOR KEY SHARE
         )
         INSERT INTO teaching_mutation_rate_limits (
           actor_user_id, operation, window_started_at, attempts, updated_at
         ) SELECT id, ?, NOW(), 1, NOW() FROM actor WHERE TRUE
         ON CONFLICT (actor_user_id, operation) DO UPDATE SET
           attempts = CASE
             WHEN teaching_mutation_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN 1
             ELSE teaching_mutation_rate_limits.attempts + 1
           END,
           window_started_at = CASE
             WHEN teaching_mutation_rate_limits.window_started_at <= NOW() - INTERVAL '1 minute' THEN NOW()
             ELSE teaching_mutation_rate_limits.window_started_at
           END,
           updated_at = NOW()
         RETURNING attempts`,
        [actorUserId, operation],
      )
    : await query<Record<string, unknown>>(
        `WITH actor AS MATERIALIZED (
           SELECT id FROM app_users WHERE id = ? FOR KEY SHARE
         )
         INSERT INTO teaching_mutation_rate_limits (
           actor_user_id, operation, window_started_at, attempts, updated_at
         ) SELECT id, ?, NOW(), 1, NOW() FROM actor WHERE TRUE
         ON CONFLICT (actor_user_id, operation) DO UPDATE SET
           attempts = CASE
             WHEN teaching_mutation_rate_limits.window_started_at <= NOW() - INTERVAL '1 hour' THEN 1
             ELSE teaching_mutation_rate_limits.attempts + 1
           END,
           window_started_at = CASE
             WHEN teaching_mutation_rate_limits.window_started_at <= NOW() - INTERVAL '1 hour' THEN NOW()
             ELSE teaching_mutation_rate_limits.window_started_at
           END,
           updated_at = NOW()
         RETURNING attempts`,
        [actorUserId, operation],
      );
  if (!rows.length) {
    throw new ConcealedTeachingPermissionDeniedException('Teaching account not found');
  }
  if (Number(rows[0].attempts) > maxRequests) {
    throw new TeachingApiException('RATE_LIMITED', 429, 'Too many teaching mutations; retry later');
  }
}
