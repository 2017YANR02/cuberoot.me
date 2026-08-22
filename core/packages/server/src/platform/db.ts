import type { Context } from 'hono';
import { sql } from '../db/connection.js';
import type { PlatformActor } from './auth.js';
import { PlatformApiError, forbidden, notFound } from './errors.js';
import { idempotencyKey, requestHash } from './validation.js';

export interface PlatformDb {
  unsafe(query: string, parameters?: readonly unknown[]): Promise<Record<string, unknown>[]>;
}

export interface PlatformMutationResult {
  status: 200 | 201 | 202;
  body: Record<string, unknown> | unknown[];
  resourceType?: string;
  resourceId?: string;
}

export interface PlatformIdempotentResult extends PlatformMutationResult {
  replayed: boolean;
}

export function platformDb(): PlatformDb {
  return sql as unknown as PlatformDb;
}

export async function platformQuery<T extends Record<string, unknown>>(
  db: PlatformDb,
  statement: string,
  parameters: readonly unknown[] = [],
): Promise<T[]> {
  return await db.unsafe(statement, parameters) as T[];
}

export async function platformTransaction<T>(run: (db: PlatformDb) => Promise<T>): Promise<T> {
  return await sql.begin(async (transaction) => run(transaction as unknown as PlatformDb)) as T;
}

export async function withIdempotency(
  c: Context,
  actor: PlatformActor,
  scope: string,
  body: unknown,
  mutation: (db: PlatformDb) => Promise<PlatformMutationResult>,
): Promise<PlatformIdempotentResult> {
  const key = idempotencyKey(c);
  const hash = requestHash(scope, actor.userId, body);
  return platformTransaction(async (db) => {
    const inserted = await platformQuery<{ id: string }>(db, `
      INSERT INTO platform_idempotency_requests (
        actor_key, actor_user_id, scope, idempotency_key, request_hash,
        state, lease_expires_at, expires_at
      ) VALUES ($1, $2, $3, $4, decode($5, 'hex'), 'processing', NOW() + INTERVAL '5 minutes', NOW() + INTERVAL '24 hours')
      ON CONFLICT (actor_key, scope, idempotency_key) DO NOTHING
      RETURNING id::text AS id
    `, [actor.ownerKey, actor.userId, scope, key, hash]);

    const rows = await platformQuery<{
      id: string;
      request_hash_hex: string;
      state: string;
      response_status: number | null;
      response_body: Record<string, unknown> | unknown[] | null;
      resource_type: string | null;
      resource_id: string | null;
      lease_expired: boolean;
    }>(db, `
      SELECT id::text AS id, encode(request_hash, 'hex') AS request_hash_hex, state,
             response_status, response_body, resource_type, resource_id,
             lease_expires_at <= NOW() AS lease_expired
      FROM platform_idempotency_requests
      WHERE actor_key = $1 AND scope = $2 AND idempotency_key = $3
      FOR UPDATE
    `, [actor.ownerKey, scope, key]);
    const request = rows[0];
    if (!request) throw new Error('Platform idempotency row was not created');
    if (request.request_hash_hex !== hash) {
      throw new PlatformApiError(
        'IDEMPOTENCY_CONFLICT',
        409,
        'Idempotency-Key was already used with a different request',
      );
    }
    if (request.state === 'completed' && request.response_status && request.response_body != null) {
      if (![200, 201, 202].includes(request.response_status)) {
        throw new Error('Unsupported stored Platform idempotency response status');
      }
      return {
        status: request.response_status as 200 | 201 | 202,
        body: request.response_body,
        resourceType: request.resource_type ?? undefined,
        resourceId: request.resource_id ?? undefined,
        replayed: true,
      };
    }
    if (inserted.length === 0 && request.state === 'processing' && !request.lease_expired) {
      throw new PlatformApiError('CONFLICT', 409, 'An identical request is already processing');
    }
    if (inserted.length === 0) {
      await platformQuery(db, `
        UPDATE platform_idempotency_requests
        SET state = 'processing', response_status = NULL, response_body = NULL,
            resource_type = NULL, resource_id = NULL,
            lease_expires_at = NOW() + INTERVAL '5 minutes', expires_at = NOW() + INTERVAL '24 hours'
        WHERE id = $1::uuid
      `, [request.id]);
    }

    const result = await mutation(db);
    if ((result.resourceType == null) !== (result.resourceId == null)) {
      throw new Error('Platform mutation resource type and id must be stored together');
    }
    await platformQuery(db, `
      UPDATE platform_idempotency_requests
      SET state = 'completed', response_status = $2, response_body = $3::jsonb,
          resource_type = $4, resource_id = $5,
          lease_expires_at = NOW(), expires_at = NOW() + INTERVAL '24 hours'
      WHERE id = $1::uuid
    `, [
      request.id,
      result.status,
      JSON.stringify(result.body),
      result.resourceType ?? null,
      result.resourceId ?? null,
    ]);
    return { ...result, replayed: false };
  });
}

