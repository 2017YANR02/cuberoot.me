import { createHash, randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import type postgres from 'postgres';
import {
  hasTeachingPermission,
  isTeachingOrganizationRole,
  type TeachingErrorCode,
  type TeachingOrganizationRole,
  type TeachingPermission,
} from '@cuberoot/shared/teaching';
import { query, sql } from '../db/connection.js';
import {
  authenticateTeachingActor,
  InvalidTeachingPlatformAssertionError,
  type TeachingActor,
} from '../utils/teaching_platform_assertion.js';

type JsonValue = postgres.JSONValue;
type JsonObject = { [key: string]: JsonValue };
type MutationStatus = 200 | 201;
type Tx = postgres.TransactionSql;

interface OrganizationAccess {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  status: 'active' | 'suspended' | 'archived';
  version: number;
  role: TeachingOrganizationRole;
}

interface MutationResult {
  status: MutationStatus;
  body: JsonObject;
}

interface CreateOrganizationInput {
  slug: string;
  name: string;
  timezone: string;
}

interface CreateMemberInput {
  userId: number;
  role: Exclude<TeachingOrganizationRole, 'owner'>;
}

interface CreateStudentInput {
  displayName: string;
  externalRef: string | null;
}

interface PageInput {
  page: number;
  pageSize: number;
  offset: number;
}

interface PageResult {
  items: JsonObject[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TeachingSaasRepository {
  listOrganizations(actor: TeachingActor): Promise<JsonObject[]>;
  getOrganization(actor: TeachingActor, slug: string, requestId: string): Promise<JsonObject>;
  getOrganizationSummary(actor: TeachingActor, slug: string, requestId: string): Promise<JsonObject>;
  createOrganization(
    actor: TeachingActor,
    input: CreateOrganizationInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  listMembers(actor: TeachingActor, slug: string, pagination: PageInput, requestId: string): Promise<PageResult>;
  createMember(
    actor: TeachingActor,
    slug: string,
    input: CreateMemberInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  listStudents(actor: TeachingActor, slug: string, pagination: PageInput, requestId: string): Promise<PageResult>;
  createStudent(
    actor: TeachingActor,
    slug: string,
    input: CreateStudentInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
}

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

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requestIdOf(c: Context): string {
  const supplied = c.req.header('X-Request-ID')?.trim();
  return supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
}

function idempotencyKeyOf(c: Context): string {
  const key = c.req.header('Idempotency-Key')?.trim() ?? '';
  if (!key) {
    throw new TeachingApiException('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
  }
  if (key.length > 200 || !/^[\x21-\x7e]+$/.test(key)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'Idempotency-Key must be 1 to 200 visible ASCII characters');
  }
  return key;
}

function paginationOf(c: Context): PageInput {
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

async function jsonBody(c: Context): Promise<{ value: JsonObject; raw: string }> {
  const raw = await c.req.text();
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

function requiredString(body: JsonObject, key: string, maxLength: number): string {
  const value = body[key];
  if (typeof value !== 'string') {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be 1 to ${maxLength} characters`);
  }
  return trimmed;
}

function parseOrganizationInput(body: JsonObject): CreateOrganizationInput {
  const slug = requiredString(body, 'slug', 64).toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'slug must contain lowercase letters, numbers, or interior hyphens');
  }
  const name = requiredString(body, 'name', 160);
  const timezone = body.timezone === undefined ? 'Asia/Shanghai' : requiredString(body, 'timezone', 64);
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  } catch {
    throw new TeachingApiException('INVALID_INPUT', 400, 'timezone must be a valid IANA time zone');
  }
  return { slug, name, timezone };
}

function parseMemberInput(body: JsonObject): CreateMemberInput {
  if (!Number.isSafeInteger(body.userId) || (body.userId as number) <= 0) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'userId must be a positive integer');
  }
  if (!isTeachingOrganizationRole(body.role) || body.role === 'owner') {
    throw new TeachingApiException('INVALID_INPUT', 400, 'role must be admin, teacher, assistant, finance, or viewer');
  }
  return { userId: body.userId as number, role: body.role };
}

function parseStudentInput(body: JsonObject): CreateStudentInput {
  const displayName = requiredString(body, 'displayName', 160);
  const ref = body.externalRef;
  if (ref !== undefined && ref !== null && typeof ref !== 'string') {
    throw new TeachingApiException('INVALID_INPUT', 400, 'externalRef must be a string or null');
  }
  const externalRef = typeof ref === 'string' ? ref.trim() : null;
  if (externalRef !== null && (!externalRef || externalRef.length > 100)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'externalRef must be 1 to 100 characters or null');
  }
  return { displayName, externalRef };
}

function asAccess(row: Record<string, unknown>): OrganizationAccess {
  if (!isTeachingOrganizationRole(row.role)) {
    throw new Error('Invalid organization role in database');
  }
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    timezone: String(row.timezone),
    status: row.status as OrganizationAccess['status'],
    version: Number(row.version),
    role: row.role,
  };
}

function requirePermission(access: OrganizationAccess, permission: TeachingPermission): void {
  if (!hasTeachingPermission(access.role, permission)) {
    throw new TeachingApiException('PERMISSION_DENIED', 403, 'Organization role does not allow this action');
  }
}

function requireWritable(access: OrganizationAccess): void {
  if (access.status !== 'active') {
    throw new TeachingApiException('ORGANIZATION_SUSPENDED', 409, 'Organization is not active');
  }
}

async function accessForRead(actorUserId: number, slug: string): Promise<OrganizationAccess> {
  const rows = await query<Record<string, unknown>>(
    `SELECT o.id, o.slug, o.name, o.timezone, o.status, o.version, m.role
     FROM organizations o
     JOIN organization_members m ON m.organization_id = o.id
     WHERE o.slug = ? AND m.user_id = ? AND m.status = 'active'`,
    [slug, actorUserId],
  );
  if (!rows.length) {
    throw new TeachingApiException('ORGANIZATION_NOT_FOUND', 404, 'Organization not found');
  }
  return asAccess(rows[0]);
}

async function accessForWrite(tx: Tx, actorUserId: number, slug: string): Promise<OrganizationAccess> {
  const rows = await tx`
    SELECT o.id, o.slug, o.name, o.timezone, o.status, o.version, m.role
    FROM organizations o
    JOIN organization_members m ON m.organization_id = o.id
    WHERE o.slug = ${slug} AND m.user_id = ${actorUserId} AND m.status = 'active'
    FOR UPDATE OF o, m`;
  if (!rows.length) {
    throw new TeachingApiException('ORGANIZATION_NOT_FOUND', 404, 'Organization not found');
  }
  return asAccess(rows[0] as Record<string, unknown>);
}

function isAccessDenial(error: unknown): error is TeachingApiException {
  return error instanceof TeachingApiException &&
    (error.code === 'ORGANIZATION_NOT_FOUND' || error.code === 'PERMISSION_DENIED');
}

async function recordDeniedOrganizationAccess(
  actor: TeachingActor,
  slug: string,
  action: string,
  requestId: string,
  error: TeachingApiException,
): Promise<void> {
  await query(
    `INSERT INTO teaching_audit_events (
       organization_id, actor_user_id, actor_role, actor_display_name,
       action, entity_type, entity_id, outcome, request_id, metadata
     )
     SELECT o.id, ?, m.role, ?, ?, 'organization', o.id::text, 'denied', ?, ?::jsonb
     FROM organizations o
     LEFT JOIN organization_members m
       ON m.organization_id = o.id AND m.user_id = ?
     WHERE o.slug = ?`,
    [
      actor.userId,
      actor.displayName,
      action,
      requestId,
      JSON.stringify({ reason: error.code }),
      actor.userId,
      slug,
    ],
  );
}

async function withDeniedAccessAudit<T>(
  actor: TeachingActor,
  slug: string,
  action: string,
  requestId: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isAccessDenial(error)) {
      await recordDeniedOrganizationAccess(actor, slug, action, requestId, error);
    }
    throw error;
  }
}

async function beginIdempotency(
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

async function completeIdempotency(
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
 * This intentionally uses the pool-level query helper while the business
 * transaction is open. Its committed counter must survive a later rollback.
 * Completed idempotent replays return before this function and are not charged.
 */
async function consumeMutationAttempt(
  actorUserId: number,
  operation: string,
  maxRequests: number,
  window: '1 minute' | '1 hour',
): Promise<void> {
  const rows = window === '1 minute'
    ? await query<Record<string, unknown>>(
        `INSERT INTO teaching_mutation_rate_limits (
           actor_user_id, operation, window_started_at, attempts, updated_at
         ) VALUES (?, ?, NOW(), 1, NOW())
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
        `INSERT INTO teaching_mutation_rate_limits (
           actor_user_id, operation, window_started_at, attempts, updated_at
         ) VALUES (?, ?, NOW(), 1, NOW())
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
  if (Number(rows[0]?.attempts ?? 0) > maxRequests) {
    throw new TeachingApiException('RATE_LIMITED', 429, 'Too many teaching mutations; retry later');
  }
}

function uniqueConflict(error: unknown, message: string): never {
  const code = (error as { code?: string }).code;
  if (code === '23505') throw new TeachingApiException('CONFLICT', 409, message);
  throw error;
}

export const teachingSaasRepository: TeachingSaasRepository = {
  async listOrganizations(actor) {
    const rows = await query<Record<string, unknown>>(
      `SELECT o.id, o.slug, o.name, o.timezone, o.status, o.version, m.role
       FROM organization_members m
       JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY o.name, o.slug`,
      [actor.userId],
    );
    return rows.map((row) => ({ ...asAccess(row) }));
  },

  async getOrganization(actor, slug, requestId) {
    return withDeniedAccessAudit(actor, slug, 'organization.read', requestId, async () => ({
      ...await accessForRead(actor.userId, slug),
    }));
  },

  async getOrganizationSummary(actor, slug, requestId) {
    return withDeniedAccessAudit(actor, slug, 'organization.summary', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const [memberRows, studentRows] = await Promise.all([
        hasTeachingPermission(access.role, 'member:read')
          ? query<Record<string, unknown>>(
              'SELECT COUNT(*)::int AS count FROM organization_members WHERE organization_id = ?',
              [access.id],
            )
          : Promise.resolve([]),
        hasTeachingPermission(access.role, 'student:read')
          ? query<Record<string, unknown>>(
              'SELECT COUNT(*)::int AS count FROM student_profiles WHERE organization_id = ?',
              [access.id],
            )
          : Promise.resolve([]),
      ]);
      return {
        organization: { ...access },
        memberCount: hasTeachingPermission(access.role, 'member:read')
          ? Number(memberRows[0]?.count ?? 0)
          : null,
        studentCount: hasTeachingPermission(access.role, 'student:read')
          ? Number(studentRows[0]?.count ?? 0)
          : null,
      };
    });
  },

  async createOrganization(actor, input, idempotencyKey, requestHash, requestId) {
    try {
      return await sql.begin(async (tx) => {
        const idem = await beginIdempotency(tx, actor.userId, null, 'organization.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
        await consumeMutationAttempt(actor.userId, 'organization.create', 10, '1 hour');
        const rows = await tx`
          INSERT INTO organizations (slug, name, timezone, created_by_user_id)
          VALUES (${input.slug}, ${input.name}, ${input.timezone}, ${actor.userId})
          RETURNING id, slug, name, timezone, status, version`;
        const org = rows[0] as Record<string, unknown>;
        const organizationId = String(org.id);
        await tx`
          INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
          VALUES (${organizationId}, ${actor.userId}, 'owner', 'active', NOW())`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${organizationId}, ${actor.userId}, 'owner', ${actor.displayName},
            'organization.create', 'organization', ${organizationId}, ${requestId}, ${sql.json({ slug: input.slug })}
          )`;
        const result: MutationResult = {
          status: 201,
          body: {
            organization: {
              id: organizationId,
              slug: String(org.slug),
              name: String(org.name),
              timezone: String(org.timezone),
              status: String(org.status),
              version: Number(org.version),
              role: 'owner',
            },
          },
        };
        await completeIdempotency(tx, idem.id, result, 'organization', organizationId);
        return result;
      }) as MutationResult;
    } catch (error) {
      if (error instanceof TeachingApiException) throw error;
      return uniqueConflict(error, 'Organization slug already exists');
    }
  },

  async listMembers(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'member.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'member:read');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM organization_members WHERE organization_id = ?',
          [access.id],
        ),
        query<Record<string, unknown>>(
      `SELECT m.user_id, u.display_name, u.avatar_url, m.role, m.status, m.joined_at, m.created_at
       FROM organization_members m
       JOIN app_users u ON u.id = m.user_id
       WHERE m.organization_id = ?
       ORDER BY CASE m.role
         WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'teacher' THEN 2
         WHEN 'assistant' THEN 3 WHEN 'finance' THEN 4 ELSE 5 END,
         u.display_name, m.user_id
       LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map((row) => ({
          userId: Number(row.user_id),
          displayName: String(row.display_name ?? ''),
          avatarUrl: row.avatar_url == null ? null : String(row.avatar_url),
          role: String(row.role),
          status: String(row.status),
          joinedAt: row.joined_at instanceof Date ? row.joined_at.toISOString() : String(row.joined_at),
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        })),
        total: Number(countRows[0]?.count ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async createMember(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'member.create', requestId, async () => {
      try {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        requirePermission(access, 'member:manage');
        if (input.role === 'admin' && access.role !== 'owner') {
          throw new TeachingApiException('PERMISSION_DENIED', 403, 'Only an owner can grant the admin role');
        }
        const idem = await beginIdempotency(tx, actor.userId, access.id, 'member.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
        await consumeMutationAttempt(actor.userId, 'member.create', 60, '1 minute');
        const users = await tx`SELECT id, display_name FROM app_users WHERE id = ${input.userId}`;
        if (!users.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'User not found');
        await tx`
          INSERT INTO organization_members (
            organization_id, user_id, role, status, invited_by_user_id, joined_at
          ) VALUES (${access.id}, ${input.userId}, ${input.role}, 'active', ${actor.userId}, NOW())`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'member.create', 'organization_member', ${String(input.userId)}, ${requestId}, ${sql.json({ role: input.role })}
          )`;
        const result: MutationResult = {
          status: 201,
          body: {
            member: {
              userId: input.userId,
              displayName: String(users[0].display_name ?? ''),
              role: input.role,
              status: 'active',
            },
          },
        };
        await completeIdempotency(tx, idem.id, result, 'organization_member', String(input.userId));
        return result;
      }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return uniqueConflict(error, 'User is already a member of this organization');
      }
    });
  },

  async listStudents(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'student:read');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM student_profiles WHERE organization_id = ?',
          [access.id],
        ),
        query<Record<string, unknown>>(
      `SELECT id, account_user_id, external_ref, display_name, status, created_at, updated_at
       FROM student_profiles
       WHERE organization_id = ?
       ORDER BY display_name, id
       LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map((row) => ({
          id: String(row.id),
          accountUserId: row.account_user_id == null ? null : Number(row.account_user_id),
          externalRef: row.external_ref == null ? null : String(row.external_ref),
          displayName: String(row.display_name),
          status: String(row.status),
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
          updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
        })),
        total: Number(countRows[0]?.count ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async createStudent(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.create', requestId, async () => {
      try {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        requirePermission(access, 'student:manage');
        const idem = await beginIdempotency(tx, actor.userId, access.id, 'student.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
        await consumeMutationAttempt(actor.userId, 'student.create', 120, '1 minute');
        const rows = await tx`
          INSERT INTO student_profiles (
            organization_id, external_ref, display_name, created_by_user_id
          ) VALUES (${access.id}, ${input.externalRef}, ${input.displayName}, ${actor.userId})
          RETURNING id, external_ref, display_name, status, created_at, updated_at`;
        const student = rows[0] as Record<string, unknown>;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'student.create', 'student', ${String(student.id)}, ${requestId}, ${sql.json({ externalRef: input.externalRef })}
          )`;
        const result: MutationResult = {
          status: 201,
          body: {
            student: {
              id: String(student.id),
              accountUserId: null,
              externalRef: student.external_ref == null ? null : String(student.external_ref),
              displayName: String(student.display_name),
              status: String(student.status),
              createdAt: student.created_at instanceof Date ? student.created_at.toISOString() : String(student.created_at),
              updatedAt: student.updated_at instanceof Date ? student.updated_at.toISOString() : String(student.updated_at),
            },
          },
        };
        await completeIdempotency(tx, idem.id, result, 'student', String(student.id));
        return result;
      }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return uniqueConflict(error, 'Student external reference already exists in this organization');
      }
    });
  },
};

