import { createHash, randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import type postgres from 'postgres';
import {
  hasTeachingPermission,
  isTeachingOrganizationRole,
  TEACHING_ATTENDANCE_STATUSES,
  TEACHING_CREDIT_UNITS,
  TEACHING_PACKAGE_ACQUISITION_TYPES,
  type TeachingErrorCode,
  type TeachingAttendanceStatus,
  type TeachingCreditUnit,
  type TeachingPackageAcquisitionType,
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

interface CreatePackageProductInput {
  code: string;
  name: string;
  creditUnit: TeachingCreditUnit;
  creditType: string;
  totalCredits: number;
  validityDays: number | null;
  priceAmountMinor: number;
  currency: string;
}

interface CreateStudentPackageInput {
  productId: string;
  acquisitionType: TeachingPackageAcquisitionType;
  validFrom: string;
  sourceSystem: string | null;
  sourceRef: string | null;
  sourceLineRef: string | null;
}

interface CreateSessionInput {
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string | null;
  teacherUserIds: number[];
  attendees: Array<{
    studentId: string;
    studentPackageId: string;
    creditCost: number;
  }>;
}

interface AttendanceBatchInput {
  records: Array<{
    attendanceId: string;
    status: Exclude<TeachingAttendanceStatus, 'expected'>;
  }>;
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
  listPackageProducts(actor: TeachingActor, slug: string, pagination: PageInput, requestId: string): Promise<PageResult>;
  createPackageProduct(
    actor: TeachingActor,
    slug: string,
    input: CreatePackageProductInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  listStudentPackages(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    pagination: PageInput,
    requestId: string,
  ): Promise<PageResult>;
  createStudentPackage(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    input: CreateStudentPackageInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  listStudentPackageLedger(
    actor: TeachingActor,
    slug: string,
    studentPackageId: string,
    pagination: PageInput,
    requestId: string,
  ): Promise<PageResult>;
  listSessions(actor: TeachingActor, slug: string, pagination: PageInput, requestId: string): Promise<PageResult>;
  getSession(actor: TeachingActor, slug: string, sessionId: string, requestId: string): Promise<JsonObject>;
  createSession(
    actor: TeachingActor,
    slug: string,
    input: CreateSessionInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  saveAttendanceBatch(
    actor: TeachingActor,
    slug: string,
    sessionId: string,
    input: AttendanceBatchInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  completeSession(
    actor: TeachingActor,
    slug: string,
    sessionId: string,
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

class ConcealedTeachingPermissionDeniedException extends TeachingApiException {
  readonly auditReason = 'PERMISSION_DENIED';

  constructor(message: string) {
    super('RESOURCE_NOT_FOUND', 404, message);
    this.name = 'ConcealedTeachingPermissionDeniedException';
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

function optionalString(body: JsonObject, key: string, maxLength: number): string | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a string or null`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be 1 to ${maxLength} characters or null`);
  }
  return trimmed;
}

function requiredInteger(body: JsonObject, key: string, min: number, max: number): number {
  const value = body[key];
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be an integer from ${min} to ${max}`);
  }
  return value as number;
}

function requiredUuid(body: JsonObject, key: string): string {
  const value = requiredString(body, key, 36).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a UUID`);
  }
  return value;
}

function uuidParam(value: string, key: string): string {
  return requiredUuid({ [key]: value }, key);
}

function requiredTimestamp(body: JsonObject, key: string): string {
  const value = requiredString(body, key, 40);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:(Z)|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be an ISO 8601 timestamp with an offset`);
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zulu, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = zulu ? 0 : Number(offsetHourText);
  const offsetMinute = zulu ? 0 : Number(offsetMinuteText);
  const daysInMonth = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;
  if (
    year < 1 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59 ||
    offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)
  ) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a valid timestamp`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a valid timestamp`);
  }
  return date.toISOString();
}

function validTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
  } catch {
    throw new TeachingApiException('INVALID_INPUT', 400, 'timezone must be a valid IANA time zone');
  }
  return value;
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

function parsePackageProductInput(body: JsonObject): CreatePackageProductInput {
  const code = requiredString(body, 'code', 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(code)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'code must use lowercase letters, numbers, underscores, or hyphens');
  }
  if (!TEACHING_CREDIT_UNITS.includes(body.creditUnit as TeachingCreditUnit)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'creditUnit must be lesson or minute');
  }
  const creditType = requiredString(body, 'creditType', 64).toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(creditType)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'creditType must be a normalized identifier');
  }
  const validityDays = body.validityDays == null
    ? null
    : requiredInteger(body, 'validityDays', 1, 36_500);
  const currency = requiredString(body, 'currency', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'currency must be a three-letter ISO currency code');
  }
  return {
    code,
    name: requiredString(body, 'name', 160),
    creditUnit: body.creditUnit as TeachingCreditUnit,
    creditType,
    totalCredits: requiredInteger(body, 'totalCredits', 1, 1_000_000),
    validityDays,
    priceAmountMinor: requiredInteger(body, 'priceAmountMinor', 0, Number.MAX_SAFE_INTEGER),
    currency,
  };
}

function parseStudentPackageInput(body: JsonObject): CreateStudentPackageInput {
  if (!TEACHING_PACKAGE_ACQUISITION_TYPES.includes(body.acquisitionType as TeachingPackageAcquisitionType)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'acquisitionType must be purchase, grant, or migration');
  }
  const sourceSystem = optionalString(body, 'sourceSystem', 64);
  const sourceRef = optionalString(body, 'sourceRef', 160);
  const sourceLineRef = optionalString(body, 'sourceLineRef', 160);
  if ((sourceSystem === null) !== (sourceRef === null) || (sourceLineRef !== null && sourceSystem === null)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'sourceSystem and sourceRef must be provided together');
  }
  return {
    productId: requiredUuid(body, 'productId'),
    acquisitionType: body.acquisitionType as TeachingPackageAcquisitionType,
    validFrom: body.validFrom === undefined ? new Date().toISOString() : requiredTimestamp(body, 'validFrom'),
    sourceSystem,
    sourceRef,
    sourceLineRef,
  };
}

function parseSessionInput(body: JsonObject): CreateSessionInput {
  const startsAt = requiredTimestamp(body, 'startsAt');
  const endsAt = requiredTimestamp(body, 'endsAt');
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'endsAt must be after startsAt');
  }
  const rawTeacherIds = body.teacherUserIds ?? [];
  if (!Array.isArray(rawTeacherIds) || rawTeacherIds.length > 20) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'teacherUserIds must contain at most 20 user IDs');
  }
  const teacherUserIds = rawTeacherIds.map((value) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
      throw new TeachingApiException('INVALID_INPUT', 400, 'teacherUserIds must contain positive integers');
    }
    return value;
  });
  if (new Set(teacherUserIds).size !== teacherUserIds.length) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'teacherUserIds must not contain duplicates');
  }
  const rawAttendees = body.attendees ?? [];
  if (!Array.isArray(rawAttendees) || rawAttendees.length > 500) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'attendees must contain at most 500 records');
  }
  const attendees = rawAttendees.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new TeachingApiException('INVALID_INPUT', 400, `attendees[${index}] must be an object`);
    }
    const item = raw as JsonObject;
    return {
      studentId: requiredUuid(item, 'studentId'),
      studentPackageId: requiredUuid(item, 'studentPackageId'),
      creditCost: requiredInteger(item, 'creditCost', 1, 1_000_000),
    };
  });
  if (new Set(attendees.map((item) => item.studentId)).size !== attendees.length) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'attendees must not repeat a student');
  }
  return {
    title: requiredString(body, 'title', 160),
    startsAt,
    endsAt,
    timezone: body.timezone === undefined ? null : validTimezone(requiredString(body, 'timezone', 64)),
    teacherUserIds,
    attendees,
  };
}

function parseAttendanceBatchInput(body: JsonObject): AttendanceBatchInput {
  if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > 500) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'records must contain 1 to 500 attendance updates');
  }
  const records = body.records.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new TeachingApiException('INVALID_INPUT', 400, `records[${index}] must be an object`);
    }
    const item = raw as JsonObject;
    if (!TEACHING_ATTENDANCE_STATUSES.includes(item.status as TeachingAttendanceStatus) || item.status === 'expected') {
      throw new TeachingApiException('INVALID_INPUT', 400, `records[${index}].status must resolve attendance`);
    }
    return {
      attendanceId: requiredUuid(item, 'attendanceId'),
      status: item.status as Exclude<TeachingAttendanceStatus, 'expected'>,
    };
  });
  if (new Set(records.map((item) => item.attendanceId)).size !== records.length) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'records must not repeat an attendanceId');
  }
  return { records };
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

type SessionAccessScope = 'organization' | 'assigned';

function requireSessionScope(
  access: OrganizationAccess,
  permission: 'session:read' | 'session:manage',
): SessionAccessScope {
  requirePermission(access, permission);
  if (access.role === 'owner' || access.role === 'admin') return 'organization';
  if (access.role === 'teacher' || access.role === 'assistant') return 'assigned';
  throw new TeachingApiException('PERMISSION_DENIED', 403, 'Organization role does not allow this action');
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
  return error instanceof ConcealedTeachingPermissionDeniedException || (
    error instanceof TeachingApiException &&
    (error.code === 'ORGANIZATION_NOT_FOUND' || error.code === 'PERMISSION_DENIED')
  );
}

function accessDenialReason(error: TeachingApiException): string {
  return error instanceof ConcealedTeachingPermissionDeniedException
    ? error.auditReason
    : error.code;
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
      JSON.stringify({ reason: accessDenialReason(error) }),
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
 * Call this before opening the business transaction. Every mutation attempt,
 * including an idempotent replay, is charged in its own committed statement so
 * a rollback cannot erase the counter and no transaction nests a pool checkout.
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
    await consumeMutationAttempt(actor.userId, 'organization.create', 10, '1 hour');
    try {
      return await sql.begin(async (tx) => {
        const idem = await beginIdempotency(tx, actor.userId, null, 'organization.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
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
      await consumeMutationAttempt(actor.userId, 'member.create', 60, '1 minute');
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
      await consumeMutationAttempt(actor.userId, 'student.create', 120, '1 minute');
      try {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        requirePermission(access, 'student:manage');
        const idem = await beginIdempotency(tx, actor.userId, access.id, 'student.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
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

  async listPackageProducts(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'package_product.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'package:read');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM lesson_package_products WHERE organization_id = ?',
          [access.id],
        ),
        query<Record<string, unknown>>(
          `SELECT id, code, name, status, credit_unit, credit_type, total_credits,
                  validity_days, price_amount_minor, currency, created_at, updated_at
           FROM lesson_package_products
           WHERE organization_id = ?
           ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, name, id
           LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map((row) => ({
          id: String(row.id), code: String(row.code), name: String(row.name), status: String(row.status),
          creditUnit: String(row.credit_unit), creditType: String(row.credit_type),
          totalCredits: Number(row.total_credits),
          validityDays: row.validity_days == null ? null : Number(row.validity_days),
          priceAmountMinor: Number(row.price_amount_minor), currency: String(row.currency),
          createdAt: new Date(String(row.created_at)).toISOString(),
          updatedAt: new Date(String(row.updated_at)).toISOString(),
        })),
        total: Number(countRows[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createPackageProduct(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'package_product.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'package_product.create', 60, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'package:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'package_product.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            INSERT INTO lesson_package_products (
              organization_id, code, name, credit_unit, credit_type, total_credits,
              validity_days, price_amount_minor, currency, created_by_user_id
            ) VALUES (
              ${access.id}, ${input.code}, ${input.name}, ${input.creditUnit}, ${input.creditType},
              ${input.totalCredits}, ${input.validityDays}, ${input.priceAmountMinor}, ${input.currency}, ${actor.userId}
            )
            RETURNING id, code, name, status, credit_unit, credit_type, total_credits,
                      validity_days, price_amount_minor, currency, created_at, updated_at`;
          const row = rows[0] as Record<string, unknown>;
          const productId = String(row.id);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'package_product.create', 'lesson_package_product', ${productId}, ${requestId},
              ${sql.json({ code: input.code, totalCredits: input.totalCredits })}
            )`;
          const result: MutationResult = {
            status: 201,
            body: { packageProduct: {
              id: productId, code: String(row.code), name: String(row.name), status: String(row.status),
              creditUnit: String(row.credit_unit), creditType: String(row.credit_type),
              totalCredits: Number(row.total_credits),
              validityDays: row.validity_days == null ? null : Number(row.validity_days),
              priceAmountMinor: Number(row.price_amount_minor), currency: String(row.currency),
              createdAt: new Date(String(row.created_at)).toISOString(),
              updatedAt: new Date(String(row.updated_at)).toISOString(),
            } },
          };
          await completeIdempotency(tx, idem.id, result, 'lesson_package_product', productId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return uniqueConflict(error, 'Package product code already exists in this organization');
      }
    });
  },

  async listStudentPackages(actor, slug, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student_package.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'package:read');
      const students = await query<Record<string, unknown>>(
        'SELECT id FROM student_profiles WHERE organization_id = ? AND id = ?',
        [access.id, studentId],
      );
      if (!students.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM student_packages WHERE organization_id = ? AND student_id = ?',
          [access.id, studentId],
        ),
        query<Record<string, unknown>>(
          `SELECT p.*,
                  COALESCE((SELECT SUM(l.delta) FROM lesson_credit_ledger l
                            WHERE l.organization_id = p.organization_id AND l.student_package_id = p.id), 0)::int
                    AS remaining_credits
           FROM student_packages p
           WHERE p.organization_id = ? AND p.student_id = ?
           ORDER BY p.created_at DESC, p.id
           LIMIT ? OFFSET ?`,
          [access.id, studentId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map((row) => ({
          id: String(row.id), studentId: String(row.student_id), productId: String(row.product_id),
          productCode: String(row.product_code_snapshot), productName: String(row.product_name_snapshot),
          creditUnit: String(row.credit_unit), creditType: String(row.credit_type),
          entitledCredits: Number(row.entitled_credits), remainingCredits: Number(row.remaining_credits),
          validityDays: row.validity_days_snapshot == null ? null : Number(row.validity_days_snapshot),
          priceAmountMinor: Number(row.price_amount_minor), currency: String(row.currency),
          status: String(row.lifecycle_status), acquisitionType: String(row.acquisition_type),
          validFrom: new Date(String(row.valid_from)).toISOString(),
          validUntil: row.valid_until == null ? null : new Date(String(row.valid_until)).toISOString(),
          sourceSystem: row.source_system == null ? null : String(row.source_system),
          sourceRef: row.source_ref == null ? null : String(row.source_ref),
          sourceLineRef: row.source_line_ref == null ? null : String(row.source_line_ref),
          createdAt: new Date(String(row.created_at)).toISOString(),
        })),
        total: Number(countRows[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createStudentPackage(actor, slug, studentId, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student_package.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'student_package.create', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'package:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'student_package.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const students = await tx`
            SELECT id FROM student_profiles WHERE organization_id = ${access.id} AND id = ${studentId}`;
          if (!students.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
          const products = await tx`
            SELECT id, code, name, credit_unit, credit_type, total_credits, validity_days,
                   price_amount_minor, currency
            FROM lesson_package_products
            WHERE organization_id = ${access.id} AND id = ${input.productId} AND status = 'active'`;
          if (!products.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Active package product not found');
          const product = products[0] as Record<string, unknown>;
          const packages = await tx`
            INSERT INTO student_packages (
              organization_id, student_id, product_id, product_code_snapshot, product_name_snapshot,
              credit_unit, credit_type, entitled_credits, validity_days_snapshot, price_amount_minor,
              currency, acquisition_type, valid_from, valid_until, source_system, source_ref,
              source_line_ref, created_by_user_id
            ) VALUES (
              ${access.id}, ${studentId}, ${input.productId}, ${String(product.code)}, ${String(product.name)},
              ${String(product.credit_unit)}, ${String(product.credit_type)}, ${Number(product.total_credits)},
              ${product.validity_days == null ? null : Number(product.validity_days)}, ${Number(product.price_amount_minor)},
              ${String(product.currency)}, ${input.acquisitionType}, ${input.validFrom},
              CASE WHEN ${product.validity_days == null ? null : Number(product.validity_days)}::int IS NULL THEN NULL
                   ELSE ${input.validFrom}::timestamptz + (${product.validity_days == null ? null : Number(product.validity_days)}::int * INTERVAL '1 day') END,
              ${input.sourceSystem}, ${input.sourceRef}, ${input.sourceLineRef}, ${actor.userId}
            )
            RETURNING *`;
          const studentPackage = packages[0] as Record<string, unknown>;
          const studentPackageId = String(studentPackage.id);
          await tx`
            SELECT id FROM student_packages
            WHERE organization_id = ${access.id} AND id = ${studentPackageId}
            FOR UPDATE`;
          const entryType = input.acquisitionType === 'migration' ? 'adjustment' : input.acquisitionType;
          await tx`
            INSERT INTO lesson_credit_ledger (
              organization_id, student_package_id, student_id, entry_type, delta, idempotency_key,
              source_system, source_ref, source_line_ref, reason, actor_user_id, actor_role,
              actor_display_name, metadata
            ) VALUES (
              ${access.id}, ${studentPackageId}, ${studentId}, ${entryType}, ${Number(product.total_credits)},
              ${idempotencyKey}, ${input.sourceSystem}, ${input.sourceRef},
              ${input.sourceLineRef}, 'Initial entitlement', ${actor.userId}, ${access.role},
              ${actor.displayName}, ${sql.json({ productId: input.productId })}
            )`;
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student_package.create', 'student_package', ${studentPackageId}, ${requestId},
              ${sql.json({ studentId, productId: input.productId, acquisitionType: input.acquisitionType })}
            )`;
          const result: MutationResult = {
            status: 201,
            body: { studentPackage: {
              id: studentPackageId, studentId, productId: input.productId,
              productCode: String(studentPackage.product_code_snapshot),
              productName: String(studentPackage.product_name_snapshot),
              creditUnit: String(studentPackage.credit_unit), creditType: String(studentPackage.credit_type),
              entitledCredits: Number(studentPackage.entitled_credits),
              remainingCredits: Number(studentPackage.entitled_credits),
              validityDays: studentPackage.validity_days_snapshot == null ? null : Number(studentPackage.validity_days_snapshot),
              priceAmountMinor: Number(studentPackage.price_amount_minor), currency: String(studentPackage.currency),
              status: String(studentPackage.lifecycle_status), acquisitionType: String(studentPackage.acquisition_type),
              validFrom: new Date(String(studentPackage.valid_from)).toISOString(),
              validUntil: studentPackage.valid_until == null ? null : new Date(String(studentPackage.valid_until)).toISOString(),
              sourceSystem: input.sourceSystem, sourceRef: input.sourceRef, sourceLineRef: input.sourceLineRef,
              createdAt: new Date(String(studentPackage.created_at)).toISOString(),
            } },
          };
          await completeIdempotency(tx, idem.id, result, 'student_package', studentPackageId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return uniqueConflict(error, 'Student package source reference already exists');
      }
    });
  },

  async listStudentPackageLedger(actor, slug, studentPackageId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student_package.ledger', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'package:read');
      const packages = await query<Record<string, unknown>>(
        'SELECT id FROM student_packages WHERE organization_id = ? AND id = ?',
        [access.id, studentPackageId],
      );
      if (!packages.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student package not found');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM lesson_credit_ledger WHERE organization_id = ? AND student_package_id = ?',
          [access.id, studentPackageId],
        ),
        query<Record<string, unknown>>(
          `SELECT id, student_id, entry_type, delta, attendance_id, session_id,
                  source_system, source_ref, source_line_ref, reversal_of_ledger_id,
                  reason, actor_role, actor_display_name, metadata, created_at
           FROM lesson_credit_ledger
           WHERE organization_id = ? AND student_package_id = ?
           ORDER BY created_at, id LIMIT ? OFFSET ?`,
          [access.id, studentPackageId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map((row) => ({
          id: Number(row.id), studentId: String(row.student_id), entryType: String(row.entry_type),
          delta: Number(row.delta), attendanceId: row.attendance_id == null ? null : String(row.attendance_id),
          sessionId: row.session_id == null ? null : String(row.session_id),
          sourceSystem: row.source_system == null ? null : String(row.source_system),
          sourceRef: row.source_ref == null ? null : String(row.source_ref),
          sourceLineRef: row.source_line_ref == null ? null : String(row.source_line_ref),
          reversalOfLedgerId: row.reversal_of_ledger_id == null ? null : Number(row.reversal_of_ledger_id),
          reason: String(row.reason), actorRole: String(row.actor_role),
          actorDisplayName: String(row.actor_display_name), metadata: row.metadata as JsonValue,
          createdAt: new Date(String(row.created_at)).toISOString(),
        })),
        total: Number(countRows[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async listSessions(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'session:read');
      const countQuery = scope === 'organization'
        ? query<Record<string, unknown>>(
            'SELECT COUNT(*)::int AS count FROM teaching_sessions WHERE organization_id = ?',
            [access.id],
          )
        : query<Record<string, unknown>>(
            `SELECT COUNT(*)::int AS count
             FROM teaching_sessions s
             WHERE s.organization_id = ?
               AND EXISTS (
                 SELECT 1 FROM session_teachers assigned
                 WHERE assigned.organization_id = s.organization_id
                   AND assigned.session_id = s.id
                   AND assigned.teacher_user_id = ?
               )`,
            [access.id, actor.userId],
          );
      const sessionsQuery = scope === 'organization'
        ? query<Record<string, unknown>>(
            `SELECT s.*,
             COALESCE((
               SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                 'userId', st.teacher_user_id_snapshot,
                 'displayName', st.teacher_display_name_snapshot,
                 'role', st.role
               ) ORDER BY CASE st.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
                          st.teacher_display_name_snapshot, st.id)
               FROM session_teachers st
               WHERE st.organization_id = s.organization_id AND st.session_id = s.id
             ), '[]'::jsonb) AS teachers,
             (SELECT COUNT(*)::int FROM attendance_records a
              WHERE a.organization_id = s.organization_id AND a.session_id = s.id) AS attendance_count
           FROM teaching_sessions s
           WHERE s.organization_id = ?
           ORDER BY s.starts_at DESC, s.id
           LIMIT ? OFFSET ?`,
            [access.id, pagination.pageSize, pagination.offset],
          )
        : query<Record<string, unknown>>(
            `SELECT s.*,
             COALESCE((
               SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                 'userId', st.teacher_user_id_snapshot,
                 'displayName', st.teacher_display_name_snapshot,
                 'role', st.role
               ) ORDER BY CASE st.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
                          st.teacher_display_name_snapshot, st.id)
               FROM session_teachers st
               WHERE st.organization_id = s.organization_id AND st.session_id = s.id
             ), '[]'::jsonb) AS teachers,
             (SELECT COUNT(*)::int FROM attendance_records a
              WHERE a.organization_id = s.organization_id AND a.session_id = s.id) AS attendance_count
           FROM teaching_sessions s
           WHERE s.organization_id = ?
             AND EXISTS (
               SELECT 1 FROM session_teachers assigned
               WHERE assigned.organization_id = s.organization_id
                 AND assigned.session_id = s.id
                 AND assigned.teacher_user_id = ?
             )
           ORDER BY s.starts_at DESC, s.id
           LIMIT ? OFFSET ?`,
            [access.id, actor.userId, pagination.pageSize, pagination.offset],
          );
      const [countRows, rows] = await Promise.all([countQuery, sessionsQuery]);
      return {
        items: rows.map((row) => ({
          id: String(row.id), title: String(row.title),
          startsAt: new Date(String(row.starts_at)).toISOString(),
          endsAt: new Date(String(row.ends_at)).toISOString(),
          timezone: String(row.timezone), status: String(row.status), version: Number(row.version),
          startedAt: row.started_at == null ? null : new Date(String(row.started_at)).toISOString(),
          completedAt: row.completed_at == null ? null : new Date(String(row.completed_at)).toISOString(),
          cancelledAt: row.cancelled_at == null ? null : new Date(String(row.cancelled_at)).toISOString(),
          teachers: row.teachers as JsonValue, attendanceCount: Number(row.attendance_count),
          createdAt: new Date(String(row.created_at)).toISOString(),
          updatedAt: new Date(String(row.updated_at)).toISOString(),
        })),
        total: Number(countRows[0]?.count ?? 0), page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getSession(actor, slug, sessionId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      const scope = requireSessionScope(access, 'session:read');
      const rows = scope === 'organization'
        ? await query<Record<string, unknown>>(
            `SELECT s.*,
           COALESCE((
             SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
               'userId', st.teacher_user_id_snapshot,
               'displayName', st.teacher_display_name_snapshot,
               'role', st.role
             ) ORDER BY CASE st.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
                        st.teacher_display_name_snapshot, st.id)
             FROM session_teachers st
             WHERE st.organization_id = s.organization_id AND st.session_id = s.id
           ), '[]'::jsonb) AS teachers
         FROM teaching_sessions s
         WHERE s.organization_id = ? AND s.id = ?`,
            [access.id, sessionId],
          )
        : await query<Record<string, unknown>>(
            `SELECT s.*,
           COALESCE((
             SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
               'userId', st.teacher_user_id_snapshot,
               'displayName', st.teacher_display_name_snapshot,
               'role', st.role
             ) ORDER BY CASE st.role WHEN 'lead' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END,
                        st.teacher_display_name_snapshot, st.id)
             FROM session_teachers st
             WHERE st.organization_id = s.organization_id AND st.session_id = s.id
           ), '[]'::jsonb) AS teachers
         FROM teaching_sessions s
         WHERE s.organization_id = ? AND s.id = ?
           AND EXISTS (
             SELECT 1 FROM session_teachers assigned
             WHERE assigned.organization_id = s.organization_id
               AND assigned.session_id = s.id
               AND assigned.teacher_user_id = ?
           )`,
            [access.id, sessionId, actor.userId],
          );
      if (!rows.length) {
        if (scope === 'assigned') {
          const existing = await query<Record<string, unknown>>(
            'SELECT 1 FROM teaching_sessions WHERE organization_id = ? AND id = ?',
            [access.id, sessionId],
          );
          if (existing.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
        }
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
      }
      const row = rows[0];
      const attendance = await query<Record<string, unknown>>(
        `SELECT a.id, a.student_id, p.display_name, a.student_package_id,
                a.status, a.credit_cost, a.notes, a.updated_at
         FROM attendance_records a
         JOIN student_profiles p
           ON p.organization_id = a.organization_id AND p.id = a.student_id
         WHERE a.organization_id = ? AND a.session_id = ?
         ORDER BY p.display_name, a.student_id`,
        [access.id, sessionId],
      );
      return {
        id: String(row.id), title: String(row.title),
        startsAt: new Date(String(row.starts_at)).toISOString(),
        endsAt: new Date(String(row.ends_at)).toISOString(),
        timezone: String(row.timezone), status: String(row.status), version: Number(row.version),
        startedAt: row.started_at == null ? null : new Date(String(row.started_at)).toISOString(),
        completedAt: row.completed_at == null ? null : new Date(String(row.completed_at)).toISOString(),
        cancelledAt: row.cancelled_at == null ? null : new Date(String(row.cancelled_at)).toISOString(),
        teachers: row.teachers as JsonValue,
        attendance: attendance.map((item) => ({
          id: String(item.id), studentId: String(item.student_id), displayName: String(item.display_name),
          studentPackageId: item.student_package_id == null ? null : String(item.student_package_id),
          status: String(item.status), creditCost: Number(item.credit_cost), notes: String(item.notes),
          updatedAt: new Date(String(item.updated_at)).toISOString(),
        })),
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
      };
    });
  },

  async createSession(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'session.create', 120, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        requirePermission(access, 'session:create');
        const idem = await beginIdempotency(tx, actor.userId, access.id, 'session.create', idempotencyKey, requestHash);
        if ('replay' in idem) return idem.replay;
        const rows = await tx`
          INSERT INTO teaching_sessions (
            organization_id, title, starts_at, ends_at, timezone, created_by_user_id
          ) VALUES (
            ${access.id}, ${input.title}, ${input.startsAt}, ${input.endsAt},
            ${input.timezone ?? access.timezone}, ${actor.userId}
          )
          RETURNING id, title, starts_at, ends_at, timezone, status, version, created_at, updated_at`;
        const session = rows[0] as Record<string, unknown>;
        const sessionId = String(session.id);
        const teachers: JsonObject[] = [];
        for (let index = 0; index < input.teacherUserIds.length; index += 1) {
          const teacherUserId = input.teacherUserIds[index];
          const members = await tx`
            SELECT m.user_id, m.role, u.display_name
            FROM organization_members m
            JOIN app_users u ON u.id = m.user_id
            WHERE m.organization_id = ${access.id} AND m.user_id = ${teacherUserId}
              AND m.status = 'active' AND m.role IN ('owner', 'admin', 'teacher', 'assistant')`;
          if (!members.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Assigned teacher is not an active teaching member');
          }
          const member = members[0] as Record<string, unknown>;
          const role = index === 0 ? 'lead' : 'assistant';
          await tx`
            INSERT INTO session_teachers (
              organization_id, session_id, teacher_user_id, teacher_user_id_snapshot,
              teacher_display_name_snapshot, role
            ) VALUES (
              ${access.id}, ${sessionId}, ${teacherUserId}, ${teacherUserId},
              ${String(member.display_name)}, ${role}
            )`;
          teachers.push({ userId: teacherUserId, displayName: String(member.display_name), role });
        }
        const attendance: JsonObject[] = [];
        for (const attendee of input.attendees) {
          const packages = await tx`
            SELECT p.id, s.display_name
            FROM student_packages p
            JOIN student_profiles s
              ON s.organization_id = p.organization_id AND s.id = p.student_id
            WHERE p.organization_id = ${access.id} AND p.id = ${attendee.studentPackageId}
              AND p.student_id = ${attendee.studentId} AND p.lifecycle_status = 'active'
              AND p.valid_from <= ${input.startsAt}::timestamptz
              AND (p.valid_until IS NULL OR p.valid_until > ${input.startsAt}::timestamptz)`;
          if (!packages.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Active student package not found for an attendee');
          }
          const rows = await tx`
            INSERT INTO attendance_records (
              organization_id, session_id, student_id, student_package_id,
              status, credit_cost, notes, recorded_by_user_id
            ) VALUES (
              ${access.id}, ${sessionId}, ${attendee.studentId}, ${attendee.studentPackageId},
              'expected', ${attendee.creditCost}, '', ${actor.userId}
            )
            RETURNING id, student_id, student_package_id, status, credit_cost, notes, updated_at`;
          const row = rows[0] as Record<string, unknown>;
          attendance.push({
            id: String(row.id), studentId: String(row.student_id),
            displayName: String(packages[0].display_name), studentPackageId: String(row.student_package_id),
            status: String(row.status), creditCost: Number(row.credit_cost), notes: String(row.notes),
            updatedAt: new Date(String(row.updated_at)).toISOString(),
          });
        }
        await tx`
          INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'scheduled', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId},
            ${sql.json({ teacherUserIds: input.teacherUserIds, attendeeCount: attendance.length })}
          )`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'session.create', 'teaching_session', ${sessionId}, ${requestId},
            ${sql.json({ startsAt: input.startsAt, teacherCount: teachers.length, attendeeCount: attendance.length })}
          )`;
        const result: MutationResult = {
          status: 201,
          body: { session: {
            id: sessionId, title: String(session.title),
            startsAt: new Date(String(session.starts_at)).toISOString(),
            endsAt: new Date(String(session.ends_at)).toISOString(),
            timezone: String(session.timezone), status: String(session.status), version: Number(session.version),
            teachers, attendance, attendanceCount: attendance.length,
            startedAt: null, completedAt: null, cancelledAt: null,
            createdAt: new Date(String(session.created_at)).toISOString(),
            updatedAt: new Date(String(session.updated_at)).toISOString(),
          } },
        };
        await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
        return result;
      }) as MutationResult;
    });
  },

  async saveAttendanceBatch(actor, slug, sessionId, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.attendance.batch', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'session.attendance.batch', 240, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        const scope = requireSessionScope(access, 'session:manage');
        const sessions = scope === 'organization'
          ? await tx`
              SELECT s.id, s.status FROM teaching_sessions s
              WHERE s.organization_id = ${access.id} AND s.id = ${sessionId}
              FOR UPDATE OF s`
          : await tx`
              SELECT s.id, s.status FROM teaching_sessions s
              WHERE s.organization_id = ${access.id} AND s.id = ${sessionId}
                AND EXISTS (
                  SELECT 1 FROM session_teachers assigned
                  WHERE assigned.organization_id = s.organization_id
                    AND assigned.session_id = s.id
                    AND assigned.teacher_user_id = ${actor.userId}
                )
              FOR UPDATE OF s`;
        if (!sessions.length) {
          if (scope === 'assigned') {
            const existing = await tx`
              SELECT 1 FROM teaching_sessions
              WHERE organization_id = ${access.id} AND id = ${sessionId}`;
            if (existing.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
          }
          throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
        }
        const idem = await beginIdempotency(
          tx, actor.userId, access.id, `session.attendance.batch:${sessionId}`, idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        if (!['scheduled', 'in_progress'].includes(String(sessions[0].status))) {
          throw new TeachingApiException('CONFLICT', 409, 'Attendance cannot change after the session is closed');
        }
        const saved: JsonObject[] = [];
        for (const item of input.records) {
          const rows = await tx`
            UPDATE attendance_records
            SET status = ${item.status}, recorded_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND id = ${item.attendanceId}
            RETURNING id, student_id, student_package_id, status, credit_cost, notes, updated_at`;
          if (!rows.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Attendance record not found');
          const row = rows[0] as Record<string, unknown>;
          saved.push({
            id: String(row.id), studentId: String(row.student_id),
            studentPackageId: row.student_package_id == null ? null : String(row.student_package_id),
            status: String(row.status), creditCost: Number(row.credit_cost), notes: String(row.notes),
            updatedAt: new Date(String(row.updated_at)).toISOString(),
          });
        }
        await tx`
          INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'attendance_updated', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId}, ${sql.json({ count: saved.length })}
          )`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'session.attendance.batch', 'teaching_session', ${sessionId}, ${requestId},
            ${sql.json({ count: saved.length })}
          )`;
        const result: MutationResult = { status: 200, body: { attendance: saved } };
        await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
        return result;
      }) as MutationResult;
    });
  },

  async completeSession(actor, slug, sessionId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'session.complete', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'session.complete', 120, '1 minute');
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requireWritable(access);
        const scope = requireSessionScope(access, 'session:manage');
        const sessions = scope === 'organization'
          ? await tx`
              SELECT s.id, s.status, s.starts_at, s.completed_at
              FROM teaching_sessions s
              WHERE s.organization_id = ${access.id} AND s.id = ${sessionId}
              FOR UPDATE OF s`
          : await tx`
              SELECT s.id, s.status, s.starts_at, s.completed_at
              FROM teaching_sessions s
              WHERE s.organization_id = ${access.id} AND s.id = ${sessionId}
                AND EXISTS (
                  SELECT 1 FROM session_teachers assigned
                  WHERE assigned.organization_id = s.organization_id
                    AND assigned.session_id = s.id
                    AND assigned.teacher_user_id = ${actor.userId}
                )
              FOR UPDATE OF s`;
        if (!sessions.length) {
          if (scope === 'assigned') {
            const existing = await tx`
              SELECT 1 FROM teaching_sessions
              WHERE organization_id = ${access.id} AND id = ${sessionId}`;
            if (existing.length) throw new ConcealedTeachingPermissionDeniedException('Session not found');
          }
          throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found');
        }
        const idem = await beginIdempotency(
          tx, actor.userId, access.id, `session.complete:${sessionId}`, idempotencyKey, requestHash,
        );
        if ('replay' in idem) return idem.replay;
        const session = sessions[0] as Record<string, unknown>;
        if (session.status === 'cancelled') {
          throw new TeachingApiException('CONFLICT', 409, 'A cancelled session cannot be completed');
        }
        if (session.status === 'completed') {
          const totals = await tx`
            SELECT COUNT(*)::int AS attendance_count, COALESCE(-SUM(delta), 0)::int AS total_credits
            FROM lesson_credit_ledger
            WHERE organization_id = ${access.id} AND session_id = ${sessionId} AND entry_type = 'consume'`;
          const result: MutationResult = {
            status: 200,
            body: { session: { id: sessionId, status: 'completed', completedAt: new Date(String(session.completed_at)).toISOString() },
              consumption: { attendanceCount: Number(totals[0].attendance_count), totalCredits: Number(totals[0].total_credits) } },
          };
          await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
          return result;
        }
        const attendanceRows = await tx`
          SELECT id, student_id, student_package_id, status, credit_cost
          FROM attendance_records
          WHERE organization_id = ${access.id} AND session_id = ${sessionId}
          ORDER BY student_package_id NULLS LAST, id
          FOR UPDATE`;
        if (!attendanceRows.length) {
          throw new TeachingApiException('CONFLICT', 409, 'Session needs attendance before completion');
        }
        if (attendanceRows.some((row) => row.status === 'expected')) {
          throw new TeachingApiException('CONFLICT', 409, 'Resolve all expected attendance before completion');
        }
        const billable = attendanceRows.filter((row) => row.status === 'present' || row.status === 'late');
        let totalCredits = 0;
        for (const attendance of billable) {
          const packageId = String(attendance.student_package_id);
          const packages = await tx`
            SELECT id, lifecycle_status, valid_from, valid_until
            FROM student_packages
            WHERE organization_id = ${access.id} AND id = ${packageId}
              AND student_id = ${String(attendance.student_id)}
            FOR UPDATE`;
          if (!packages.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student package not found');
          const studentPackage = packages[0] as Record<string, unknown>;
          const sessionStartsAt = new Date(String(session.starts_at)).getTime();
          if (
            studentPackage.lifecycle_status !== 'active' ||
            new Date(String(studentPackage.valid_from)).getTime() > sessionStartsAt ||
            (studentPackage.valid_until != null && new Date(String(studentPackage.valid_until)).getTime() <= sessionStartsAt)
          ) {
            throw new TeachingApiException('CONFLICT', 409, 'Student package is not active for the session time');
          }
          const balances = await tx`
            SELECT COALESCE(SUM(delta), 0)::int AS balance
            FROM lesson_credit_ledger
            WHERE organization_id = ${access.id} AND student_package_id = ${packageId}`;
          const creditCost = Number(attendance.credit_cost);
          if (Number(balances[0].balance) < creditCost) {
            throw new TeachingApiException('CONFLICT', 409, 'Student package has insufficient credits');
          }
          await tx`
            INSERT INTO lesson_credit_ledger (
              organization_id, student_package_id, student_id, entry_type, delta,
              attendance_id, session_id, idempotency_key, reason, actor_user_id,
              actor_role, actor_display_name, metadata
            ) VALUES (
              ${access.id}, ${packageId}, ${String(attendance.student_id)}, 'consume', ${-creditCost},
              ${String(attendance.id)}, ${sessionId}, ${`attendance:${String(attendance.id)}`},
              'Session attendance', ${actor.userId}, ${access.role}, ${actor.displayName},
              ${sql.json({ attendanceStatus: String(attendance.status) })}
            )`;
          totalCredits += creditCost;
        }
        const completed = await tx`
          UPDATE teaching_sessions
          SET status = 'completed', completed_at = NOW(), version = version + 1
          WHERE organization_id = ${access.id} AND id = ${sessionId}
          RETURNING completed_at`;
        await tx`
          INSERT INTO session_events (
            organization_id, session_id, event_type, actor_user_id, actor_role,
            actor_display_name, request_id, metadata
          ) VALUES (
            ${access.id}, ${sessionId}, 'completed', ${actor.userId}, ${access.role},
            ${actor.displayName}, ${requestId},
            ${sql.json({ attendanceCount: billable.length, totalCredits })}
          )`;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
            'session.complete', 'teaching_session', ${sessionId}, ${requestId},
            ${sql.json({ attendanceCount: billable.length, totalCredits })}
          )`;
        const result: MutationResult = {
          status: 200,
          body: { session: { id: sessionId, status: 'completed', completedAt: new Date(String(completed[0].completed_at)).toISOString() },
            consumption: { attendanceCount: billable.length, totalCredits } },
        };
        await completeIdempotency(tx, idem.id, result, 'teaching_session', sessionId);
        return result;
      }) as MutationResult;
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

  routes.get('/teaching/organizations/:orgSlug/package-products', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listPackageProducts(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
      return c.json({ packageProducts: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/package-products', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createPackageProduct(
        actor, c.req.param('orgSlug'), parsePackageProductInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/students/:studentId/packages', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listStudentPackages(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('studentId'), 'studentId'), paginationOf(c), requestId,
      );
      return c.json({ studentPackages: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/students/:studentId/packages', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createStudentPackage(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('studentId'), 'studentId'),
        parseStudentPackageInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/student-packages/:studentPackageId/ledger', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listStudentPackageLedger(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('studentPackageId'), 'studentPackageId'),
        paginationOf(c), requestId,
      );
      return c.json({ ledger: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/sessions', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listSessions(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
      return c.json({ sessions: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/sessions', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createSession(
        actor, c.req.param('orgSlug'), parseSessionInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/sessions/:sessionId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const session = await repository.getSession(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('sessionId'), 'sessionId'), requestId,
      );
      return c.json({ session });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/sessions/:sessionId/attendance/batch', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.saveAttendanceBatch(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('sessionId'), 'sessionId'),
        parseAttendanceBatchInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/sessions/:sessionId/complete', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      if (Object.keys(body.value).length) {
        throw new TeachingApiException('INVALID_INPUT', 400, 'Session completion body must be empty');
      }
      const result = await repository.completeSession(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('sessionId'), 'sessionId'),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  return routes;
}

export const teachingSaasRoutes = createTeachingSaasRoutes();