export function sendMutation(c: Context, result: PlatformIdempotentResult): Response {
  c.header('Cache-Control', 'private, no-store');
  c.header('Idempotency-Replayed', result.replayed ? 'true' : 'false');
  switch (result.status) {
    case 200: return c.json(result.body, 200);
    case 201: return c.json(result.body, 201);
    case 202: return c.json(result.body, 202);
  }
}

export async function enqueuePlatformEvent(
  db: PlatformDb,
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  dedupeKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await platformQuery(db, `
    INSERT INTO platform_outbox_events (
      event_type, aggregate_type, aggregate_id, dedupe_key, payload
    ) VALUES ($1, $2, $3, $4, $5::jsonb)
    ON CONFLICT (dedupe_key) DO NOTHING
  `, [eventType, aggregateType, aggregateId, dedupeKey, JSON.stringify(payload)]);
}

export async function requireInstructor(db: PlatformDb, actor: PlatformActor): Promise<string> {
  if (actor.userId == null) forbidden('A user-backed instructor account is required');
  const rows = await platformQuery<{ id: string }>(db, `
    SELECT id::text AS id
    FROM platform_instructors
    WHERE user_id = $1 AND status = 'active'
  `, [actor.userId]);
  if (!rows[0]) forbidden('Active instructor access required');
  return rows[0].id;
}

export async function requireCourseOwner(
  db: PlatformDb,
  actor: PlatformActor,
  courseId: string,
): Promise<string> {
  const instructorId = await requireInstructor(db, actor);
  const rows = await platformQuery<{ role: string }>(db, `
    SELECT role
    FROM platform_course_owners
    WHERE course_id = $1::uuid AND instructor_id = $2::uuid AND status = 'active'
      AND role IN ('owner', 'co_instructor', 'editor')
  `, [courseId, instructorId]);
  if (!rows[0]) notFound('Course');
  return instructorId;
}

export async function requireCourseEntitlement(
  db: PlatformDb,
  actor: PlatformActor,
  courseId: string,
): Promise<void> {
  if (actor.isAdmin) return;
  if (actor.userId == null) forbidden('A user-backed account is required');
  const rows = await platformQuery<{ allowed: boolean }>(db, `
    SELECT EXISTS (
      SELECT 1 FROM platform_course_entitlements
      WHERE user_id = $1 AND course_id = $2::uuid AND status = 'active'
        AND valid_from <= NOW() AND (valid_until IS NULL OR valid_until > NOW())
    ) OR EXISTS (
      SELECT 1
      FROM platform_course_owners co
      JOIN platform_instructors i ON i.id = co.instructor_id
      WHERE i.user_id = $1 AND i.status = 'active' AND co.course_id = $2::uuid AND co.status = 'active'
    ) AS allowed
  `, [actor.userId, courseId]);
  if (!rows[0]?.allowed) forbidden('An active course entitlement is required');
}

export function isPostgresConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && 'code' in error && ['23505', '23514', '23503'].includes(String((error as { code: unknown }).code));
}