function errorResponse(c: Context, error: unknown, requestId: string): Response {
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

export function createTeachingSaasRoutes(deps: {
  authenticate?: (c: Context) => Promise<TeachingActor>;
  repository?: TeachingSaasRepository;
} = {}): Hono {
  const routes = new Hono();
  const authenticate = deps.authenticate ?? authenticateTeachingActor;
  const repository = deps.repository ?? teachingSaasRepository;

  routes.get('/teaching/organizations', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      return c.json({ organizations: await repository.listOrganizations(actor) });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createOrganization(actor, parseOrganizationInput(body.value), key, sha256(body.raw), requestId);
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      return c.json({ organization: await repository.getOrganization(actor, c.req.param('orgSlug'), requestId) });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/summary', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      return c.json({ summary: await repository.getOrganizationSummary(actor, c.req.param('orgSlug'), requestId) });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/members', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listMembers(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
      return c.json({ members: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/members', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createMember(actor, c.req.param('orgSlug'), parseMemberInput(body.value), key, sha256(body.raw), requestId);
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/students', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listStudents(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
      return c.json({ students: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/students', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createStudent(actor, c.req.param('orgSlug'), parseStudentInput(body.value), key, sha256(body.raw), requestId);
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  return routes;
}

export const teachingSaasRoutes = createTeachingSaasRoutes();
