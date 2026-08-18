import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import type postgres from 'postgres';
import {
  hasTeachingPermission,
  isTrainingEvidenceSource,
  isTrainingGoalRegistered,
  isTrainingGoalMetricKey,
  isTrainingGoalOperator,
  isTrainingSourceActivity,
  isTeachingOrganizationRole,
  parseTrainingEvidenceV1,
  parseTrainingToolConfigForActivity,
  TRAINING_ASSIGNMENT_STATUSES,
  TRAINING_REVIEW_STATUSES,
  TRAINING_SCHEDULE_KINDS,
  TRAINING_EVIDENCE_FUTURE_TOLERANCE_MS,
  TRAINING_EVIDENCE_MAX_BODY_BYTES,
  TEACHING_ATTENDANCE_STATUSES,
  TEACHING_CREDIT_UNITS,
  TEACHING_PACKAGE_ACQUISITION_TYPES,
  type TeachingErrorCode,
  type TeachingAttendanceStatus,
  type TeachingCreditUnit,
  type TeachingPackageAcquisitionType,
  type TeachingOrganizationRole,
  type TeachingPermission,
  type TeachingTrainingAssignmentWriteInput,
  type TeachingTrainingReviewCreateInput,
  type TeachingTrainingTemplateCreateInput,
  type TeachingTrainingTemplateVersionCreateInput,
  type TrainingAssignmentStatus,
  type TrainingEvidenceActivity,
  type TrainingEvidenceSource,
  type TrainingGoalMetricKey,
  type TrainingGoalOperator,
  type TrainingReviewStatus,
  type TrainingScheduleKind,
  type TrainingEvidenceV1,
  TrainingEvidenceValidationError,
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

const TRAINING_REVIEW_CREATE_OPERATION = 'training.review.create';

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

interface CreateCampusInput {
  code: string | null;
  name: string;
  timezone: string | null;
}

interface CreateGroupInput {
  campusId: string | null;
  code: string | null;
  name: string;
}

interface CreateStudentGroupMembershipInput {
  studentId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface CreateTeacherAssignmentInput {
  teacherUserId: number;
  groupId: string | null;
  studentId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

interface TeacherAssignmentTarget {
  groupId: string | null;
  studentId: string | null;
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

interface CreateStudentAccountBindingInviteInput {
  expiresInMinutes: number;
}

interface ConsumeStudentAccountBindingInput {
  tokenHash: string;
}

type CreateTrainingTemplateInput = TeachingTrainingTemplateCreateInput;
type CreateTrainingTemplateVersionInput = TeachingTrainingTemplateVersionCreateInput;
type WriteTrainingAssignmentInput = TeachingTrainingAssignmentWriteInput;
type CreateTrainingReviewInput = TeachingTrainingReviewCreateInput;

interface TrainingTargetFilter {
  targetKind: 'group' | 'student' | null;
}

interface TrainingAssignmentFilter {
  status: TrainingAssignmentStatus | null;
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
  getStudent(actor: TeachingActor, slug: string, studentId: string, requestId: string): Promise<JsonObject>;
  createStudent(
    actor: TeachingActor,
    slug: string,
    input: CreateStudentInput,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  listCampuses(actor: TeachingActor, slug: string, pagination: PageInput, requestId: string): Promise<PageResult>;
  getCampus(actor: TeachingActor, slug: string, campusId: string, requestId: string): Promise<JsonObject>;
  createCampus(
    actor: TeachingActor, slug: string, input: CreateCampusInput, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  archiveCampus(
    actor: TeachingActor, slug: string, campusId: string, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listGroups(actor: TeachingActor, slug: string, pagination: PageInput, requestId: string): Promise<PageResult>;
  getGroup(actor: TeachingActor, slug: string, groupId: string, requestId: string): Promise<JsonObject>;
  createGroup(
    actor: TeachingActor, slug: string, input: CreateGroupInput, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  archiveGroup(
    actor: TeachingActor, slug: string, groupId: string, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listGroupStudents(
    actor: TeachingActor, slug: string, groupId: string, pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  createStudentGroupMembership(
    actor: TeachingActor, slug: string, groupId: string, input: CreateStudentGroupMembershipInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  revokeStudentGroupMembership(
    actor: TeachingActor, slug: string, membershipId: string, idempotencyKey: string,
    requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listTeacherAssignments(
    actor: TeachingActor, slug: string, target: TeacherAssignmentTarget,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  createTeacherAssignment(
    actor: TeachingActor, slug: string, input: CreateTeacherAssignmentInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  revokeTeacherAssignment(
    actor: TeachingActor, slug: string, assignmentId: string, idempotencyKey: string,
    requestHash: string, requestId: string,
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
  createStudentAccountBindingInvite(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    input: CreateStudentAccountBindingInviteInput,
    requestId: string,
  ): Promise<MutationResult>;
  getCurrentStudentAccountBindingInvite(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    requestId: string,
  ): Promise<JsonObject>;
  revokeStudentAccountBindingInvite(
    actor: TeachingActor,
    slug: string,
    studentId: string,
    inviteId: string,
    idempotencyKey: string,
    requestHash: string,
    requestId: string,
  ): Promise<MutationResult>;
  previewStudentAccountBindingInvite(
    actor: TeachingActor,
    input: ConsumeStudentAccountBindingInput,
    requestId: string,
  ): Promise<JsonObject>;
  consumeStudentAccountBindingInvite(
    actor: TeachingActor,
    input: ConsumeStudentAccountBindingInput,
    requestId: string,
  ): Promise<MutationResult>;
  listSelfTrainingAssignments(
    actor: TeachingActor,
    slug: string,
    pagination: PageInput,
    requestId: string,
  ): Promise<PageResult>;
  createSelfTrainingEvidence(
    actor: TeachingActor,
    slug: string,
    input: TrainingEvidenceV1,
    requestId: string,
  ): Promise<MutationResult>;
  listTrainingTemplates(
    actor: TeachingActor, slug: string, pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  getTrainingTemplate(
    actor: TeachingActor, slug: string, templateId: string, requestId: string,
  ): Promise<JsonObject>;
  createTrainingTemplate(
    actor: TeachingActor, slug: string, input: CreateTrainingTemplateInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listTrainingTemplateVersions(
    actor: TeachingActor, slug: string, templateId: string, pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  createTrainingTemplateVersion(
    actor: TeachingActor, slug: string, templateId: string, input: CreateTrainingTemplateVersionInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  archiveTrainingTemplate(
    actor: TeachingActor, slug: string, templateId: string,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listTrainingAssignments(
    actor: TeachingActor, slug: string, filter: TrainingAssignmentFilter,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  getTrainingAssignment(
    actor: TeachingActor, slug: string, assignmentId: string, requestId: string,
  ): Promise<JsonObject>;
  createTrainingAssignment(
    actor: TeachingActor, slug: string, input: WriteTrainingAssignmentInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  reviseTrainingAssignment(
    actor: TeachingActor, slug: string, assignmentId: string, input: WriteTrainingAssignmentInput,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  publishTrainingAssignment(
    actor: TeachingActor, slug: string, assignmentId: string,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  closeTrainingAssignment(
    actor: TeachingActor, slug: string, assignmentId: string,
    idempotencyKey: string, requestHash: string, requestId: string,
  ): Promise<MutationResult>;
  listTrainingAssignmentTargets(
    actor: TeachingActor, slug: string, assignmentId: string, filter: TrainingTargetFilter,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  listTrainingTargetEvidence(
    actor: TeachingActor, slug: string, assignmentId: string, studentId: string,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  listTrainingTargetReviews(
    actor: TeachingActor, slug: string, assignmentId: string, studentId: string,
    pagination: PageInput, requestId: string,
  ): Promise<PageResult>;
  createTrainingTargetReview(
    actor: TeachingActor, slug: string, assignmentId: string, studentId: string,
    input: CreateTrainingReviewInput, idempotencyKey: string, requestHash: string, requestId: string,
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

function trainingReviewRequestHash(assignmentId: string, studentId: string, rawBody: string): string {
  return sha256(JSON.stringify([assignmentId, studentId, rawBody]));
}

const STUDENT_ACCOUNT_BINDING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SELF_TRAINING_EVIDENCE_BACKFILL_MS = 30 * 24 * 60 * 60 * 1_000;

function assertOnlyKeys(body: JsonObject, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(body).find((key) => !allowedSet.has(key));
  if (unexpected) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${unexpected} is not accepted in ${label}`);
  }
}

function parseStudentAccountBindingInviteInput(body: JsonObject): CreateStudentAccountBindingInviteInput {
  assertOnlyKeys(body, ['expiresInMinutes'], 'student account binding invite input');
  const expiresInMinutes = body.expiresInMinutes === undefined
    ? 60
    : requiredInteger(body, 'expiresInMinutes', 5, 1_440);
  return { expiresInMinutes };
}

function parseStudentAccountBindingConsumeInput(body: JsonObject): { token: string } {
  assertOnlyKeys(body, ['token'], 'student account binding consume input');
  const token = requiredString(body, 'token', 43);
  if (!STUDENT_ACCOUNT_BINDING_TOKEN_PATTERN.test(token)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'token must be a 32-byte base64url value');
  }
  return { token };
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('Canonical JSON does not accept undefined');
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
}

function canonicalTrainingEvidencePayload(input: TrainingEvidenceV1): JsonObject {
  return {
    schemaVersion: 1,
    source: input.source,
    sourceEventId: input.sourceEventId,
    occurredAt: input.occurredAt,
    activity: input.activity,
    durationMs: input.durationMs ?? null,
    metrics: input.metrics as JsonObject,
    payloadVersion: input.payloadVersion,
    payload: (input.payload ?? {}) as JsonObject,
    assignmentIds: input.assignmentIds ?? [],
  };
}

async function withRepeatableReadRetry<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
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

function assertQueryKeys(c: Context, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unexpected = [...new URL(c.req.url).searchParams.keys()].find((key) => !allowedSet.has(key));
  if (unexpected) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${unexpected} is not accepted in this query`);
  }
}

function trainingPaginationOf(c: Context, extra: readonly string[] = []): PageInput {
  assertQueryKeys(c, ['page', 'pageSize', ...extra]);
  return paginationOf(c);
}

async function jsonBody(c: Context, maxBytes?: number): Promise<{ value: JsonObject; raw: string }> {
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

function optionalUuid(body: JsonObject, key: string): string | null {
  if (body[key] === undefined || body[key] === null) return null;
  return requiredUuid(body, key);
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

function optionalNormalizedCode(body: JsonObject): string | null {
  const code = optionalString(body, 'code', 64)?.toLowerCase() ?? null;
  if (code !== null && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(code)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'code must use lowercase letters, numbers, underscores, or hyphens');
  }
  return code;
}

function parseEffectiveRange(body: JsonObject): { effectiveFrom: string; effectiveTo: string | null } {
  const effectiveFrom = body.effectiveFrom === undefined
    ? new Date().toISOString()
    : requiredTimestamp(body, 'effectiveFrom');
  const effectiveTo = body.effectiveTo === undefined || body.effectiveTo === null
    ? null
    : requiredTimestamp(body, 'effectiveTo');
  if (effectiveTo !== null && new Date(effectiveTo).getTime() <= new Date(effectiveFrom).getTime()) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'effectiveTo must be after effectiveFrom');
  }
  return { effectiveFrom, effectiveTo };
}

function parseCampusInput(body: JsonObject): CreateCampusInput {
  const timezone = optionalString(body, 'timezone', 64);
  return {
    code: optionalNormalizedCode(body),
    name: requiredString(body, 'name', 160),
    timezone: timezone === null ? null : validTimezone(timezone),
  };
}

function parseGroupInput(body: JsonObject): CreateGroupInput {
  return {
    campusId: optionalUuid(body, 'campusId'),
    code: optionalNormalizedCode(body),
    name: requiredString(body, 'name', 160),
  };
}

function parseStudentGroupMembershipInput(body: JsonObject): CreateStudentGroupMembershipInput {
  return {
    studentId: requiredUuid(body, 'studentId'),
    ...parseEffectiveRange(body),
  };
}

function parseTeacherAssignmentInput(body: JsonObject): CreateTeacherAssignmentInput {
  if (!Number.isSafeInteger(body.teacherUserId) || (body.teacherUserId as number) <= 0) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'teacherUserId must be a positive integer');
  }
  const groupId = optionalUuid(body, 'groupId');
  const studentId = optionalUuid(body, 'studentId');
  if ((groupId === null) === (studentId === null)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'exactly one of groupId or studentId is required');
  }
  return {
    teacherUserId: body.teacherUserId as number,
    groupId,
    studentId,
    ...parseEffectiveRange(body),
  };
}

function teacherAssignmentTargetOf(c: Context): TeacherAssignmentTarget {
  const rawGroupId = c.req.query('groupId');
  const rawStudentId = c.req.query('studentId');
  if ((rawGroupId === undefined) === (rawStudentId === undefined)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'exactly one of groupId or studentId is required');
  }
  return {
    groupId: rawGroupId === undefined ? null : uuidParam(rawGroupId, 'groupId'),
    studentId: rawStudentId === undefined ? null : uuidParam(rawStudentId, 'studentId'),
  };
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

function parseTrainingTemplateInput(body: JsonObject): CreateTrainingTemplateInput {
  assertOnlyKeys(body, ['name', 'description'], 'training template input');
  const description = body.description;
  if (typeof description !== 'string' || description.length > 4_000) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'description must be a string up to 4000 characters');
  }
  return { name: requiredString(body, 'name', 200), description };
}

function parseTrainingTemplateVersionInput(body: JsonObject): CreateTrainingTemplateVersionInput {
  assertOnlyKeys(body, ['title', 'instructions', 'source', 'activity', 'toolConfig'], 'training template version input');
  if (!isTrainingEvidenceSource(body.source)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'source is not a registered training source');
  }
  const source = body.source as TrainingEvidenceSource;
  if (typeof body.activity !== 'string' || !isTrainingSourceActivity(source, body.activity)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'activity is not registered for source');
  }
  if (typeof body.instructions !== 'string' || body.instructions.length > 8_000) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'instructions must be a string up to 8000 characters');
  }
  let toolConfig: CreateTrainingTemplateVersionInput['toolConfig'];
  try {
    toolConfig = parseTrainingToolConfigForActivity(source, body.activity, body.toolConfig);
  } catch (error) {
    if (error instanceof TrainingEvidenceValidationError) {
      throw new TeachingApiException('INVALID_INPUT', 400, error.message);
    }
    throw error;
  }
  return {
    title: requiredString(body, 'title', 200),
    instructions: body.instructions,
    source,
    activity: body.activity as TrainingEvidenceActivity,
    toolConfig,
  };
}

function requiredUuidArray(body: JsonObject, key: string): string[] {
  const value = body[key];
  if (!Array.isArray(value) || value.length > 100) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be an array containing at most 100 UUIDs`);
  }
  const result = value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new TeachingApiException('INVALID_INPUT', 400, `${key}[${index}] must be a UUID`);
    }
    return uuidParam(entry, `${key}[${index}]`);
  });
  if (new Set(result).size !== result.length) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must not contain duplicates`);
  }
  return result.sort();
}

function parseTrainingAssignmentInput(body: JsonObject): WriteTrainingAssignmentInput {
  assertOnlyKeys(
    body,
    ['templateVersionId', 'title', 'instructions', 'scheduleKind', 'expectedCount', 'startsAt', 'endsAt', 'groupIds', 'studentIds', 'goals'],
    'training assignment input',
  );
  if (!TRAINING_SCHEDULE_KINDS.includes(body.scheduleKind as TrainingScheduleKind)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'scheduleKind must be once or daily');
  }
  if (typeof body.instructions !== 'string' || body.instructions.length > 8_000) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'instructions must be a string up to 8000 characters');
  }
  const startsAt = requiredTimestamp(body, 'startsAt');
  const endsAt = body.endsAt === null ? null : requiredTimestamp(body, 'endsAt');
  if (endsAt !== null && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'endsAt must be after startsAt');
  }
  if (body.scheduleKind === 'once' && endsAt === null) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'once assignments require endsAt');
  }
  const groupIds = requiredUuidArray(body, 'groupIds');
  const studentIds = requiredUuidArray(body, 'studentIds');
  if (groupIds.length + studentIds.length < 1 || groupIds.length + studentIds.length > 100) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'groupIds and studentIds must contain 1 to 100 total selectors');
  }
  if (!Array.isArray(body.goals) || body.goals.length > 4) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'goals must contain at most 4 items');
  }
  const goals = body.goals.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new TeachingApiException('INVALID_INPUT', 400, `goals[${index}] must be an object`);
    }
    const item = raw as JsonObject;
    assertOnlyKeys(item, ['metricKey', 'operator', 'targetValue'], `goals[${index}]`);
    if (!isTrainingGoalMetricKey(item.metricKey)) {
      throw new TeachingApiException('INVALID_INPUT', 400, `goals[${index}].metricKey is not registered`);
    }
    if (!isTrainingGoalOperator(item.operator)) {
      throw new TeachingApiException('INVALID_INPUT', 400, `goals[${index}].operator is not registered`);
    }
    return {
      metricKey: item.metricKey as TrainingGoalMetricKey,
      operator: item.operator as TrainingGoalOperator,
      targetValue: requiredInteger(item, 'targetValue', 0, Number.MAX_SAFE_INTEGER),
    };
  });
  if (new Set(goals.map((goal) => goal.metricKey)).size !== goals.length) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'goals must not repeat metricKey');
  }
  return {
    templateVersionId: requiredUuid(body, 'templateVersionId'),
    title: requiredString(body, 'title', 200),
    instructions: body.instructions,
    scheduleKind: body.scheduleKind as TrainingScheduleKind,
    expectedCount: requiredInteger(body, 'expectedCount', 1, 100_000),
    startsAt,
    endsAt,
    groupIds,
    studentIds,
    goals,
  };
}

function parseTrainingReviewInput(body: JsonObject): CreateTrainingReviewInput {
  assertOnlyKeys(body, ['status', 'rating', 'feedback'], 'training review input');
  if (!TRAINING_REVIEW_STATUSES.includes(body.status as TrainingReviewStatus)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'status must be commented, needs_changes, or accepted');
  }
  const rating = body.rating === null ? null : requiredInteger(body, 'rating', 1, 5);
  if (typeof body.feedback !== 'string' || body.feedback.length > 8_000) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'feedback must be a string up to 8000 characters');
  }
  return { status: body.status as TrainingReviewStatus, rating, feedback: body.feedback };
}

function trainingTargetFilterOf(c: Context): TrainingTargetFilter {
  const targetKind = c.req.query('targetKind');
  if (targetKind !== undefined && targetKind !== 'group' && targetKind !== 'student') {
    throw new TeachingApiException('INVALID_INPUT', 400, 'targetKind must be group or student');
  }
  return { targetKind: targetKind ?? null } as TrainingTargetFilter;
}

function trainingAssignmentFilterOf(c: Context): TrainingAssignmentFilter {
  const status = c.req.query('status');
  if (status !== undefined && !TRAINING_ASSIGNMENT_STATUSES.includes(status as TrainingAssignmentStatus)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'status must be draft, published, or closed');
  }
  return { status: (status as TrainingAssignmentStatus | undefined) ?? null };
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
      { reason: accessDenialReason(error) },
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

function crmConflict(error: unknown, message: string): never {
  const code = (error as { code?: string }).code;
  if (code === '23505' || code === '23503' || code === '23514' || code === '23P01' || code === '55000') {
    throw new TeachingApiException('CONFLICT', 409, message);
  }
  if (code === '40001' || code === '40P01') {
    throw new TeachingApiException('CONFLICT', 409, 'Concurrent teaching update; retry the complete request');
  }
  throw error;
}

function hasOrganizationCrmScope(role: TeachingOrganizationRole): boolean {
  return role === 'owner' || role === 'admin';
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function studentToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    accountUserId: row.account_user_id == null ? null : Number(row.account_user_id),
    externalRef: row.external_ref == null ? null : String(row.external_ref),
    displayName: String(row.display_name),
    status: String(row.status),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function campusToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    code: row.code == null ? null : String(row.code),
    name: String(row.name),
    timezone: row.timezone == null ? null : String(row.timezone),
    status: String(row.status),
    archivedAt: row.archived_at == null ? null : iso(row.archived_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function groupToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    campusId: row.campus_id == null ? null : String(row.campus_id),
    code: row.code == null ? null : String(row.code),
    name: String(row.name),
    status: String(row.status),
    archivedAt: row.archived_at == null ? null : iso(row.archived_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function membershipToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    groupId: String(row.group_id),
    effectiveFrom: iso(row.effective_from),
    effectiveTo: row.effective_to == null ? null : iso(row.effective_to),
    createdAt: iso(row.created_at),
    student: {
      id: String(row.student_id),
      displayName: String(row.student_display_name),
      externalRef: row.student_external_ref == null ? null : String(row.student_external_ref),
      status: String(row.student_status),
    },
  };
}

function assignmentToJson(row: Record<string, unknown>): JsonObject {
  const liveUserId = row.teacher_user_id == null ? null : Number(row.teacher_user_id);
  return {
    id: String(row.id),
    teacherUserId: liveUserId,
    teacherUserIdSnapshot: Number(row.teacher_user_id_snapshot),
    groupId: row.group_id == null ? null : String(row.group_id),
    studentId: row.student_id == null ? null : String(row.student_id),
    effectiveFrom: iso(row.effective_from),
    effectiveTo: row.effective_to == null ? null : iso(row.effective_to),
    createdAt: iso(row.created_at),
    teacher: {
      userId: liveUserId,
      displayName: String(row.teacher_display_name_snapshot),
      role: String(row.teacher_role_snapshot),
      status: row.teacher_member_status == null ? null : String(row.teacher_member_status),
    },
  };
}

function trainingTemplateToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    description: String(row.description),
    status: String(row.status),
    latestVersionNumber: row.latest_version_number == null ? null : Number(row.latest_version_number),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function trainingTemplateVersionToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    templateId: String(row.template_id),
    versionNumber: Number(row.version_number),
    title: String(row.title),
    instructions: String(row.instructions),
    source: String(row.source),
    activity: String(row.activity),
    toolConfig: row.tool_config as JsonObject,
    publishedAt: iso(row.published_at),
  };
}

function trainingAssignmentToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    templateVersionId: String(row.template_version_id),
    title: String(row.title),
    instructions: String(row.instructions),
    status: String(row.status),
    scheduleKind: String(row.schedule_kind),
    expectedCount: Number(row.expected_count),
    timezoneSnapshot: String(row.timezone_snapshot),
    startsAt: iso(row.starts_at),
    endsAt: row.ends_at == null ? null : iso(row.ends_at),
    publishedAt: row.published_at == null ? null : iso(row.published_at),
    closedAt: row.closed_at == null ? null : iso(row.closed_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function trainingTargetToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    assignmentId: String(row.assignment_id),
    targetKind: String(row.target_kind),
    groupId: row.group_id == null ? null : String(row.group_id),
    sourceGroupId: row.source_group_id == null ? null : String(row.source_group_id),
    studentId: row.student_id == null ? null : String(row.student_id),
    groupNameSnapshot: row.group_name_snapshot == null ? null : String(row.group_name_snapshot),
    studentDisplayNameSnapshot: row.student_display_name_snapshot == null
      ? null
      : String(row.student_display_name_snapshot),
    studentExternalRefSnapshot: row.student_external_ref_snapshot == null
      ? null
      : String(row.student_external_ref_snapshot),
    evidenceCount: String(row.evidence_count),
    firstEvidenceAt: row.first_evidence_at == null ? null : iso(row.first_evidence_at),
    lastEvidenceAt: row.last_evidence_at == null ? null : iso(row.last_evidence_at),
    latestReviewRevision: Number(row.latest_review_revision),
    latestReviewStatus: row.latest_review_status == null ? null : String(row.latest_review_status),
  };
}

function trainingGoalToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    assignmentId: String(row.assignment_id),
    metricKey: String(row.metric_key),
    operator: String(row.operator),
    targetValue: Number(row.target_value),
  };
}

function trainingReviewToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    assignmentId: String(row.assignment_id),
    studentId: String(row.student_id),
    revision: Number(row.revision),
    reviewerUserId: row.reviewer_user_id == null ? null : Number(row.reviewer_user_id),
    reviewerUserIdSnapshot: Number(row.reviewer_user_id_snapshot),
    reviewerDisplayNameSnapshot: String(row.reviewer_display_name_snapshot),
    reviewerRoleSnapshot: String(row.reviewer_role_snapshot),
    status: String(row.status),
    rating: row.rating == null ? null : Number(row.rating),
    feedback: String(row.feedback),
    createdAt: iso(row.created_at),
  };
}

function bindingInviteToJson(row: Record<string, unknown>): JsonObject {
  const databaseNow = new Date(String(row.database_now)).getTime();
  if (!Number.isFinite(databaseNow)) {
    throw new Error('Student account binding invite query must include database_now');
  }
  const status = row.consumed_at != null
    ? 'consumed'
    : row.revoked_at != null
      ? 'revoked'
      : row.expired_at != null || new Date(String(row.expires_at)).getTime() <= databaseNow
        ? 'expired'
        : 'pending';
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studentId: String(row.student_id),
    status,
    expiresAt: iso(row.expires_at),
    expiredAt: row.expired_at == null ? null : iso(row.expired_at),
    consumedAt: row.consumed_at == null ? null : iso(row.consumed_at),
    revokedAt: row.revoked_at == null ? null : iso(row.revoked_at),
    createdAt: iso(row.created_at),
  };
}

function selfTrainingAssignmentToJson(row: Record<string, unknown>): JsonObject {
  return {
    assignment: {
      id: String(row.assignment_id),
      organizationId: String(row.organization_id),
      templateVersionId: String(row.template_version_id),
      title: String(row.assignment_title),
      instructions: String(row.assignment_instructions),
      status: String(row.assignment_status),
      scheduleKind: String(row.schedule_kind),
      expectedCount: Number(row.expected_count),
      timezoneSnapshot: String(row.timezone_snapshot),
      startsAt: iso(row.starts_at),
      endsAt: row.ends_at == null ? null : iso(row.ends_at),
      publishedAt: row.published_at == null ? null : iso(row.published_at),
      closedAt: row.closed_at == null ? null : iso(row.closed_at),
      createdAt: iso(row.assignment_created_at),
      updatedAt: iso(row.assignment_updated_at),
    },
    target: {
      id: String(row.target_id),
      organizationId: String(row.organization_id),
      assignmentId: String(row.assignment_id),
      targetKind: 'student',
      groupId: null,
      sourceGroupId: row.source_group_id == null ? null : String(row.source_group_id),
      studentId: String(row.student_id),
      groupNameSnapshot: null,
      studentDisplayNameSnapshot: String(row.student_display_name_snapshot),
      studentExternalRefSnapshot: row.student_external_ref_snapshot == null
        ? null
        : String(row.student_external_ref_snapshot),
      evidenceCount: String(row.evidence_count),
      firstEvidenceAt: row.first_evidence_at == null ? null : iso(row.first_evidence_at),
      lastEvidenceAt: row.last_evidence_at == null ? null : iso(row.last_evidence_at),
      latestReviewRevision: Number(row.latest_review_revision),
      latestReviewStatus: row.latest_review_status == null ? null : String(row.latest_review_status),
    },
    template: {
      id: String(row.template_id),
      name: String(row.template_name),
    },
    templateVersion: {
      id: String(row.template_version_id),
      organizationId: String(row.organization_id),
      templateId: String(row.template_id),
      versionNumber: Number(row.version_number),
      title: String(row.version_title),
      instructions: String(row.version_instructions),
      source: String(row.source),
      activity: String(row.activity),
      toolConfig: row.tool_config as JsonObject,
      publishedAt: iso(row.version_published_at),
    },
    goals: (row.goals as Array<Record<string, unknown>>).map((goal) => ({
      id: String(goal.id),
      organizationId: String(row.organization_id),
      assignmentId: String(row.assignment_id),
      metricKey: String(goal.metricKey),
      operator: String(goal.operator),
      targetValue: Number(goal.targetValue),
    })),
  };
}

function trainingEvidenceToJson(row: Record<string, unknown>): JsonObject {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studentId: String(row.student_id),
    source: String(row.source),
    sourceEventId: String(row.source_event_id),
    trustLevel: String(row.trust_level),
    occurredAt: iso(row.occurred_at),
    timezoneSnapshot: String(row.timezone_snapshot),
    localDate: row.local_date instanceof Date
      ? row.local_date.toISOString().slice(0, 10)
      : String(row.local_date).slice(0, 10),
    activity: String(row.activity),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    resultMs: row.result_ms == null ? null : Number(row.result_ms),
    success: row.success == null ? null : Boolean(row.success),
    payloadVersion: Number(row.payload_version),
    createdAt: iso(row.created_at),
  };
}

function selfTrainingEvidenceReceipt(row: Record<string, unknown>): JsonObject {
  const evidence = trainingEvidenceToJson(row);
  return {
    id: evidence.id,
    source: evidence.source,
    sourceEventId: evidence.sourceEventId,
    trustLevel: evidence.trustLevel,
    occurredAt: evidence.occurredAt,
    localDate: evidence.localDate,
    durationMs: evidence.durationMs,
    resultMs: evidence.resultMs,
    success: evidence.success,
    createdAt: evidence.createdAt,
  };
}

interface BoundSelfStudent {
  organizationId: string;
  organizationName: string;
  organizationTimezone: string;
  studentId: string;
  studentDisplayName: string;
  accountLinkedAt: string;
  databaseNow: string;
}

async function boundSelfStudentForUpdate(
  tx: Tx,
  actorUserId: number,
  slug: string,
): Promise<BoundSelfStudent> {
  const actors = await tx`
    SELECT id FROM app_users WHERE id = ${actorUserId} FOR KEY SHARE`;
  if (!actors.length) {
    throw new TeachingApiException('UNAUTHENTICATED', 401, 'Authentication required');
  }
  const rows = await tx`
    SELECT o.id AS organization_id, o.name AS organization_name,
           o.timezone AS organization_timezone,
           student.id AS student_id, student.display_name AS student_display_name,
           student.account_linked_at, clock_timestamp() AS database_now
    FROM organizations o
    JOIN student_profiles student
      ON student.organization_id = o.id
     AND student.account_user_id = ${actorUserId}
    WHERE o.slug = ${slug}
      AND o.status = 'active'
      AND student.status = 'active'
    FOR UPDATE OF student`;
  if (!rows.length) {
    throw new ConcealedTeachingPermissionDeniedException('Student account binding not found');
  }
  const row = rows[0] as Record<string, unknown>;
  return {
    organizationId: String(row.organization_id),
    organizationName: String(row.organization_name),
    organizationTimezone: String(row.organization_timezone),
    studentId: String(row.student_id),
    studentDisplayName: String(row.student_display_name),
    accountLinkedAt: iso(row.account_linked_at),
    databaseNow: iso(row.database_now),
  };
}

const ACTIVE_STUDENT_SCOPE_CTE = `
  WITH active_scope_actor AS (
    SELECT member.organization_id, member.user_id
    FROM organization_members member
    WHERE member.organization_id = ?
      AND member.user_id = ?
      AND member.status = 'active'
      AND member.role IN ('teacher', 'assistant')
  ), scoped_student_ids AS (
    SELECT ta.student_id AS id
    FROM teacher_assignments ta
    JOIN active_scope_actor actor
      ON actor.organization_id = ta.organization_id AND actor.user_id = ta.teacher_user_id
    JOIN student_profiles direct_student
      ON direct_student.organization_id = ta.organization_id AND direct_student.id = ta.student_id
    WHERE ta.organization_id = ?
      AND ta.student_id IS NOT NULL
      AND ta.effective_from <= NOW()
      AND (ta.effective_to IS NULL OR ta.effective_to > NOW())
      AND direct_student.status = 'active'
    UNION
    SELECT membership.student_id AS id
    FROM teacher_assignments ta
    JOIN active_scope_actor actor
      ON actor.organization_id = ta.organization_id AND actor.user_id = ta.teacher_user_id
    JOIN teaching_groups teaching_group
      ON teaching_group.organization_id = ta.organization_id AND teaching_group.id = ta.group_id
    LEFT JOIN teaching_campuses campus
      ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
    JOIN student_group_memberships membership
      ON membership.organization_id = teaching_group.organization_id AND membership.group_id = teaching_group.id
    JOIN student_profiles group_student
      ON group_student.organization_id = membership.organization_id AND group_student.id = membership.student_id
    WHERE ta.organization_id = ?
      AND ta.group_id IS NOT NULL
      AND ta.effective_from <= NOW()
      AND (ta.effective_to IS NULL OR ta.effective_to > NOW())
      AND membership.effective_from <= NOW()
      AND (membership.effective_to IS NULL OR membership.effective_to > NOW())
      AND teaching_group.status = 'active'
      AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
      AND group_student.status = 'active'
  )`;

const ACTIVE_TRAINING_SCOPE_CTE = `
  WITH active_scope_actor AS (
    SELECT member.organization_id, member.user_id
    FROM organization_members member
    WHERE member.organization_id = ? AND member.user_id = ?
      AND member.status = 'active' AND member.role IN ('teacher', 'assistant')
  ), scoped_group_ids AS (
    SELECT assignment.group_id AS id
    FROM teacher_assignments assignment
    JOIN active_scope_actor actor
      ON actor.organization_id = assignment.organization_id
     AND actor.user_id = assignment.teacher_user_id
    JOIN teaching_groups teaching_group
      ON teaching_group.organization_id = assignment.organization_id
     AND teaching_group.id = assignment.group_id
     AND teaching_group.status = 'active'
    LEFT JOIN teaching_campuses campus
      ON campus.organization_id = teaching_group.organization_id
     AND campus.id = teaching_group.campus_id
    WHERE assignment.organization_id = ? AND assignment.group_id IS NOT NULL
      AND assignment.effective_from <= NOW()
      AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
      AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
  ), scoped_student_ids AS (
    SELECT assignment.student_id AS id
    FROM teacher_assignments assignment
    JOIN active_scope_actor actor
      ON actor.organization_id = assignment.organization_id
     AND actor.user_id = assignment.teacher_user_id
    JOIN student_profiles student
      ON student.organization_id = assignment.organization_id
     AND student.id = assignment.student_id AND student.status = 'active'
    WHERE assignment.organization_id = ? AND assignment.student_id IS NOT NULL
      AND assignment.effective_from <= NOW()
      AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
    UNION
    SELECT membership.student_id
    FROM scoped_group_ids scoped_group
    JOIN student_group_memberships membership ON membership.group_id = scoped_group.id
    JOIN student_profiles student
      ON student.organization_id = membership.organization_id
     AND student.id = membership.student_id AND student.status = 'active'
    WHERE membership.organization_id = ?
      AND membership.effective_from <= NOW()
      AND (membership.effective_to IS NULL OR membership.effective_to > NOW())
  )`;

function activeTrainingScopeParams(access: OrganizationAccess, actor: TeachingActor): unknown[] {
  return [access.id, actor.userId, access.id, access.id, access.id];
}

function activeStudentScopeParams(access: OrganizationAccess, actor: TeachingActor): unknown[] {
  return [access.id, actor.userId, access.id, access.id];
}

function hasOrganizationTrainingScope(role: TeachingOrganizationRole): boolean {
  return role === 'owner' || role === 'admin';
}

async function actorHasActiveStudentScope(
  tx: Tx,
  organizationId: string,
  actorUserId: number,
  studentId: string,
): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1
      FROM organization_members member
      WHERE member.organization_id = ${organizationId}
        AND member.user_id = ${actorUserId}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
        AND EXISTS (
          SELECT 1 FROM student_profiles scoped_student
          WHERE scoped_student.organization_id = member.organization_id
            AND scoped_student.id = ${studentId}
            AND scoped_student.status = 'active'
        )
        AND (
          EXISTS (
            SELECT 1 FROM teacher_assignments direct_scope
            WHERE direct_scope.organization_id = member.organization_id
              AND direct_scope.teacher_user_id = member.user_id
              AND direct_scope.student_id = ${studentId}
              AND direct_scope.effective_from <= clock_timestamp()
              AND (direct_scope.effective_to IS NULL OR direct_scope.effective_to > clock_timestamp())
          )
          OR EXISTS (
            SELECT 1
            FROM teacher_assignments group_scope
            JOIN teaching_groups teaching_group
              ON teaching_group.organization_id = group_scope.organization_id
             AND teaching_group.id = group_scope.group_id
             AND teaching_group.status = 'active'
            LEFT JOIN teaching_campuses campus
              ON campus.organization_id = teaching_group.organization_id
             AND campus.id = teaching_group.campus_id
            JOIN student_group_memberships membership
              ON membership.organization_id = group_scope.organization_id
             AND membership.group_id = group_scope.group_id
             AND membership.student_id = ${studentId}
             AND membership.effective_from <= clock_timestamp()
             AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
            WHERE group_scope.organization_id = member.organization_id
              AND group_scope.teacher_user_id = member.user_id
              AND group_scope.effective_from <= clock_timestamp()
              AND (group_scope.effective_to IS NULL OR group_scope.effective_to > clock_timestamp())
              AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
          )
        )
    ) AS allowed`;
  return Boolean(rows[0]?.allowed);
}

async function actorHasActiveGroupScope(
  tx: Tx,
  organizationId: string,
  actorUserId: number,
  groupId: string,
): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1
      FROM organization_members member
      JOIN teacher_assignments group_scope
        ON group_scope.organization_id = member.organization_id
       AND group_scope.teacher_user_id = member.user_id
       AND group_scope.group_id = ${groupId}
       AND group_scope.effective_from <= clock_timestamp()
       AND (group_scope.effective_to IS NULL OR group_scope.effective_to > clock_timestamp())
      JOIN teaching_groups teaching_group
        ON teaching_group.organization_id = group_scope.organization_id
       AND teaching_group.id = group_scope.group_id
       AND teaching_group.status = 'active'
      LEFT JOIN teaching_campuses campus
        ON campus.organization_id = teaching_group.organization_id
       AND campus.id = teaching_group.campus_id
      WHERE member.organization_id = ${organizationId}
        AND member.user_id = ${actorUserId}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
        AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
    ) AS allowed`;
  return Boolean(rows[0]?.allowed);
}

async function touchTrainingRelationLock(
  tx: Tx,
  organizationId: string,
  relationKind: 'student_group' | 'teacher_group' | 'teacher_student',
  subjectKey: string,
  targetKey: string,
): Promise<void> {
  await tx`
    INSERT INTO teaching_relation_locks (
      organization_id, relation_kind, subject_key, target_key
    ) VALUES (${organizationId}, ${relationKind}, ${subjectKey}, ${targetKey})
    ON CONFLICT (organization_id, relation_kind, subject_key, target_key)
    DO UPDATE SET revision = teaching_relation_locks.revision + 1,
                  touched_at = clock_timestamp()`;
}

async function lockAndCheckTeacherGroupScope(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  groupId: string,
): Promise<boolean> {
  await touchTrainingRelationLock(tx, access.id, 'teacher_group', String(actor.userId), groupId);
  return actorHasActiveGroupScope(tx, access.id, actor.userId, groupId);
}

async function actorHasExactDirectStudentScope(
  tx: Tx,
  organizationId: string,
  actorUserId: number,
  studentId: string,
): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1
      FROM organization_members member
      JOIN teacher_assignments assignment
        ON assignment.organization_id = member.organization_id
       AND assignment.teacher_user_id = member.user_id
       AND assignment.student_id = ${studentId}
       AND assignment.effective_from <= clock_timestamp()
       AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
      JOIN student_profiles student
        ON student.organization_id = assignment.organization_id
       AND student.id = assignment.student_id
       AND student.status = 'active'
      WHERE member.organization_id = ${organizationId}
        AND member.user_id = ${actorUserId}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
    ) AS allowed`;
  return Boolean(rows[0]?.allowed);
}

async function actorHasExactGroupStudentScope(
  tx: Tx,
  organizationId: string,
  actorUserId: number,
  groupId: string,
  studentId: string,
): Promise<boolean> {
  const rows = await tx`
    SELECT EXISTS (
      SELECT 1
      FROM organization_members member
      JOIN teacher_assignments assignment
        ON assignment.organization_id = member.organization_id
       AND assignment.teacher_user_id = member.user_id
       AND assignment.group_id = ${groupId}
       AND assignment.effective_from <= clock_timestamp()
       AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
      JOIN teaching_groups teaching_group
        ON teaching_group.organization_id = assignment.organization_id
       AND teaching_group.id = assignment.group_id
       AND teaching_group.status = 'active'
      LEFT JOIN teaching_campuses campus
        ON campus.organization_id = teaching_group.organization_id
       AND campus.id = teaching_group.campus_id
      JOIN student_group_memberships membership
        ON membership.organization_id = assignment.organization_id
       AND membership.group_id = assignment.group_id
       AND membership.student_id = ${studentId}
       AND membership.effective_from <= clock_timestamp()
       AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
      JOIN student_profiles student
        ON student.organization_id = membership.organization_id
       AND student.id = membership.student_id
       AND student.status = 'active'
      WHERE member.organization_id = ${organizationId}
        AND member.user_id = ${actorUserId}
        AND member.status = 'active'
        AND member.role IN ('teacher', 'assistant')
        AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
    ) AS allowed`;
  return Boolean(rows[0]?.allowed);
}

async function lockAndCheckTeacherStudentScope(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  studentId: string,
): Promise<boolean> {
  const candidateRows = await tx`
    SELECT NULL::uuid AS group_id, 0 AS priority
    FROM teacher_assignments assignment
    JOIN organization_members member
      ON member.organization_id = assignment.organization_id
     AND member.user_id = assignment.teacher_user_id
     AND member.status = 'active'
     AND member.role IN ('teacher', 'assistant')
    JOIN student_profiles student
      ON student.organization_id = assignment.organization_id
     AND student.id = assignment.student_id
     AND student.status = 'active'
    WHERE assignment.organization_id = ${access.id}
      AND assignment.teacher_user_id = ${actor.userId}
      AND assignment.student_id = ${studentId}
      AND assignment.effective_from <= clock_timestamp()
      AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
    UNION ALL
    SELECT assignment.group_id, 1 AS priority
    FROM teacher_assignments assignment
    JOIN organization_members member
      ON member.organization_id = assignment.organization_id
     AND member.user_id = assignment.teacher_user_id
     AND member.status = 'active'
     AND member.role IN ('teacher', 'assistant')
    JOIN teaching_groups teaching_group
      ON teaching_group.organization_id = assignment.organization_id
     AND teaching_group.id = assignment.group_id
     AND teaching_group.status = 'active'
    LEFT JOIN teaching_campuses campus
      ON campus.organization_id = teaching_group.organization_id
     AND campus.id = teaching_group.campus_id
    JOIN student_group_memberships membership
      ON membership.organization_id = assignment.organization_id
     AND membership.group_id = assignment.group_id
     AND membership.student_id = ${studentId}
     AND membership.effective_from <= clock_timestamp()
     AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
    JOIN student_profiles student
      ON student.organization_id = membership.organization_id
     AND student.id = membership.student_id
     AND student.status = 'active'
    WHERE assignment.organization_id = ${access.id}
      AND assignment.teacher_user_id = ${actor.userId}
      AND assignment.group_id IS NOT NULL
      AND assignment.effective_from <= clock_timestamp()
      AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
      AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
    ORDER BY priority, group_id NULLS FIRST
    LIMIT 1`;
  if (!candidateRows.length) return false;
  const groupId = candidateRows[0].group_id == null ? null : String(candidateRows[0].group_id);
  if (groupId === null) {
    await touchTrainingRelationLock(tx, access.id, 'teacher_student', String(actor.userId), studentId);
    return actorHasExactDirectStudentScope(tx, access.id, actor.userId, studentId);
  } else {
    await touchTrainingRelationLock(tx, access.id, 'teacher_group', String(actor.userId), groupId);
    await touchTrainingRelationLock(tx, access.id, 'student_group', studentId, groupId);
    return actorHasExactGroupStudentScope(tx, access.id, actor.userId, groupId, studentId);
  }
}

async function trainingAssignmentEnvelope(
  tx: Tx,
  organizationId: string,
  assignmentId: string,
): Promise<JsonObject> {
  const assignments = await tx`
    SELECT assignment.*, version.id AS version_id, version.template_id,
           version.version_number, version.title AS version_title,
           version.instructions AS version_instructions, version.source,
           version.activity, version.tool_config, version.published_at AS version_published_at
    FROM training_assignments assignment
    JOIN training_template_versions version
      ON version.organization_id = assignment.organization_id
     AND version.id = assignment.template_version_id
    WHERE assignment.organization_id = ${organizationId}
      AND assignment.id = ${assignmentId}`;
  if (!assignments.length) {
    throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment not found');
  }
  const goals = await tx`
    SELECT * FROM training_assignment_goal_metrics
    WHERE organization_id = ${organizationId} AND assignment_id = ${assignmentId}
    ORDER BY metric_key`;
  const row = assignments[0] as Record<string, unknown>;
  return {
    assignment: trainingAssignmentToJson(row),
    templateVersion: trainingTemplateVersionToJson({
      id: row.version_id,
      organization_id: row.organization_id,
      template_id: row.template_id,
      version_number: row.version_number,
      title: row.version_title,
      instructions: row.version_instructions,
      source: row.source,
      activity: row.activity,
      tool_config: row.tool_config,
      published_at: row.version_published_at,
    }),
    goals: goals.map((goal) => trainingGoalToJson(goal as Record<string, unknown>)),
  };
}

async function trainingResourceMissing(
  tx: Tx,
  table: 'training_templates' | 'training_assignments',
  id: string,
  message: string,
): Promise<never> {
  const rows = table === 'training_templates'
    ? await tx`SELECT 1 FROM training_templates WHERE id = ${id}`
    : await tx`SELECT 1 FROM training_assignments WHERE id = ${id}`;
  if (rows.length) throw new ConcealedTeachingPermissionDeniedException(message);
  throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, message);
}

async function trainingSelectorMissing(
  tx: Tx,
  access: OrganizationAccess,
  table: 'training_template_versions' | 'teaching_groups' | 'student_profiles',
  id: string,
  message: string,
): Promise<never> {
  const rows = table === 'training_template_versions'
    ? await tx`SELECT organization_id FROM training_template_versions WHERE id = ${id}`
    : table === 'teaching_groups'
      ? await tx`SELECT organization_id FROM teaching_groups WHERE id = ${id}`
      : await tx`SELECT organization_id FROM student_profiles WHERE id = ${id}`;
  if (rows.length && String(rows[0].organization_id) !== access.id) {
    throw new ConcealedTeachingPermissionDeniedException(message);
  }
  throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, message);
}

async function assertTrainingAssignmentScope(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  assignment: Record<string, unknown>,
  mode: 'read' | 'manage',
): Promise<void> {
  if (hasOrganizationTrainingScope(access.role)) return;
  const selectors = await tx`
    SELECT target_kind, group_id, student_id, source_group_id
    FROM training_assignment_targets
    WHERE organization_id = ${access.id} AND assignment_id = ${String(assignment.id)}
      AND (target_kind = 'group' OR source_group_id IS NULL)
    ORDER BY target_kind, COALESCE(group_id, student_id)`;
  if (mode === 'manage') {
    if (access.role !== 'teacher') {
      throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
    }
    for (const selector of selectors) {
      const allowed = selector.target_kind === 'group'
        ? await lockAndCheckTeacherGroupScope(tx, access, actor, String(selector.group_id))
        : await lockAndCheckTeacherStudentScope(tx, access, actor, String(selector.student_id));
      if (!allowed) throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
    }
    if (!selectors.length) throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
    return;
  }
  for (const selector of selectors) {
    const allowed = selector.target_kind === 'group'
      ? await actorHasActiveGroupScope(tx, access.id, actor.userId, String(selector.group_id))
      : await actorHasActiveStudentScope(tx, access.id, actor.userId, String(selector.student_id));
    if (allowed) return;
  }
  const expanded = await tx`
    SELECT student_id FROM training_assignment_targets
    WHERE organization_id = ${access.id} AND assignment_id = ${String(assignment.id)}
      AND target_kind = 'student' AND source_group_id IS NOT NULL
    ORDER BY student_id`;
  for (const target of expanded) {
    if (await actorHasActiveStudentScope(tx, access.id, actor.userId, String(target.student_id))) return;
  }
  throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
}

async function replaceTrainingAssignmentDraft(
  tx: Tx,
  access: OrganizationAccess,
  assignmentId: string,
  input: WriteTrainingAssignmentInput,
): Promise<void> {
  await tx`DELETE FROM training_assignment_goal_metrics
           WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}`;
  await tx`DELETE FROM training_assignment_targets
           WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}`;
  for (const groupId of input.groupIds) {
    const groups = await tx`SELECT name FROM teaching_groups
      WHERE organization_id = ${access.id} AND id = ${groupId}`;
    await tx`INSERT INTO training_assignment_targets (
      organization_id, assignment_id, target_kind, group_id, group_name_snapshot
    ) VALUES (${access.id}, ${assignmentId}, 'group', ${groupId}, ${String(groups[0].name)})`;
  }
  for (const studentId of input.studentIds) {
    const students = await tx`SELECT display_name, external_ref FROM student_profiles
      WHERE organization_id = ${access.id} AND id = ${studentId}`;
    await tx`INSERT INTO training_assignment_targets (
      organization_id, assignment_id, target_kind, student_id,
      student_display_name_snapshot, student_external_ref_snapshot
    ) VALUES (
      ${access.id}, ${assignmentId}, 'student', ${studentId},
      ${String(students[0].display_name)}, ${students[0].external_ref == null ? null : String(students[0].external_ref)}
    )`;
  }
  for (const goal of input.goals) {
    await tx`INSERT INTO training_assignment_goal_metrics (
      organization_id, assignment_id, metric_key, operator, target_value
    ) VALUES (${access.id}, ${assignmentId}, ${goal.metricKey}, ${goal.operator}, ${goal.targetValue})`;
  }
}

async function insertTrainingAudit(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  action: string,
  entityType: string,
  entityId: string,
  requestId: string,
  metadata: JsonObject,
): Promise<void> {
  await tx`INSERT INTO teaching_audit_events (
    organization_id, actor_user_id, actor_role, actor_display_name,
    action, entity_type, entity_id, request_id, metadata
  ) VALUES (
    ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
    ${action}, ${entityType}, ${entityId}, ${requestId}, ${sql.json(metadata)}
  )`;
}

async function lockAndValidateTrainingSelectors(
  tx: Tx,
  access: OrganizationAccess,
  actor: TeachingActor,
  input: WriteTrainingAssignmentInput,
): Promise<Record<string, unknown>> {
  const versions = await tx`
    SELECT version.*, template.status AS template_status
    FROM training_template_versions version
    JOIN training_templates template
      ON template.organization_id = version.organization_id
     AND template.id = version.template_id
    WHERE version.organization_id = ${access.id}
      AND version.id = ${input.templateVersionId}
    FOR UPDATE OF template`;
  if (!versions.length || versions[0].template_status !== 'active') {
    await trainingSelectorMissing(
      tx, access, 'training_template_versions', input.templateVersionId,
      'Training template version not found',
    );
  }
  const version = versions[0] as Record<string, unknown>;
  for (const goal of input.goals) {
    if (!isTrainingGoalRegistered(
      String(version.source) as TrainingEvidenceSource,
      String(version.activity),
      goal.metricKey,
      goal.operator,
    )) {
      throw new TeachingApiException('INVALID_INPUT', 400, `${goal.metricKey}/${goal.operator} is not registered for this training activity`);
    }
  }
  for (const groupId of input.groupIds) {
    if (!hasOrganizationTrainingScope(access.role)
        && !await lockAndCheckTeacherGroupScope(tx, access, actor, groupId)) {
      throw new ConcealedTeachingPermissionDeniedException('Training group selector not found');
    }
    const groups = await tx`
      SELECT teaching_group.id
      FROM teaching_groups teaching_group
      LEFT JOIN teaching_campuses campus
        ON campus.organization_id = teaching_group.organization_id
       AND campus.id = teaching_group.campus_id
      WHERE teaching_group.organization_id = ${access.id}
        AND teaching_group.id = ${groupId}
        AND teaching_group.status = 'active'
        AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
      FOR UPDATE OF teaching_group`;
    if (!groups.length) {
      await trainingSelectorMissing(tx, access, 'teaching_groups', groupId, 'Training group selector not found');
    }
  }
  for (const studentId of input.studentIds) {
    if (!hasOrganizationTrainingScope(access.role)
        && !await lockAndCheckTeacherStudentScope(tx, access, actor, studentId)) {
      throw new ConcealedTeachingPermissionDeniedException('Training student selector not found');
    }
    const students = await tx`
      SELECT id FROM student_profiles
      WHERE organization_id = ${access.id} AND id = ${studentId} AND status = 'active'
      FOR UPDATE`;
    if (!students.length) {
      await trainingSelectorMissing(tx, access, 'student_profiles', studentId, 'Training student selector not found');
    }
  }
  return version;
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
          ? hasOrganizationCrmScope(access.role)
            ? query<Record<string, unknown>>(
                'SELECT COUNT(*)::int AS count FROM student_profiles WHERE organization_id = ?',
                [access.id],
              )
            : query<Record<string, unknown>>(
                `${ACTIVE_STUDENT_SCOPE_CTE}
                 SELECT COUNT(*)::int AS count FROM scoped_student_ids`,
                activeStudentScopeParams(access, actor),
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
      const organizationScope = hasOrganizationCrmScope(access.role);
      const scopeParams = activeStudentScopeParams(access, actor);
      const [countRows, rows] = await Promise.all(organizationScope ? [
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM student_profiles WHERE organization_id = ?', [access.id],
        ),
        query<Record<string, unknown>>(
          `SELECT id, account_user_id, external_ref, display_name, status, created_at, updated_at
           FROM student_profiles
           WHERE organization_id = ?
           ORDER BY display_name, id
           LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ] : [
        query<Record<string, unknown>>(
          `${ACTIVE_STUDENT_SCOPE_CTE} SELECT COUNT(*)::int AS count FROM scoped_student_ids`, scopeParams,
        ),
        query<Record<string, unknown>>(
          `${ACTIVE_STUDENT_SCOPE_CTE}
           SELECT student.id, student.account_user_id, student.external_ref, student.display_name,
                  student.status, student.created_at, student.updated_at
           FROM student_profiles student
           JOIN scoped_student_ids scope ON scope.id = student.id
           ORDER BY student.display_name, student.id
           LIMIT ? OFFSET ?`,
          [...scopeParams, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(studentToJson),
        total: Number(countRows[0]?.count ?? 0),
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
    });
  },

  async getStudent(actor, slug, studentId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'student:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const rows = organizationScope
        ? await query<Record<string, unknown>>(
            `SELECT id, account_user_id, external_ref, display_name, status, created_at, updated_at
             FROM student_profiles WHERE organization_id = ? AND id = ?`,
            [access.id, studentId],
          )
        : await query<Record<string, unknown>>(
            `${ACTIVE_STUDENT_SCOPE_CTE}
             SELECT student.id, student.account_user_id, student.external_ref, student.display_name,
                    student.status, student.created_at, student.updated_at
             FROM student_profiles student
             JOIN scoped_student_ids scope ON scope.id = student.id
             WHERE student.id = ?`,
            [...activeStudentScopeParams(access, actor), studentId],
          );
      if (!rows.length) {
        const exists = await query<Record<string, unknown>>(
          'SELECT 1 FROM student_profiles WHERE organization_id = ? AND id = ?', [access.id, studentId],
        );
        if (exists.length && !organizationScope) {
          throw new ConcealedTeachingPermissionDeniedException('Student not found');
        }
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
      }
      return studentToJson(rows[0]);
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

  async listCampuses(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'campus.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'campus:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const scopeSql = organizationScope ? '' : `
        AND campus.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM teacher_assignments assignment
          JOIN teaching_groups teaching_group
            ON teaching_group.organization_id = assignment.organization_id
           AND teaching_group.id = assignment.group_id
           WHERE assignment.organization_id = campus.organization_id
             AND assignment.teacher_user_id = ?
             AND EXISTS (
               SELECT 1 FROM organization_members scoped_member
               WHERE scoped_member.organization_id = assignment.organization_id
                 AND scoped_member.user_id = assignment.teacher_user_id
                 AND scoped_member.status = 'active'
                 AND scoped_member.role IN ('teacher', 'assistant')
             )
             AND assignment.effective_from <= NOW()
            AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
            AND teaching_group.status = 'active'
            AND teaching_group.campus_id = campus.id
        )`;
      const baseParams: unknown[] = organizationScope ? [access.id] : [access.id, actor.userId];
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count FROM teaching_campuses campus
           WHERE campus.organization_id = ? ${scopeSql}`,
          baseParams,
        ),
        query<Record<string, unknown>>(
          `SELECT campus.id, campus.code, campus.name, campus.timezone, campus.status,
                  campus.archived_at, campus.created_at, campus.updated_at
           FROM teaching_campuses campus
           WHERE campus.organization_id = ? ${scopeSql}
           ORDER BY CASE campus.status WHEN 'active' THEN 0 ELSE 1 END, campus.name, campus.id
           LIMIT ? OFFSET ?`,
          [...baseParams, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(campusToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getCampus(actor, slug, campusId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'campus.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'campus:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const rows = await query<Record<string, unknown>>(
        `SELECT campus.id, campus.code, campus.name, campus.timezone, campus.status,
                campus.archived_at, campus.created_at, campus.updated_at
         FROM teaching_campuses campus
         WHERE campus.organization_id = ? AND campus.id = ?
           ${organizationScope ? '' : `AND campus.status = 'active' AND EXISTS (
             SELECT 1 FROM teacher_assignments assignment
             JOIN teaching_groups teaching_group
               ON teaching_group.organization_id = assignment.organization_id
              AND teaching_group.id = assignment.group_id
             WHERE assignment.organization_id = campus.organization_id
               AND assignment.teacher_user_id = ?
               AND EXISTS (
                 SELECT 1 FROM organization_members scoped_member
                 WHERE scoped_member.organization_id = assignment.organization_id
                   AND scoped_member.user_id = assignment.teacher_user_id
                   AND scoped_member.status = 'active'
                   AND scoped_member.role IN ('teacher', 'assistant')
               )
               AND assignment.effective_from <= NOW()
               AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
               AND teaching_group.status = 'active'
               AND teaching_group.campus_id = campus.id
           )`}`,
        organizationScope ? [access.id, campusId] : [access.id, campusId, actor.userId],
      );
      if (!rows.length) {
        const exists = await query<Record<string, unknown>>(
          'SELECT 1 FROM teaching_campuses WHERE organization_id = ? AND id = ?', [access.id, campusId],
        );
        if (exists.length && !organizationScope) throw new ConcealedTeachingPermissionDeniedException('Campus not found');
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Campus not found');
      }
      return campusToJson(rows[0]);
    });
  },

  async createCampus(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'campus.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'campus.create', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'campus:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'campus.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            INSERT INTO teaching_campuses (organization_id, code, name, timezone, created_by_user_id)
            VALUES (${access.id}, ${input.code}, ${input.name}, ${input.timezone}, ${actor.userId})
            RETURNING id, code, name, timezone, status, archived_at, created_at, updated_at`;
          const campus = campusToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'campus.create', 'campus', ${String(rows[0].id)}, ${requestId}, ${sql.json({ code: input.code })}
            )`;
          const result: MutationResult = { status: 201, body: { campus } };
          await completeIdempotency(tx, idem.id, result, 'campus', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Campus code already exists or the campus is invalid');
      }
    });
  },

  async archiveCampus(actor, slug, campusId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'campus.archive', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'campus.archive', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'campus:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'campus.archive', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const existing = await tx`
            SELECT id, status FROM teaching_campuses
            WHERE organization_id = ${access.id} AND id = ${campusId}
            FOR UPDATE`;
          if (!existing.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Campus not found');
          if (existing[0].status !== 'active') throw new TeachingApiException('CONFLICT', 409, 'Campus is already archived');
          const rows = await tx`
            UPDATE teaching_campuses SET status = 'archived', archived_at = NOW()
            WHERE organization_id = ${access.id} AND id = ${campusId}
            RETURNING id, code, name, timezone, status, archived_at, created_at, updated_at`;
          const campus = campusToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'campus.archive', 'campus', ${campusId}, ${requestId}, ${sql.json({ reason: 'manual_archive' })}
            )`;
          const result: MutationResult = { status: 200, body: { campus } };
          await completeIdempotency(tx, idem.id, result, 'campus', campusId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Campus cannot be archived while it has active groups');
      }
    });
  },

  async listGroups(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'group:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const scopeSql = organizationScope ? '' : `
        AND teaching_group.status = 'active'
        AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
        AND EXISTS (
          SELECT 1 FROM teacher_assignments assignment
           WHERE assignment.organization_id = teaching_group.organization_id
             AND assignment.group_id = teaching_group.id
             AND assignment.teacher_user_id = ?
             AND EXISTS (
               SELECT 1 FROM organization_members scoped_member
               WHERE scoped_member.organization_id = assignment.organization_id
                 AND scoped_member.user_id = assignment.teacher_user_id
                 AND scoped_member.status = 'active'
                 AND scoped_member.role IN ('teacher', 'assistant')
             )
             AND assignment.effective_from <= NOW()
            AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
        )`;
      const baseParams: unknown[] = organizationScope ? [access.id] : [access.id, actor.userId];
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count FROM teaching_groups teaching_group
           LEFT JOIN teaching_campuses campus
             ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
           WHERE teaching_group.organization_id = ? ${scopeSql}`,
          baseParams,
        ),
        query<Record<string, unknown>>(
          `SELECT teaching_group.id, teaching_group.campus_id, teaching_group.code, teaching_group.name,
                  teaching_group.status, teaching_group.archived_at,
                  teaching_group.created_at, teaching_group.updated_at
           FROM teaching_groups teaching_group
           LEFT JOIN teaching_campuses campus
             ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
           WHERE teaching_group.organization_id = ? ${scopeSql}
           ORDER BY CASE teaching_group.status WHEN 'active' THEN 0 ELSE 1 END,
                    teaching_group.name, teaching_group.id
           LIMIT ? OFFSET ?`,
          [...baseParams, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(groupToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getGroup(actor, slug, groupId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'group:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const rows = await query<Record<string, unknown>>(
        `SELECT teaching_group.id, teaching_group.campus_id, teaching_group.code, teaching_group.name,
                teaching_group.status, teaching_group.archived_at,
                teaching_group.created_at, teaching_group.updated_at
         FROM teaching_groups teaching_group
         LEFT JOIN teaching_campuses campus
           ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
         WHERE teaching_group.organization_id = ? AND teaching_group.id = ?
           ${organizationScope ? '' : `AND teaching_group.status = 'active'
             AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
             AND EXISTS (
               SELECT 1 FROM teacher_assignments assignment
                WHERE assignment.organization_id = teaching_group.organization_id
                  AND assignment.group_id = teaching_group.id
                  AND assignment.teacher_user_id = ?
                  AND EXISTS (
                    SELECT 1 FROM organization_members scoped_member
                    WHERE scoped_member.organization_id = assignment.organization_id
                      AND scoped_member.user_id = assignment.teacher_user_id
                      AND scoped_member.status = 'active'
                      AND scoped_member.role IN ('teacher', 'assistant')
                  )
                  AND assignment.effective_from <= NOW()
                 AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
             )`}`,
        organizationScope ? [access.id, groupId] : [access.id, groupId, actor.userId],
      );
      if (!rows.length) {
        const exists = await query<Record<string, unknown>>(
          'SELECT 1 FROM teaching_groups WHERE organization_id = ? AND id = ?', [access.id, groupId],
        );
        if (exists.length && !organizationScope) throw new ConcealedTeachingPermissionDeniedException('Group not found');
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Group not found');
      }
      return groupToJson(rows[0]);
    });
  },

  async createGroup(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'group.create', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'group:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'group.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            INSERT INTO teaching_groups (organization_id, campus_id, code, name, created_by_user_id)
            VALUES (${access.id}, ${input.campusId}, ${input.code}, ${input.name}, ${actor.userId})
            RETURNING id, campus_id, code, name, status, archived_at, created_at, updated_at`;
          const group = groupToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'group.create', 'group', ${String(rows[0].id)}, ${requestId}, ${sql.json({ campusId: input.campusId, code: input.code })}
            )`;
          const result: MutationResult = { status: 201, body: { group } };
          await completeIdempotency(tx, idem.id, result, 'group', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Group code already exists or its campus is unavailable');
      }
    });
  },

  async archiveGroup(actor, slug, groupId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.archive', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'group.archive', 120, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'group:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'group.archive', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const existing = await tx`
            SELECT id, status FROM teaching_groups
            WHERE organization_id = ${access.id} AND id = ${groupId}
            FOR UPDATE`;
          if (!existing.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Group not found');
          if (existing[0].status !== 'active') throw new TeachingApiException('CONFLICT', 409, 'Group is already archived');
          const rows = await tx`
            UPDATE teaching_groups SET status = 'archived', archived_at = NOW()
            WHERE organization_id = ${access.id} AND id = ${groupId}
            RETURNING id, campus_id, code, name, status, archived_at, created_at, updated_at`;
          const group = groupToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'group.archive', 'group', ${groupId}, ${requestId}, ${sql.json({ reason: 'manual_archive' })}
            )`;
          const result: MutationResult = { status: 200, body: { group } };
          await completeIdempotency(tx, idem.id, result, 'group', groupId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Group cannot be archived');
      }
    });
  },

  async listGroupStudents(actor, slug, groupId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.student.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'group:read');
      requirePermission(access, 'student:read');
      const organizationScope = hasOrganizationCrmScope(access.role);
      const groupRows = await query<Record<string, unknown>>(
        `SELECT teaching_group.id
         FROM teaching_groups teaching_group
         LEFT JOIN teaching_campuses campus
           ON campus.organization_id = teaching_group.organization_id AND campus.id = teaching_group.campus_id
         WHERE teaching_group.organization_id = ? AND teaching_group.id = ?
           ${organizationScope ? '' : `AND teaching_group.status = 'active'
             AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
             AND EXISTS (
               SELECT 1 FROM teacher_assignments assignment
                WHERE assignment.organization_id = teaching_group.organization_id
                  AND assignment.group_id = teaching_group.id
                  AND assignment.teacher_user_id = ?
                  AND EXISTS (
                    SELECT 1 FROM organization_members scoped_member
                    WHERE scoped_member.organization_id = assignment.organization_id
                      AND scoped_member.user_id = assignment.teacher_user_id
                      AND scoped_member.status = 'active'
                      AND scoped_member.role IN ('teacher', 'assistant')
                  )
                  AND assignment.effective_from <= NOW()
                 AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
             )`}`,
        organizationScope ? [access.id, groupId] : [access.id, groupId, actor.userId],
      );
      if (!groupRows.length) {
        const exists = await query<Record<string, unknown>>(
          'SELECT 1 FROM teaching_groups WHERE organization_id = ? AND id = ?', [access.id, groupId],
        );
        if (exists.length && !organizationScope) throw new ConcealedTeachingPermissionDeniedException('Group not found');
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Group not found');
      }
      const activeOnly = organizationScope ? '' : `
        AND membership.effective_from <= NOW()
        AND (membership.effective_to IS NULL OR membership.effective_to > NOW())
        AND student.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM teacher_assignments assignment
          JOIN organization_members scoped_member
            ON scoped_member.organization_id = assignment.organization_id
           AND scoped_member.user_id = assignment.teacher_user_id
          WHERE assignment.organization_id = membership.organization_id
            AND assignment.group_id = membership.group_id
            AND assignment.teacher_user_id = ?
            AND assignment.effective_from <= NOW()
            AND (assignment.effective_to IS NULL OR assignment.effective_to > NOW())
            AND scoped_member.status = 'active'
            AND scoped_member.role IN ('teacher', 'assistant')
        )`;
      const relationParams: unknown[] = organizationScope
        ? [access.id, groupId]
        : [access.id, groupId, actor.userId];
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count
           FROM student_group_memberships membership
           JOIN student_profiles student
             ON student.organization_id = membership.organization_id AND student.id = membership.student_id
           WHERE membership.organization_id = ? AND membership.group_id = ? ${activeOnly}`,
          relationParams,
        ),
        query<Record<string, unknown>>(
          `SELECT membership.id, membership.group_id, membership.effective_from, membership.effective_to,
                  membership.created_at, student.id AS student_id,
                  student.display_name AS student_display_name,
                  student.external_ref AS student_external_ref, student.status AS student_status
           FROM student_group_memberships membership
           JOIN student_profiles student
             ON student.organization_id = membership.organization_id AND student.id = membership.student_id
           WHERE membership.organization_id = ? AND membership.group_id = ? ${activeOnly}
           ORDER BY membership.effective_from DESC, membership.id
           LIMIT ? OFFSET ?`,
          [...relationParams, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(membershipToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createStudentGroupMembership(actor, slug, groupId, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.student.assign', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'group.student.assign', 180, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'group:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'group.student.assign', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            WITH inserted AS (
              INSERT INTO student_group_memberships (
                organization_id, group_id, student_id, effective_from, effective_to, created_by_user_id
              ) VALUES (
                ${access.id}, ${groupId}, ${input.studentId}, ${input.effectiveFrom}, ${input.effectiveTo}, ${actor.userId}
              )
              RETURNING id, organization_id, group_id, student_id, effective_from, effective_to, created_at
            )
            SELECT inserted.*, student.display_name AS student_display_name,
                   student.external_ref AS student_external_ref, student.status AS student_status
            FROM inserted
            JOIN student_profiles student
              ON student.organization_id = inserted.organization_id AND student.id = inserted.student_id`;
          const membership = membershipToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'group.student.assign', 'student_group_membership', ${String(rows[0].id)}, ${requestId},
              ${sql.json({ groupId, studentId: input.studentId, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo })}
            )`;
          const result: MutationResult = { status: 201, body: { membership } };
          await completeIdempotency(tx, idem.id, result, 'student_group_membership', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Student membership overlaps or targets an unavailable resource');
      }
    });
  },

  async revokeStudentGroupMembership(actor, slug, membershipId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'group.student.revoke', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'group.student.revoke', 180, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'group:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'group.student.revoke', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const existing = await tx`
            SELECT id, effective_from, effective_to
            FROM student_group_memberships
            WHERE organization_id = ${access.id} AND id = ${membershipId}
            FOR UPDATE`;
          if (!existing.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Membership not found');
          if (existing[0].effective_to != null && new Date(String(existing[0].effective_to)).getTime() <= Date.now()) {
            throw new TeachingApiException('CONFLICT', 409, 'Membership has already ended');
          }
          const rows = await tx`
            WITH ended AS (
              UPDATE student_group_memberships
              SET effective_to = LEAST(
                COALESCE(effective_to, GREATEST(NOW(), effective_from)),
                GREATEST(NOW(), effective_from)
              )
              WHERE organization_id = ${access.id} AND id = ${membershipId}
              RETURNING *, clock_timestamp() AS cancelled_at
            )
            SELECT ended.*, student.display_name AS student_display_name,
                   student.external_ref AS student_external_ref, student.status AS student_status
            FROM ended
            JOIN student_profiles student
              ON student.organization_id = ended.organization_id AND student.id = ended.student_id`;
          const membership = membershipToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'group.student.revoke', 'student_group_membership', ${membershipId}, ${requestId},
              ${sql.json({ reason: 'manual_revocation', cancelledAt: iso(rows[0].cancelled_at), effectiveTo: membership.effectiveTo })}
            )`;
          const result: MutationResult = { status: 200, body: { membership } };
          await completeIdempotency(tx, idem.id, result, 'student_group_membership', membershipId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Membership could not be ended');
      }
    });
  },

  async listTeacherAssignments(actor, slug, target, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'teacher_assignment.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'assignment:manage');
      const targetSql = target.groupId !== null ? 'assignment.group_id = ?' : 'assignment.student_id = ?';
      const targetId = (target.groupId ?? target.studentId) as string;
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          `SELECT COUNT(*)::int AS count FROM teacher_assignments assignment
           WHERE assignment.organization_id = ? AND ${targetSql}`,
          [access.id, targetId],
        ),
        query<Record<string, unknown>>(
          `SELECT assignment.id, assignment.teacher_user_id, assignment.teacher_user_id_snapshot,
                  assignment.teacher_display_name_snapshot, assignment.teacher_role_snapshot,
                  assignment.group_id, assignment.student_id, assignment.effective_from,
                  assignment.effective_to, assignment.created_at,
                  member.status AS teacher_member_status
           FROM teacher_assignments assignment
           LEFT JOIN organization_members member
             ON member.organization_id = assignment.organization_id
            AND member.user_id = assignment.teacher_user_id
           WHERE assignment.organization_id = ? AND ${targetSql}
           ORDER BY assignment.effective_from DESC, assignment.id
           LIMIT ? OFFSET ?`,
          [access.id, targetId, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(assignmentToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async createTeacherAssignment(actor, slug, input, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'teacher_assignment.create', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'teacher_assignment.create', 180, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'assignment:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'teacher_assignment.create', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            WITH inserted AS (
              INSERT INTO teacher_assignments (
                organization_id, teacher_user_id, teacher_user_id_snapshot,
                teacher_display_name_snapshot, teacher_role_snapshot,
                group_id, student_id, effective_from, effective_to, created_by_user_id
              )
              SELECT ${access.id}, member.user_id, member.user_id, app_user.display_name, member.role,
                     ${input.groupId}, ${input.studentId}, ${input.effectiveFrom}, ${input.effectiveTo}, ${actor.userId}
              FROM organization_members member
              JOIN app_users app_user ON app_user.id = member.user_id
              WHERE member.organization_id = ${access.id}
                AND member.user_id = ${input.teacherUserId}
                AND member.status = 'active'
                AND member.role IN ('owner', 'admin', 'teacher', 'assistant')
              RETURNING *
            )
            SELECT inserted.*, member.status AS teacher_member_status
            FROM inserted
            LEFT JOIN organization_members member
              ON member.organization_id = inserted.organization_id
             AND member.user_id = inserted.teacher_user_id`;
          if (!rows.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Teacher must be an active teaching member');
          }
          const assignment = assignmentToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'teacher_assignment.create', 'teacher_assignment', ${String(rows[0].id)}, ${requestId},
              ${sql.json({ teacherUserId: input.teacherUserId, groupId: input.groupId, studentId: input.studentId, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo })}
            )`;
          const result: MutationResult = { status: 201, body: { assignment } };
          await completeIdempotency(tx, idem.id, result, 'teacher_assignment', String(rows[0].id));
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Teacher assignment overlaps or targets an unavailable resource');
      }
    });
  },

  async revokeTeacherAssignment(actor, slug, assignmentId, idempotencyKey, requestHash, requestId) {
    return withDeniedAccessAudit(actor, slug, 'teacher_assignment.revoke', requestId, async () => {
      await consumeMutationAttempt(actor.userId, 'teacher_assignment.revoke', 180, '1 minute');
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'assignment:manage');
          const idem = await beginIdempotency(tx, actor.userId, access.id, 'teacher_assignment.revoke', idempotencyKey, requestHash);
          if ('replay' in idem) return idem.replay;
          const existing = await tx`
            SELECT id, effective_from, effective_to
            FROM teacher_assignments
            WHERE organization_id = ${access.id} AND id = ${assignmentId}
            FOR UPDATE`;
          if (!existing.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Assignment not found');
          if (existing[0].effective_to != null && new Date(String(existing[0].effective_to)).getTime() <= Date.now()) {
            throw new TeachingApiException('CONFLICT', 409, 'Assignment has already ended');
          }
          const rows = await tx`
            WITH ended AS (
              UPDATE teacher_assignments
              SET effective_to = LEAST(
                COALESCE(effective_to, GREATEST(NOW(), effective_from)),
                GREATEST(NOW(), effective_from)
              )
              WHERE organization_id = ${access.id} AND id = ${assignmentId}
              RETURNING *, clock_timestamp() AS cancelled_at
            )
            SELECT ended.*, member.status AS teacher_member_status
            FROM ended
            LEFT JOIN organization_members member
              ON member.organization_id = ended.organization_id
             AND member.user_id = ended.teacher_user_id`;
          const assignment = assignmentToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'teacher_assignment.revoke', 'teacher_assignment', ${assignmentId}, ${requestId},
              ${sql.json({ reason: 'manual_revocation', cancelledAt: iso(rows[0].cancelled_at), effectiveTo: assignment.effectiveTo })}
            )`;
          const result: MutationResult = { status: 200, body: { assignment } };
          await completeIdempotency(tx, idem.id, result, 'teacher_assignment', assignmentId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Teacher assignment could not be ended');
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

  async createStudentAccountBindingInvite(actor, slug, studentId, input, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.account-binding.invite.create', requestId, async () => {
      const initialAccess = await accessForRead(actor.userId, slug);
      requireWritable(initialAccess);
      requirePermission(initialAccess, 'student:manage');
      await consumeMutationAttempt(
        actor.userId,
        `student-binding-invite:${initialAccess.id}`,
        30,
        '1 hour',
      );
      const token = randomBytes(32).toString('base64url');
      const tokenHash = sha256(token);
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'student:manage');
          const students = await tx`
            SELECT id, status, account_user_id
            FROM student_profiles
            WHERE organization_id = ${access.id} AND id = ${studentId}
            FOR UPDATE`;
          if (!students.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
          }
          const student = students[0] as Record<string, unknown>;
          if (student.status !== 'active') {
            throw new TeachingApiException('CONFLICT', 409, 'Only an active student can be linked');
          }
          if (student.account_user_id != null) {
            throw new TeachingApiException('CONFLICT', 409, 'Student already has a linked account');
          }
          await tx`
            UPDATE student_account_binding_invites
            SET expired_at = GREATEST(expires_at, clock_timestamp())
            WHERE organization_id = ${access.id}
              AND student_id = ${studentId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
              AND expires_at <= clock_timestamp()`;
          await tx`
            UPDATE student_account_binding_invites
            SET revoked_at = GREATEST(created_at, clock_timestamp()),
                revoked_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id}
              AND student_id = ${studentId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL`;
          const rows = await tx`
            INSERT INTO student_account_binding_invites (
              organization_id, student_id, token_hash, expires_at, created_by_user_id
            ) VALUES (
              ${access.id}, ${studentId}, ${tokenHash},
              clock_timestamp() + make_interval(mins => ${input.expiresInMinutes}),
              ${actor.userId}
            )
            RETURNING *, clock_timestamp() AS database_now`;
          const invite = bindingInviteToJson(rows[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student.account-binding.invite.create', 'student_account_binding_invite',
              ${String(rows[0].id)}, ${requestId},
              ${sql.json({ studentId, expiresAt: invite.expiresAt })}
            )`;
          return { status: 201, body: { invite, token } } satisfies MutationResult;
        }) as MutationResult;
      } catch (error) {
        uniqueConflict(error, 'A student account binding invite could not be issued concurrently');
      }
    });
  },

  async getCurrentStudentAccountBindingInvite(actor, slug, studentId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'student.account-binding.invite.read', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'student:manage');
      const students = await query<Record<string, unknown>>(
        `SELECT id FROM student_profiles WHERE organization_id = ? AND id = ?`,
        [access.id, studentId],
      );
      if (!students.length) {
        throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
      }
      const rows = await query<Record<string, unknown>>(
        `WITH database_clock AS MATERIALIZED (
           SELECT clock_timestamp() AS database_now
         )
         SELECT invite.*, database_clock.database_now
         FROM student_account_binding_invites invite
         CROSS JOIN database_clock
         WHERE invite.organization_id = ? AND invite.student_id = ?
           AND invite.expired_at IS NULL
           AND invite.consumed_at IS NULL
           AND invite.revoked_at IS NULL
           AND invite.expires_at > database_clock.database_now
         ORDER BY invite.created_at DESC, invite.id DESC
         LIMIT 1`,
        [access.id, studentId],
      );
      return { invite: rows.length ? bindingInviteToJson(rows[0]) : null };
    });
  },

  async revokeStudentAccountBindingInvite(
    actor,
    slug,
    studentId,
    inviteId,
    idempotencyKey,
    requestHash,
    requestId,
  ) {
    return withDeniedAccessAudit(actor, slug, 'student.account-binding.invite.revoke', requestId, async () => {
      const initialAccess = await accessForRead(actor.userId, slug);
      requireWritable(initialAccess);
      requirePermission(initialAccess, 'student:manage');
      await consumeMutationAttempt(
        actor.userId,
        `student-binding-invite-revoke:${initialAccess.id}`,
        60,
        '1 minute',
      );
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'student:manage');
          const students = await tx`
            SELECT id FROM student_profiles
            WHERE organization_id = ${access.id} AND id = ${studentId}
            FOR UPDATE`;
          if (!students.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student not found');
          }
          const rows = await tx`
            SELECT invite.*, clock_timestamp() AS database_now
            FROM student_account_binding_invites invite
            WHERE invite.organization_id = ${access.id}
              AND invite.student_id = ${studentId}
              AND invite.id = ${inviteId}
            FOR UPDATE`;
          if (!rows.length) {
            throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student account binding invite not found');
          }
          const idem = await beginIdempotency(
            tx,
            actor.userId,
            access.id,
            `student.account-binding.invite.revoke:${inviteId}`,
            idempotencyKey,
            requestHash,
          );
          if ('replay' in idem) return idem.replay;
          const existing = rows[0] as Record<string, unknown>;
          if (
            existing.expired_at != null
            || existing.consumed_at != null
            || existing.revoked_at != null
            || new Date(String(existing.expires_at)).getTime()
              <= new Date(String(existing.database_now)).getTime()
          ) {
            throw new TeachingApiException('CONFLICT', 409, 'Only a current pending invite can be revoked');
          }
          const revoked = await tx`
            UPDATE student_account_binding_invites
            SET revoked_at = GREATEST(created_at, clock_timestamp()),
                revoked_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id}
              AND student_id = ${studentId}
              AND id = ${inviteId}
              AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
              AND expires_at > clock_timestamp()
            RETURNING *, clock_timestamp() AS database_now`;
          if (!revoked.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Student account binding invite changed concurrently');
          }
          const invite = bindingInviteToJson(revoked[0] as Record<string, unknown>);
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${access.id}, ${actor.userId}, ${access.role}, ${actor.displayName},
              'student.account-binding.invite.revoke', 'student_account_binding_invite',
              ${inviteId}, ${requestId}, ${sql.json({ studentId, reason: 'manual_revoke' })}
            )`;
          const result: MutationResult = { status: 200, body: { invite } };
          await completeIdempotency(
            tx,
            idem.id,
            result,
            'student_account_binding_invite',
            inviteId,
          );
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Student account binding invite could not be revoked');
      }
    });
  },

  async previewStudentAccountBindingInvite(actor, input, requestId) {
    await consumeMutationAttempt(actor.userId, 'student-binding-preview', 120, '1 hour');
    const rows = await query<Record<string, unknown>>(
      `SELECT invite.id, invite.organization_id, invite.student_id,
              invite.expires_at, invite.expired_at, invite.consumed_at, invite.revoked_at,
              organization.name AS organization_name, organization.status AS organization_status,
              student.display_name AS student_display_name, student.status AS student_status,
              student.account_user_id, clock_timestamp() AS database_now
       FROM student_account_binding_invites invite
       JOIN organizations organization ON organization.id = invite.organization_id
       JOIN student_profiles student
         ON student.organization_id = invite.organization_id AND student.id = invite.student_id
       WHERE invite.token_hash = ?`,
      [input.tokenHash],
    );
    if (rows.length) {
      const row = rows[0];
      await consumeMutationAttempt(
        actor.userId,
        `student-binding-preview:${String(row.organization_id)}`,
        30,
        '1 hour',
      );
      const available = row.expired_at == null
        && row.consumed_at == null
        && row.revoked_at == null
        && new Date(String(row.expires_at)).getTime() > new Date(String(row.database_now)).getTime()
        && row.organization_status === 'active'
        && row.student_status === 'active'
        && row.account_user_id == null;
      if (available) {
        return {
          organizationName: String(row.organization_name),
          studentDisplayName: String(row.student_display_name),
          expiresAt: iso(row.expires_at),
        };
      }
    }
    throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student account binding invite not found');
  },

  async consumeStudentAccountBindingInvite(actor, input, requestId) {
    await consumeMutationAttempt(actor.userId, 'student-binding-consume', 60, '1 hour');
    const rateScopes = await query<Record<string, unknown>>(
      `SELECT organization_id FROM student_account_binding_invites WHERE token_hash = ?`,
      [input.tokenHash],
    );
    if (rateScopes.length) {
      await consumeMutationAttempt(
        actor.userId,
        `student-binding-consume:${String(rateScopes[0].organization_id)}`,
        20,
        '1 hour',
      );
    }
    type ConsumeOutcome = MutationResult | { unavailable: true };
    let outcome: ConsumeOutcome;
    try {
      outcome = await withRepeatableReadRetry<ConsumeOutcome>(async (tx) => {
        const actors = await tx`
          SELECT id FROM app_users WHERE id = ${actor.userId} FOR KEY SHARE`;
        if (!actors.length) {
          throw new TeachingApiException('UNAUTHENTICATED', 401, 'Authentication required');
        }
        const inviteIdentity = await tx`
          SELECT organization_id, student_id
          FROM student_account_binding_invites
          WHERE token_hash = ${input.tokenHash}`;
        if (!inviteIdentity.length) return { unavailable: true };
        const organizationId = String(inviteIdentity[0].organization_id);
        const studentId = String(inviteIdentity[0].student_id);
        const students = await tx`
          SELECT student.id, student.display_name, student.status,
                 student.account_user_id, student.account_linked_at,
                 organization.name AS organization_name, organization.status AS organization_status
          FROM student_profiles student
          JOIN organizations organization ON organization.id = student.organization_id
          WHERE student.organization_id = ${organizationId} AND student.id = ${studentId}
          FOR UPDATE OF student`;
        if (!students.length) return { unavailable: true };
        const student = students[0] as Record<string, unknown>;
        const invites = await tx`
          WITH database_clock AS MATERIALIZED (
            SELECT clock_timestamp() AS database_now
          )
          SELECT invite.*, database_clock.database_now
          FROM student_account_binding_invites invite
          CROSS JOIN database_clock
          WHERE invite.token_hash = ${input.tokenHash}
            AND invite.organization_id = ${organizationId}
            AND invite.student_id = ${studentId}
          FOR UPDATE OF invite`;
        if (!invites.length) return { unavailable: true };
        let invite = invites[0] as Record<string, unknown>;

        const consumedBySameActor = invite.consumed_at != null
          && Number(invite.consumed_by_user_id_snapshot) === actor.userId
          && Number(student.account_user_id) === actor.userId;
        if (consumedBySameActor) {
          return {
            status: 200,
            body: {
              invite: {
                id: String(invite.id), status: 'consumed', expiresAt: iso(invite.expires_at),
                consumedAt: iso(invite.consumed_at), createdAt: iso(invite.created_at),
              },
              student: {
                id: studentId, organizationName: String(student.organization_name),
                displayName: String(student.display_name), accountLinkedAt: iso(student.account_linked_at),
              },
            },
          };
        }

        const operationInstant = iso(invite.database_now);
        const databaseNow = new Date(operationInstant).getTime();
        const linkedToAnotherAccount = student.account_user_id != null
          && Number(student.account_user_id) !== actor.userId;
        if (
          invite.expired_at != null || invite.revoked_at != null || invite.consumed_at != null
          || new Date(String(invite.expires_at)).getTime() <= databaseNow
          || linkedToAnotherAccount
          || student.organization_status !== 'active' || student.status !== 'active'
        ) {
          if (
            invite.expired_at == null && invite.revoked_at == null && invite.consumed_at == null
            && new Date(String(invite.expires_at)).getTime() <= databaseNow
          ) {
            const expired = await tx`
              UPDATE student_account_binding_invites
              SET expired_at = GREATEST(expires_at, ${operationInstant})
              WHERE id = ${String(invite.id)}
              RETURNING *`;
            invite = expired[0] as Record<string, unknown>;
          }
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, outcome, request_id, metadata
            ) VALUES (
              ${organizationId}, ${actor.userId},
              (SELECT role FROM organization_members
               WHERE organization_id = ${organizationId} AND user_id = ${actor.userId}),
              ${actor.displayName}, 'student.account-binding.consume',
              'student_account_binding_invite', ${String(invite.id)}, 'denied', ${requestId},
              ${sql.json({ reason: linkedToAnotherAccount ? 'STUDENT_ALREADY_LINKED' : 'INVITE_UNAVAILABLE' })}
            )`;
          return { unavailable: true };
        }
        if (student.account_user_id == null) {
          const linked = await tx`
            UPDATE student_profiles
            SET account_user_id = ${actor.userId}, account_linked_at = ${operationInstant}
            WHERE organization_id = ${organizationId} AND id = ${studentId}
              AND account_user_id IS NULL
            RETURNING account_linked_at`;
          if (!linked.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Student account binding changed concurrently');
          }
          student.account_linked_at = linked[0].account_linked_at;
        }
        const consumed = await tx`
          UPDATE student_account_binding_invites
          SET consumed_at = ${operationInstant},
              consumed_by_user_id = ${actor.userId},
              consumed_by_user_id_snapshot = ${actor.userId}
          WHERE id = ${String(invite.id)}
            AND expired_at IS NULL AND consumed_at IS NULL AND revoked_at IS NULL
            AND expires_at > ${operationInstant}
          RETURNING *`;
        if (!consumed.length) {
          throw new TeachingApiException(
            'RESOURCE_NOT_FOUND',
            404,
            'Student account binding invite not found',
          );
        }
        invite = consumed[0] as Record<string, unknown>;
        await tx`
          INSERT INTO teaching_audit_events (
            organization_id, actor_user_id, actor_role, actor_display_name,
            action, entity_type, entity_id, request_id, metadata
          ) VALUES (
            ${organizationId}, ${actor.userId},
            (SELECT role FROM organization_members
             WHERE organization_id = ${organizationId} AND user_id = ${actor.userId}),
            ${actor.displayName}, 'student.account-binding.consume',
            'student_account_binding_invite', ${String(invite.id)}, ${requestId},
            ${sql.json({ studentId })}
          )`;
        return {
          status: 200,
          body: {
            invite: {
              id: String(invite.id), status: 'consumed', expiresAt: iso(invite.expires_at),
              consumedAt: iso(invite.consumed_at), createdAt: iso(invite.created_at),
            },
            student: {
              id: studentId, organizationName: String(student.organization_name),
              displayName: String(student.display_name), accountLinkedAt: iso(student.account_linked_at),
            },
          },
        };
      });
    } catch (error) {
      if (error instanceof TeachingApiException) throw error;
      const code = (error as { code?: string }).code;
      if (code === '23514' || code === '55000') {
        throw new TeachingApiException(
          'RESOURCE_NOT_FOUND',
          404,
          'Student account binding invite not found',
        );
      }
      uniqueConflict(error, 'This account is already linked to another student in the organization');
    }
    if ('unavailable' in outcome) {
      throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student account binding invite not found');
    }
    return outcome;
  },

  async listSelfTrainingAssignments(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.self.list', requestId, async () => {
      const page = await sql.begin(async (tx) => {
        const student = await boundSelfStudentForUpdate(tx, actor.userId, slug);
        const totals = await tx`
          SELECT COUNT(*)::int AS total
          FROM training_assignment_targets target
          JOIN training_assignments assignment
            ON assignment.organization_id = target.organization_id
           AND assignment.id = target.assignment_id
          WHERE target.organization_id = ${student.organizationId}
            AND target.student_id = ${student.studentId}
            AND target.target_kind = 'student'
            AND assignment.status IN ('published', 'closed')`;
        const rows = await tx`
          SELECT assignment.id AS assignment_id, assignment.organization_id,
                 assignment.template_version_id, assignment.title AS assignment_title,
                 assignment.instructions AS assignment_instructions,
                 assignment.status AS assignment_status, assignment.schedule_kind,
                 assignment.expected_count, assignment.timezone_snapshot,
                 assignment.starts_at, assignment.ends_at, assignment.published_at,
                 assignment.closed_at, assignment.created_at AS assignment_created_at,
                 assignment.updated_at AS assignment_updated_at,
                 target.id AS target_id, target.source_group_id, target.student_id,
                 target.student_display_name_snapshot, target.student_external_ref_snapshot,
                 target.evidence_count, target.first_evidence_at, target.last_evidence_at,
                 target.latest_review_revision, target.latest_review_status,
                 template.id AS template_id, template.name AS template_name,
                 version.version_number, version.title AS version_title,
                 version.instructions AS version_instructions, version.source, version.activity,
                 version.tool_config, version.published_at AS version_published_at,
                 COALESCE((
                   SELECT JSONB_AGG(JSONB_BUILD_OBJECT(
                     'id', goal.id,
                     'metricKey', goal.metric_key,
                     'operator', goal.operator,
                     'targetValue', goal.target_value
                   ) ORDER BY goal.metric_key)
                   FROM training_assignment_goal_metrics goal
                   WHERE goal.organization_id = assignment.organization_id
                     AND goal.assignment_id = assignment.id
                 ), '[]'::jsonb) AS goals
          FROM training_assignment_targets target
          JOIN training_assignments assignment
            ON assignment.organization_id = target.organization_id
           AND assignment.id = target.assignment_id
          JOIN training_template_versions version
            ON version.organization_id = assignment.organization_id
           AND version.id = assignment.template_version_id
          JOIN training_templates template
            ON template.organization_id = version.organization_id
           AND template.id = version.template_id
          WHERE target.organization_id = ${student.organizationId}
            AND target.student_id = ${student.studentId}
            AND target.target_kind = 'student'
            AND assignment.status IN ('published', 'closed')
          ORDER BY assignment.starts_at DESC, assignment.id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map((row) => selfTrainingAssignmentToJson(row as Record<string, unknown>)),
          total: Number(totals[0]?.total ?? 0),
          page: pagination.page,
          pageSize: pagination.pageSize,
        };
      });
      return page as PageResult;
    });
  },

  async createSelfTrainingEvidence(actor, slug, input, requestId) {
    const organizations = await query<Record<string, unknown>>(
      `SELECT id FROM organizations WHERE slug = ?`,
      [slug],
    );
    if (organizations.length) {
      await consumeMutationAttempt(
        actor.userId,
        `training-evidence:${String(organizations[0].id)}`,
        240,
        '1 minute',
      );
    }
    return withDeniedAccessAudit(actor, slug, 'training.evidence.self.create', requestId, async () => {
      const canonicalPayload = canonicalTrainingEvidencePayload(input);
      const payloadHash = sha256(stableJson(canonicalPayload));
      const assignmentIds = input.assignmentIds ?? [];
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const student = await boundSelfStudentForUpdate(tx, actor.userId, slug);
          const occurredAtMs = new Date(input.occurredAt).getTime();
          const databaseNowMs = new Date(student.databaseNow).getTime();
          if (occurredAtMs > databaseNowMs + TRAINING_EVIDENCE_FUTURE_TOLERANCE_MS) {
            throw new TeachingApiException(
              'EVIDENCE_INVALID',
              400,
              'occurredAt cannot be more than five minutes after the database clock',
            );
          }
          const backfillFloor = Math.max(
            new Date(student.accountLinkedAt).getTime(),
            databaseNowMs - SELF_TRAINING_EVIDENCE_BACKFILL_MS,
          );
          if (occurredAtMs < backfillFloor) {
            throw new TeachingApiException(
              'EVIDENCE_INVALID',
              400,
              'occurredAt must follow account linking and stay within the 30-day self-report window',
            );
          }
          const relationSubject = sha256(stableJson({
            kind: 'training-evidence-student-source',
            studentId: student.studentId,
            source: input.source,
          }));
          const relationTarget = sha256(stableJson({
            kind: 'training-evidence-source-event',
            sourceEventId: input.sourceEventId,
          }));
          await tx`
            INSERT INTO teaching_relation_locks (
              organization_id, relation_kind, subject_key, target_key
            ) VALUES (
              ${student.organizationId}, 'training_evidence', ${relationSubject}, ${relationTarget}
            )
            ON CONFLICT (organization_id, relation_kind, subject_key, target_key)
            DO UPDATE SET revision = teaching_relation_locks.revision + 1,
                          touched_at = clock_timestamp()`;
          const existing = await tx`
            SELECT * FROM training_evidence
            WHERE organization_id = ${student.organizationId}
              AND student_id = ${student.studentId}
              AND source = ${input.source}
              AND source_event_id = ${input.sourceEventId}
            FOR UPDATE`;
          if (existing.length) {
            const row = existing[0] as Record<string, unknown>;
            if (String(row.payload_sha256) !== payloadHash) {
              throw new TeachingApiException(
                'CONFLICT',
                409,
                'sourceEventId is permanently bound to different evidence',
              );
            }
            const links = await tx`
              SELECT assignment_id
              FROM training_evidence_assignments
              WHERE organization_id = ${student.organizationId}
                AND evidence_id = ${String(row.id)}
              ORDER BY assignment_id`;
            return {
              status: 200,
              body: {
                evidence: selfTrainingEvidenceReceipt(row),
                assignmentIds: links.map((link) => String(link.assignment_id)),
                replayed: true,
              },
            };
          }
          for (const assignmentId of assignmentIds) {
            const targets = await tx`
              SELECT target.id
              FROM training_assignment_targets target
              JOIN training_assignments assignment
                ON assignment.organization_id = target.organization_id
               AND assignment.id = target.assignment_id
              JOIN training_template_versions version
                ON version.organization_id = assignment.organization_id
               AND version.id = assignment.template_version_id
              WHERE target.organization_id = ${student.organizationId}
                AND target.assignment_id = ${assignmentId}
                AND target.student_id = ${student.studentId}
                AND target.target_kind = 'student'
                AND assignment.status = 'published'
                AND version.source = ${input.source}
                AND version.activity = ${input.activity}
                AND assignment.starts_at <= ${input.occurredAt}
                AND (assignment.ends_at IS NULL OR assignment.ends_at > ${input.occurredAt})
              FOR UPDATE OF assignment, target`;
            if (!targets.length) {
              throw new ConcealedTeachingPermissionDeniedException('Training assignment not found');
            }
          }
          const resultMs = input.source === 'timer'
            ? (input.metrics.resultMs as number | null | undefined) ?? null
            : null;
          const inserted = await tx`
            INSERT INTO training_evidence (
              organization_id, student_id, source, source_event_id, payload_sha256,
              trust_level, occurred_at, timezone_snapshot, local_date, activity,
              duration_ms, result_ms, success, metrics, payload_version, payload,
              submitted_by_user_id
            ) VALUES (
              ${student.organizationId}, ${student.studentId}, ${input.source},
              ${input.sourceEventId}, ${payloadHash}, 'self_reported', ${input.occurredAt},
              ${student.organizationTimezone}, ${input.occurredAt.slice(0, 10)}, ${input.activity},
              ${input.durationMs ?? null}, ${resultMs}, ${Boolean(input.metrics.success)},
              ${sql.json(input.metrics as JsonObject)}, ${input.payloadVersion},
              ${sql.json((input.payload ?? {}) as JsonObject)}, ${actor.userId}
            )
            RETURNING *`;
          const row = inserted[0] as Record<string, unknown>;
          for (const assignmentId of assignmentIds) {
            await tx`
              INSERT INTO training_evidence_assignments (
                organization_id, evidence_id, assignment_id, student_id
              ) VALUES (
                ${student.organizationId}, ${String(row.id)}, ${assignmentId}, ${student.studentId}
              )`;
          }
          await tx`
            INSERT INTO teaching_audit_events (
              organization_id, actor_user_id, actor_role, actor_display_name,
              action, entity_type, entity_id, request_id, metadata
            ) VALUES (
              ${student.organizationId}, ${actor.userId},
              (SELECT role FROM organization_members
               WHERE organization_id = ${student.organizationId} AND user_id = ${actor.userId}),
              ${actor.displayName}, 'training.evidence.self.create', 'training_evidence',
              ${String(row.id)}, ${requestId},
              ${sql.json({ source: input.source, activity: input.activity, assignmentCount: assignmentIds.length })}
            )`;
          return {
            status: 201,
            body: {
              evidence: selfTrainingEvidenceReceipt(row),
              assignmentIds,
              replayed: false,
            },
          };
        });
      } catch (error) {
        crmConflict(error, 'Training evidence could not be saved because its student or assignment changed');
      }
    });
  },

  async listTrainingTemplates(actor, slug, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.template.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'training:template:read');
      const [countRows, rows] = await Promise.all([
        query<Record<string, unknown>>(
          'SELECT COUNT(*)::int AS count FROM training_templates WHERE organization_id = ?',
          [access.id],
        ),
        query<Record<string, unknown>>(
          `SELECT template.*,
                  (SELECT MAX(version_number) FROM training_template_versions version
                   WHERE version.organization_id = template.organization_id
                     AND version.template_id = template.id) AS latest_version_number
           FROM training_templates template
           WHERE template.organization_id = ?
           ORDER BY CASE template.status WHEN 'active' THEN 0 ELSE 1 END,
                    template.name, template.id
           LIMIT ? OFFSET ?`,
          [access.id, pagination.pageSize, pagination.offset],
        ),
      ]);
      return {
        items: rows.map(trainingTemplateToJson), total: Number(countRows[0]?.count ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getTrainingTemplate(actor, slug, templateId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.template.read', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:template:read');
        const rows = await tx`
          SELECT template.*,
                 (SELECT MAX(version_number) FROM training_template_versions version
                  WHERE version.organization_id = template.organization_id
                    AND version.template_id = template.id) AS latest_version_number
          FROM training_templates template
          WHERE template.organization_id = ${access.id} AND template.id = ${templateId}`;
        if (!rows.length) {
          await trainingResourceMissing(tx, 'training_templates', templateId, 'Training template not found');
        }
        return trainingTemplateToJson(rows[0] as Record<string, unknown>);
      }) as JsonObject;
    });
  },

  async createTrainingTemplate(actor, slug, input, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, 'training.template.create', 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.template.create', requestId, async () => {
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:template:manage');
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, 'training.template.create', idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          const rows = await tx`
            INSERT INTO training_templates (
              organization_id, name, description, created_by_user_id
            ) VALUES (${access.id}, ${input.name}, ${input.description}, ${actor.userId})
            RETURNING *`;
          const templateId = String(rows[0].id);
          const template = trainingTemplateToJson({ ...rows[0], latest_version_number: null });
          await insertTrainingAudit(
            tx, access, actor, 'training.template.create', 'training_template', templateId,
            requestId, { name: input.name },
          );
          const result: MutationResult = { status: 201, body: { template } };
          await completeIdempotency(tx, idem.id, result, 'training_template', templateId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training template could not be created');
      }
    });
  },

  async listTrainingTemplateVersions(actor, slug, templateId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.template.version.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:template:read');
        const templates = await tx`
          SELECT 1 FROM training_templates
          WHERE organization_id = ${access.id} AND id = ${templateId}`;
        if (!templates.length) {
          await trainingResourceMissing(tx, 'training_templates', templateId, 'Training template not found');
        }
        const totals = await tx`
          SELECT COUNT(*)::int AS total FROM training_template_versions
          WHERE organization_id = ${access.id} AND template_id = ${templateId}`;
        const rows = await tx`
          SELECT * FROM training_template_versions
          WHERE organization_id = ${access.id} AND template_id = ${templateId}
          ORDER BY version_number DESC, id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map(trainingTemplateVersionToJson), total: Number(totals[0]?.total ?? 0),
          page: pagination.page, pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async createTrainingTemplateVersion(
    actor, slug, templateId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `training.template.version.create:${templateId}`, 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.template.version.create', requestId, async () => {
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:template:manage');
          const templates = await tx`
            SELECT * FROM training_templates
            WHERE organization_id = ${access.id} AND id = ${templateId}
            FOR UPDATE`;
          if (!templates.length) {
            await trainingResourceMissing(tx, 'training_templates', templateId, 'Training template not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.template.version.create:${templateId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(templates[0].status) !== 'active') {
            throw new TeachingApiException('CONFLICT', 409, 'Archived training templates cannot receive versions');
          }
          const rows = await tx`
            INSERT INTO training_template_versions (
              organization_id, template_id, version_number, title, instructions,
              source, activity, tool_config, created_by_user_id, published_by_user_id
            ) SELECT ${access.id}, ${templateId},
                     COALESCE(MAX(version_number), 0) + 1,
                     ${input.title}, ${input.instructions}, ${input.source}, ${input.activity},
                     ${sql.json(input.toolConfig)}, ${actor.userId}, ${actor.userId}
              FROM training_template_versions
             WHERE organization_id = ${access.id} AND template_id = ${templateId}
            RETURNING *`;
          const versionId = String(rows[0].id);
          const templateVersion = trainingTemplateVersionToJson(rows[0] as Record<string, unknown>);
          await insertTrainingAudit(
            tx, access, actor, 'training.template.version.create', 'training_template_version',
            versionId, requestId, { templateId, versionNumber: Number(rows[0].version_number) },
          );
          const result: MutationResult = { status: 201, body: { templateVersion } };
          await completeIdempotency(tx, idem.id, result, 'training_template_version', versionId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training template version could not be created');
      }
    });
  },

  async archiveTrainingTemplate(actor, slug, templateId, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, `training.template.archive:${templateId}`, 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.template.archive', requestId, async () => {
      try {
        return await sql.begin(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:template:manage');
          const rows = await tx`
            SELECT * FROM training_templates
            WHERE organization_id = ${access.id} AND id = ${templateId}
            FOR UPDATE`;
          if (!rows.length) {
            await trainingResourceMissing(tx, 'training_templates', templateId, 'Training template not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.template.archive:${templateId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(rows[0].status) !== 'active') {
            throw new TeachingApiException('CONFLICT', 409, 'Training template is already archived');
          }
          const archived = await tx`
            UPDATE training_templates
            SET status = 'archived', archived_at = clock_timestamp()
            WHERE organization_id = ${access.id} AND id = ${templateId}
            RETURNING *`;
          const versionRows = await tx`
            SELECT MAX(version_number) AS latest_version_number
            FROM training_template_versions
            WHERE organization_id = ${access.id} AND template_id = ${templateId}`;
          const template = trainingTemplateToJson({
            ...archived[0], latest_version_number: versionRows[0]?.latest_version_number,
          });
          await insertTrainingAudit(
            tx, access, actor, 'training.template.archive', 'training_template', templateId,
            requestId, { reason: 'manual_archive' },
          );
          const result: MutationResult = { status: 200, body: { template } };
          await completeIdempotency(tx, idem.id, result, 'training_template', templateId);
          return result;
        }) as MutationResult;
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training template could not be archived');
      }
    });
  },

  async listTrainingAssignments(actor, slug, filter, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.list', requestId, async () => {
      const access = await accessForRead(actor.userId, slug);
      requirePermission(access, 'training:assignment:read');
      const statusSql = filter.status === null ? '' : ' AND assignment.status = ?';
      const statusParams = filter.status === null ? [] : [filter.status];
      const organizationScope = hasOrganizationTrainingScope(access.role);
      const scopeCte = organizationScope ? '' : `${ACTIVE_TRAINING_SCOPE_CTE},`;
      const scopeSql = organizationScope ? '' : ` AND EXISTS (
        SELECT 1 FROM training_assignment_targets visible_target
        WHERE visible_target.organization_id = assignment.organization_id
          AND visible_target.assignment_id = assignment.id
          AND (
            (visible_target.target_kind = 'group' AND visible_target.group_id IN (SELECT id FROM scoped_group_ids))
            OR (visible_target.target_kind = 'student' AND visible_target.student_id IN (SELECT id FROM scoped_student_ids))
          )
      )`;
      const scopeParams = organizationScope ? [] : activeTrainingScopeParams(access, actor);
      const countRows = await query<Record<string, unknown>>(
        `${scopeCte} SELECT COUNT(*)::int AS total
         FROM training_assignments assignment
         WHERE assignment.organization_id = ?${statusSql}${scopeSql}`,
        [...scopeParams, access.id, ...statusParams],
      );
      const rows = await query<Record<string, unknown>>(
        `${scopeCte} SELECT assignment.*
         FROM training_assignments assignment
         WHERE assignment.organization_id = ?${statusSql}${scopeSql}
         ORDER BY assignment.starts_at DESC, assignment.id DESC
         LIMIT ? OFFSET ?`,
        [...scopeParams, access.id, ...statusParams, pagination.pageSize, pagination.offset],
      );
      return {
        items: rows.map(trainingAssignmentToJson), total: Number(countRows[0]?.total ?? 0),
        page: pagination.page, pageSize: pagination.pageSize,
      };
    });
  },

  async getTrainingAssignment(actor, slug, assignmentId, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.read', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        const rows = await tx`
          SELECT * FROM training_assignments
          WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
        if (!rows.length) {
          await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
        }
        await assertTrainingAssignmentScope(
          tx, access, actor, rows[0] as Record<string, unknown>, 'read',
        );
        const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
        await assertTrainingAssignmentScope(
          tx, access, actor, rows[0] as Record<string, unknown>, 'read',
        );
        return body;
      }) as JsonObject;
    });
  },

  async createTrainingAssignment(actor, slug, input, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, 'training.assignment.create', 180, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.assignment.create', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:assignment:manage');
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, 'training.assignment.create', idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          await lockAndValidateTrainingSelectors(tx, access, actor, input);
          const rows = await tx`
            INSERT INTO training_assignments (
              organization_id, template_version_id, title, instructions, schedule_kind,
              expected_count, timezone_snapshot, starts_at, ends_at, created_by_user_id
            ) VALUES (
              ${access.id}, ${input.templateVersionId}, ${input.title}, ${input.instructions},
              ${input.scheduleKind}, ${input.expectedCount}, ${access.timezone},
              ${input.startsAt}, ${input.endsAt}, ${actor.userId}
            ) RETURNING *`;
          const assignmentId = String(rows[0].id);
          await replaceTrainingAssignmentDraft(tx, access, assignmentId, input);
          const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.create', 'training_assignment', assignmentId,
            requestId, { groupCount: input.groupIds.length, studentCount: input.studentIds.length, goalCount: input.goals.length },
          );
          const result: MutationResult = { status: 201, body };
          await completeIdempotency(tx, idem.id, result, 'training_assignment', assignmentId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training assignment could not be created');
      }
    });
  },

  async reviseTrainingAssignment(
    actor, slug, assignmentId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `training.assignment.revise:${assignmentId}`, 180, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.assignment.revise', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:assignment:manage');
          const rows = await tx`
            SELECT * FROM training_assignments
            WHERE organization_id = ${access.id} AND id = ${assignmentId}
            FOR UPDATE`;
          if (!rows.length) {
            await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
          }
          await assertTrainingAssignmentScope(
            tx, access, actor, rows[0] as Record<string, unknown>, 'manage',
          );
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.assignment.revise:${assignmentId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(rows[0].status) !== 'draft') {
            throw new TeachingApiException('CONFLICT', 409, 'Only draft training assignments can be revised');
          }
          await lockAndValidateTrainingSelectors(tx, access, actor, input);
          await tx`
            UPDATE training_assignments
            SET template_version_id = ${input.templateVersionId}, title = ${input.title},
                instructions = ${input.instructions}, schedule_kind = ${input.scheduleKind},
                expected_count = ${input.expectedCount}, starts_at = ${input.startsAt},
                ends_at = ${input.endsAt}
            WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
          await replaceTrainingAssignmentDraft(tx, access, assignmentId, input);
          const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.revise', 'training_assignment', assignmentId,
            requestId, { groupCount: input.groupIds.length, studentCount: input.studentIds.length, goalCount: input.goals.length },
          );
          const result: MutationResult = { status: 200, body };
          await completeIdempotency(tx, idem.id, result, 'training_assignment', assignmentId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training assignment could not be revised');
      }
    });
  },

  async publishTrainingAssignment(
    actor, slug, assignmentId, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(actor.userId, `training.assignment.publish:${assignmentId}`, 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.assignment.publish', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:assignment:manage');
          const assignments = await tx`
            SELECT assignment.*, version.source, version.activity
            FROM training_assignments assignment
            JOIN training_template_versions version
              ON version.organization_id = assignment.organization_id
             AND version.id = assignment.template_version_id
            WHERE assignment.organization_id = ${access.id} AND assignment.id = ${assignmentId}
            FOR UPDATE OF assignment`;
          if (!assignments.length) {
            await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
          }
          const assignment = assignments[0] as Record<string, unknown>;
          await assertTrainingAssignmentScope(tx, access, actor, assignment, 'manage');
          const selectorRows = await tx`
            SELECT target_kind, group_id, student_id
            FROM training_assignment_targets
            WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
              AND (target_kind = 'group' OR source_group_id IS NULL)
            ORDER BY target_kind, COALESCE(group_id, student_id)`;
          const groupIds = selectorRows
            .filter((row) => row.target_kind === 'group')
            .map((row) => String(row.group_id))
            .sort();
          const directStudentIds = selectorRows
            .filter((row) => row.target_kind === 'student')
            .map((row) => String(row.student_id))
            .sort();
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.assignment.publish:${assignmentId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(assignment.status) !== 'draft') {
            throw new TeachingApiException('CONFLICT', 409, 'Only draft training assignments can be published');
          }
          const instantRows = await tx`SELECT clock_timestamp() AS published_at`;
          const publishedAt = iso(instantRows[0].published_at);

          for (const groupId of groupIds) {
            await touchTrainingRelationLock(tx, access.id, 'student_group', '*', groupId);
          }
          const groupNames = new Map<string, string>();
          for (const groupId of groupIds) {
            const groups = await tx`
              SELECT teaching_group.id, teaching_group.name
              FROM teaching_groups teaching_group
              LEFT JOIN teaching_campuses campus
                ON campus.organization_id = teaching_group.organization_id
               AND campus.id = teaching_group.campus_id
              WHERE teaching_group.organization_id = ${access.id}
                AND teaching_group.id = ${groupId}
                AND teaching_group.status = 'active'
                AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
              FOR UPDATE OF teaching_group`;
            if (!groups.length) {
              throw new TeachingApiException('CONFLICT', 409, 'A selected training group is no longer active');
            }
            groupNames.set(groupId, String(groups[0].name));
          }

          const groupSourceByStudent = new Map<string, string>();
          for (const groupId of groupIds) {
            const memberships = await tx`
              SELECT membership.student_id
              FROM student_group_memberships membership
              JOIN student_profiles student
                ON student.organization_id = membership.organization_id
               AND student.id = membership.student_id
               AND student.status = 'active'
              WHERE membership.organization_id = ${access.id}
                AND membership.group_id = ${groupId}
                AND membership.effective_from <= ${publishedAt}
                AND (membership.effective_to IS NULL OR membership.effective_to > ${publishedAt})
              ORDER BY membership.student_id`;
            for (const membership of memberships) {
              const studentId = String(membership.student_id);
              const previous = groupSourceByStudent.get(studentId);
              if (previous === undefined || groupId < previous) groupSourceByStudent.set(studentId, groupId);
            }
          }
          const directStudents = new Set(directStudentIds);
          const allStudentIds = [...new Set([...directStudentIds, ...groupSourceByStudent.keys()])].sort();
          if (!allStudentIds.length) {
            throw new TeachingApiException('CONFLICT', 409, 'Published training assignments require at least one active student');
          }
          const studentSnapshots = new Map<string, { displayName: string; externalRef: string | null }>();
          for (const studentId of allStudentIds) {
            const students = await tx`
              SELECT id, display_name, external_ref
              FROM student_profiles
              WHERE organization_id = ${access.id} AND id = ${studentId} AND status = 'active'
              FOR UPDATE`;
            if (!students.length) {
              throw new TeachingApiException('CONFLICT', 409, 'A selected training student is no longer active');
            }
            studentSnapshots.set(studentId, {
              displayName: String(students[0].display_name),
              externalRef: students[0].external_ref == null ? null : String(students[0].external_ref),
            });
          }

          for (const [groupId, groupName] of groupNames) {
            await tx`
              UPDATE training_assignment_targets
              SET group_name_snapshot = ${groupName}
              WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
                AND target_kind = 'group' AND group_id = ${groupId}`;
          }
          for (const studentId of directStudentIds) {
            const snapshot = studentSnapshots.get(studentId)!;
            await tx`
              UPDATE training_assignment_targets
              SET student_display_name_snapshot = ${snapshot.displayName},
                  student_external_ref_snapshot = ${snapshot.externalRef}
              WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
                AND target_kind = 'student' AND student_id = ${studentId}
                AND source_group_id IS NULL`;
          }
          await tx`
            DELETE FROM training_assignment_targets
            WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
              AND target_kind = 'student' AND source_group_id IS NOT NULL`;
          for (const studentId of allStudentIds) {
            if (directStudents.has(studentId)) continue;
            const snapshot = studentSnapshots.get(studentId)!;
            const sourceGroupId = groupSourceByStudent.get(studentId)!;
            await tx`
              INSERT INTO training_assignment_targets (
                organization_id, assignment_id, target_kind, source_group_id, student_id,
                student_display_name_snapshot, student_external_ref_snapshot
              ) VALUES (
                ${access.id}, ${assignmentId}, 'student', ${sourceGroupId},
                ${studentId}, ${snapshot.displayName}, ${snapshot.externalRef}
              )`;
          }
          await tx`
            UPDATE training_assignments
            SET status = 'published', published_at = ${publishedAt}, published_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
          const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.publish', 'training_assignment', assignmentId,
            requestId, { groupCount: groupIds.length, directStudentCount: directStudentIds.length, studentCount: allStudentIds.length },
          );
          const result: MutationResult = { status: 200, body };
          await completeIdempotency(tx, idem.id, result, 'training_assignment', assignmentId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training assignment could not be published');
      }
    });
  },

  async closeTrainingAssignment(actor, slug, assignmentId, idempotencyKey, requestHash, requestId) {
    await consumeMutationAttempt(actor.userId, `training.assignment.close:${assignmentId}`, 120, '1 minute');
    return withDeniedAccessAudit(actor, slug, 'training.assignment.close', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:assignment:manage');
          const rows = await tx`
            SELECT * FROM training_assignments
            WHERE organization_id = ${access.id} AND id = ${assignmentId}
            FOR UPDATE`;
          if (!rows.length) {
            await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
          }
          await assertTrainingAssignmentScope(tx, access, actor, rows[0] as Record<string, unknown>, 'manage');
          const idem = await beginIdempotency(
            tx, actor.userId, access.id, `training.assignment.close:${assignmentId}`,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (String(rows[0].status) !== 'published') {
            throw new TeachingApiException('CONFLICT', 409, 'Only published training assignments can be closed');
          }
          await tx`
            UPDATE training_assignments
            SET status = 'closed', closed_at = clock_timestamp(), closed_by_user_id = ${actor.userId}
            WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
          const body = await trainingAssignmentEnvelope(tx, access.id, assignmentId);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.close', 'training_assignment', assignmentId,
            requestId, {},
          );
          const result: MutationResult = { status: 200, body };
          await completeIdempotency(tx, idem.id, result, 'training_assignment', assignmentId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training assignment could not be closed');
      }
    });
  },

  async listTrainingAssignmentTargets(actor, slug, assignmentId, filter, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.target.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        const assignments = await tx`
          SELECT * FROM training_assignments
          WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
        if (!assignments.length) {
          await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
        }
        await assertTrainingAssignmentScope(
          tx, access, actor, assignments[0] as Record<string, unknown>, 'read',
        );
        const kind = filter.targetKind;
        if (hasOrganizationTrainingScope(access.role)) {
          const totals = await tx`
            SELECT COUNT(*)::int AS total FROM training_assignment_targets target
            WHERE target.organization_id = ${access.id} AND target.assignment_id = ${assignmentId}
              AND (${kind}::text IS NULL OR target.target_kind = ${kind})`;
          const rows = await tx`
            SELECT * FROM training_assignment_targets target
            WHERE target.organization_id = ${access.id} AND target.assignment_id = ${assignmentId}
              AND (${kind}::text IS NULL OR target.target_kind = ${kind})
            ORDER BY target.target_kind, COALESCE(target.group_name_snapshot, target.student_display_name_snapshot), target.id
            LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
          return {
            items: rows.map(trainingTargetToJson), total: Number(totals[0]?.total ?? 0),
            page: pagination.page, pageSize: pagination.pageSize,
          };
        }
        const totals = await tx`
          WITH active_scope_actor AS (
            SELECT member.organization_id, member.user_id
            FROM organization_members member
            WHERE member.organization_id = ${access.id} AND member.user_id = ${actor.userId}
              AND member.status = 'active' AND member.role IN ('teacher', 'assistant')
          ), scoped_group_ids AS (
            SELECT assignment.group_id AS id
            FROM teacher_assignments assignment
            JOIN active_scope_actor actor_scope
              ON actor_scope.organization_id = assignment.organization_id
             AND actor_scope.user_id = assignment.teacher_user_id
            JOIN teaching_groups teaching_group
              ON teaching_group.organization_id = assignment.organization_id
             AND teaching_group.id = assignment.group_id
             AND teaching_group.status = 'active'
            LEFT JOIN teaching_campuses campus
              ON campus.organization_id = teaching_group.organization_id
             AND campus.id = teaching_group.campus_id
            WHERE assignment.organization_id = ${access.id} AND assignment.group_id IS NOT NULL
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
              AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
          ), scoped_student_ids AS (
            SELECT assignment.student_id AS id
            FROM teacher_assignments assignment
            JOIN active_scope_actor actor_scope
              ON actor_scope.organization_id = assignment.organization_id
             AND actor_scope.user_id = assignment.teacher_user_id
            JOIN student_profiles student
              ON student.organization_id = assignment.organization_id
             AND student.id = assignment.student_id AND student.status = 'active'
            WHERE assignment.organization_id = ${access.id} AND assignment.student_id IS NOT NULL
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
            UNION
            SELECT membership.student_id
            FROM scoped_group_ids scoped_group
            JOIN student_group_memberships membership
              ON membership.organization_id = ${access.id} AND membership.group_id = scoped_group.id
             AND membership.effective_from <= clock_timestamp()
             AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
            JOIN student_profiles student
              ON student.organization_id = membership.organization_id
             AND student.id = membership.student_id AND student.status = 'active'
          )
          SELECT COUNT(*)::int AS total FROM training_assignment_targets target
          WHERE target.organization_id = ${access.id} AND target.assignment_id = ${assignmentId}
            AND (${kind}::text IS NULL OR target.target_kind = ${kind})
            AND ((target.target_kind = 'group' AND target.group_id IN (SELECT id FROM scoped_group_ids))
              OR (target.target_kind = 'student' AND target.student_id IN (SELECT id FROM scoped_student_ids)))`;
        const rows = await tx`
          WITH active_scope_actor AS (
            SELECT member.organization_id, member.user_id
            FROM organization_members member
            WHERE member.organization_id = ${access.id} AND member.user_id = ${actor.userId}
              AND member.status = 'active' AND member.role IN ('teacher', 'assistant')
          ), scoped_group_ids AS (
            SELECT assignment.group_id AS id
            FROM teacher_assignments assignment
            JOIN active_scope_actor actor_scope
              ON actor_scope.organization_id = assignment.organization_id
             AND actor_scope.user_id = assignment.teacher_user_id
            JOIN teaching_groups teaching_group
              ON teaching_group.organization_id = assignment.organization_id
             AND teaching_group.id = assignment.group_id
             AND teaching_group.status = 'active'
            LEFT JOIN teaching_campuses campus
              ON campus.organization_id = teaching_group.organization_id
             AND campus.id = teaching_group.campus_id
            WHERE assignment.organization_id = ${access.id} AND assignment.group_id IS NOT NULL
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
              AND (teaching_group.campus_id IS NULL OR campus.status = 'active')
          ), scoped_student_ids AS (
            SELECT assignment.student_id AS id
            FROM teacher_assignments assignment
            JOIN active_scope_actor actor_scope
              ON actor_scope.organization_id = assignment.organization_id
             AND actor_scope.user_id = assignment.teacher_user_id
            JOIN student_profiles student
              ON student.organization_id = assignment.organization_id
             AND student.id = assignment.student_id AND student.status = 'active'
            WHERE assignment.organization_id = ${access.id} AND assignment.student_id IS NOT NULL
              AND assignment.effective_from <= clock_timestamp()
              AND (assignment.effective_to IS NULL OR assignment.effective_to > clock_timestamp())
            UNION
            SELECT membership.student_id
            FROM scoped_group_ids scoped_group
            JOIN student_group_memberships membership
              ON membership.organization_id = ${access.id} AND membership.group_id = scoped_group.id
             AND membership.effective_from <= clock_timestamp()
             AND (membership.effective_to IS NULL OR membership.effective_to > clock_timestamp())
            JOIN student_profiles student
              ON student.organization_id = membership.organization_id
             AND student.id = membership.student_id AND student.status = 'active'
          )
          SELECT * FROM training_assignment_targets target
          WHERE target.organization_id = ${access.id} AND target.assignment_id = ${assignmentId}
            AND (${kind}::text IS NULL OR target.target_kind = ${kind})
            AND ((target.target_kind = 'group' AND target.group_id IN (SELECT id FROM scoped_group_ids))
              OR (target.target_kind = 'student' AND target.student_id IN (SELECT id FROM scoped_student_ids)))
          ORDER BY target.target_kind, COALESCE(target.group_name_snapshot, target.student_display_name_snapshot), target.id
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        return {
          items: rows.map(trainingTargetToJson), total: Number(totals[0]?.total ?? 0),
          page: pagination.page, pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async listTrainingTargetEvidence(actor, slug, assignmentId, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.target.evidence.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        const assignments = await tx`
          SELECT * FROM training_assignments
          WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
        if (!assignments.length) {
          await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
        }
        await assertTrainingAssignmentScope(tx, access, actor, assignments[0] as Record<string, unknown>, 'read');
        const targets = await tx`
          SELECT 1 FROM training_assignment_targets
          WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
            AND target_kind = 'student' AND student_id = ${studentId}`;
        if (!targets.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment target not found');
        if (!hasOrganizationTrainingScope(access.role)
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
        }
        const totals = await tx`
          SELECT COUNT(*)::int AS total
          FROM training_evidence_assignments link
          WHERE link.organization_id = ${access.id} AND link.assignment_id = ${assignmentId}
            AND link.student_id = ${studentId}`;
        const rows = await tx`
          SELECT evidence.*
          FROM training_evidence_assignments link
          JOIN training_evidence evidence
            ON evidence.organization_id = link.organization_id AND evidence.id = link.evidence_id
          WHERE link.organization_id = ${access.id} AND link.assignment_id = ${assignmentId}
            AND link.student_id = ${studentId}
          ORDER BY evidence.occurred_at DESC, evidence.id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        if (!hasOrganizationTrainingScope(access.role)
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
        }
        return {
          items: rows.map(trainingEvidenceToJson), total: Number(totals[0]?.total ?? 0),
          page: pagination.page, pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async listTrainingTargetReviews(actor, slug, assignmentId, studentId, pagination, requestId) {
    return withDeniedAccessAudit(actor, slug, 'training.assignment.target.review.list', requestId, async () => {
      return await sql.begin(async (tx) => {
        const access = await accessForWrite(tx, actor.userId, slug);
        requirePermission(access, 'training:assignment:read');
        const assignments = await tx`
          SELECT * FROM training_assignments
          WHERE organization_id = ${access.id} AND id = ${assignmentId}`;
        if (!assignments.length) {
          await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
        }
        await assertTrainingAssignmentScope(tx, access, actor, assignments[0] as Record<string, unknown>, 'read');
        const targets = await tx`
          SELECT 1 FROM training_assignment_targets
          WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
            AND target_kind = 'student' AND student_id = ${studentId}`;
        if (!targets.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment target not found');
        if (!hasOrganizationTrainingScope(access.role)
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
        }
        const totals = await tx`
          SELECT COUNT(*)::int AS total FROM training_submission_reviews
          WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
            AND student_id = ${studentId}`;
        const rows = await tx`
          SELECT * FROM training_submission_reviews
          WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
            AND student_id = ${studentId}
          ORDER BY revision DESC, id DESC
          LIMIT ${pagination.pageSize} OFFSET ${pagination.offset}`;
        if (!hasOrganizationTrainingScope(access.role)
            && !await actorHasActiveStudentScope(tx, access.id, actor.userId, studentId)) {
          throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
        }
        return {
          items: rows.map(trainingReviewToJson), total: Number(totals[0]?.total ?? 0),
          page: pagination.page, pageSize: pagination.pageSize,
        };
      }) as PageResult;
    });
  },

  async createTrainingTargetReview(
    actor, slug, assignmentId, studentId, input, idempotencyKey, requestHash, requestId,
  ) {
    await consumeMutationAttempt(
      actor.userId, TRAINING_REVIEW_CREATE_OPERATION, 240, '1 minute',
    );
    return withDeniedAccessAudit(actor, slug, 'training.assignment.target.review.create', requestId, async () => {
      try {
        return await withRepeatableReadRetry<MutationResult>(async (tx) => {
          const access = await accessForWrite(tx, actor.userId, slug);
          requireWritable(access);
          requirePermission(access, 'training:review');
          const assignments = await tx`
            SELECT * FROM training_assignments
            WHERE organization_id = ${access.id} AND id = ${assignmentId}
            FOR UPDATE`;
          if (!assignments.length) {
            await trainingResourceMissing(tx, 'training_assignments', assignmentId, 'Training assignment not found');
          }
          const targets = await tx`
            SELECT * FROM training_assignment_targets
            WHERE organization_id = ${access.id} AND assignment_id = ${assignmentId}
              AND target_kind = 'student' AND student_id = ${studentId}
            FOR UPDATE`;
          if (!targets.length) throw new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment target not found');
          if (!hasOrganizationTrainingScope(access.role)
              && !await lockAndCheckTeacherStudentScope(tx, access, actor, studentId)) {
            throw new ConcealedTeachingPermissionDeniedException('Training assignment target not found');
          }
          const idem = await beginIdempotency(
            tx, actor.userId, access.id,
            TRAINING_REVIEW_CREATE_OPERATION,
            idempotencyKey, requestHash,
          );
          if ('replay' in idem) return idem.replay;
          if (!['published', 'closed'].includes(String(assignments[0].status))) {
            throw new TeachingApiException('CONFLICT', 409, 'Draft training assignments cannot be reviewed');
          }
          if (BigInt(String(targets[0].evidence_count)) < 1n) {
            throw new TeachingApiException('CONFLICT', 409, 'Training evidence is required before review');
          }
          const revision = Number(targets[0].latest_review_revision) + 1;
          const rows = await tx`
            INSERT INTO training_submission_reviews (
              organization_id, assignment_id, student_id, revision,
              reviewer_user_id, reviewer_user_id_snapshot, reviewer_display_name_snapshot,
              reviewer_role_snapshot, status, rating, feedback
            ) VALUES (
              ${access.id}, ${assignmentId}, ${studentId}, ${revision},
              ${actor.userId}, ${actor.userId}, ${actor.displayName}, ${access.role},
              ${input.status}, ${input.rating}, ${input.feedback}
            ) RETURNING *`;
          const reviewId = String(rows[0].id);
          const review = trainingReviewToJson(rows[0] as Record<string, unknown>);
          await insertTrainingAudit(
            tx, access, actor, 'training.assignment.target.review.create',
            'training_submission_review', reviewId, requestId,
            { assignmentId, studentId, revision, status: input.status, rating: input.rating },
          );
          const result: MutationResult = { status: 201, body: { review } };
          await completeIdempotency(tx, idem.id, result, 'training_submission_review', reviewId);
          return result;
        });
      } catch (error) {
        if (error instanceof TeachingApiException) throw error;
        return crmConflict(error, 'Training review could not be created');
      }
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

  routes.post('/teaching/organizations/:orgSlug/students/:studentId/account-binding-invites', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const body = await jsonBody(c, 1_024);
      const result = await repository.createStudentAccountBindingInvite(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        parseStudentAccountBindingInviteInput(body.value),
        requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/students/:studentId/account-binding-invite', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const result = await repository.getCurrentStudentAccountBindingInvite(
        actor,
        c.req.param('orgSlug'),
        uuidParam(c.req.param('studentId'), 'studentId'),
        requestId,
      );
      return c.json(result);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post(
    '/teaching/organizations/:orgSlug/students/:studentId/account-binding-invites/:inviteId/revoke',
    async (c) => {
      const requestId = requestIdOf(c);
      c.header('Cache-Control', 'no-store');
      try {
        const actor = await authenticate(c);
        const key = idempotencyKeyOf(c);
        const body = await jsonBody(c, 1_024);
        assertOnlyKeys(body.value, [], 'student account binding invite revoke input');
        const result = await repository.revokeStudentAccountBindingInvite(
          actor,
          c.req.param('orgSlug'),
          uuidParam(c.req.param('studentId'), 'studentId'),
          uuidParam(c.req.param('inviteId'), 'inviteId'),
          key,
          sha256(body.raw),
          requestId,
        );
        return c.json(result.body, result.status);
      } catch (error) {
        return errorResponse(c, error, requestId);
      }
    },
  );

  routes.post('/teaching/me/student-account-binding/preview', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const body = await jsonBody(c, 1_024);
      const parsed = parseStudentAccountBindingConsumeInput(body.value);
      const result = await repository.previewStudentAccountBindingInvite(
        actor,
        { tokenHash: sha256(parsed.token) },
        requestId,
      );
      return c.json(result);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/me/student-account-binding/consume', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const body = await jsonBody(c, 1_024);
      const parsed = parseStudentAccountBindingConsumeInput(body.value);
      const result = await repository.consumeStudentAccountBindingInvite(
        actor,
        { tokenHash: sha256(parsed.token) },
        requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/me/training/assignments', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listSelfTrainingAssignments(
        actor,
        c.req.param('orgSlug'),
        paginationOf(c),
        requestId,
      );
      return c.json({ assignments: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/me/training/evidence', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      let input: TrainingEvidenceV1;
      try {
        input = parseTrainingEvidenceV1(body.value);
      } catch (error) {
        if (error instanceof TrainingEvidenceValidationError) {
          throw new TeachingApiException('EVIDENCE_INVALID', 400, error.message);
        }
        throw error;
      }
      const result = await repository.createSelfTrainingEvidence(
        actor,
        c.req.param('orgSlug'),
        input,
        requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/templates', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTrainingTemplates(
        actor, c.req.param('orgSlug'), trainingPaginationOf(c), requestId,
      );
      return c.json({ templates: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/training/templates', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      const result = await repository.createTrainingTemplate(
        actor, c.req.param('orgSlug'), parseTrainingTemplateInput(body.value),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/templates/:templateId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      assertQueryKeys(c, []);
      const template = await repository.getTrainingTemplate(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('templateId'), 'templateId'), requestId,
      );
      return c.json({ template });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/templates/:templateId/versions', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTrainingTemplateVersions(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('templateId'), 'templateId'),
        trainingPaginationOf(c), requestId,
      );
      return c.json({ templateVersions: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/training/templates/:templateId/versions', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      const result = await repository.createTrainingTemplateVersion(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('templateId'), 'templateId'),
        parseTrainingTemplateVersionInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/training/templates/:templateId/archive', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      assertOnlyKeys(body.value, [], 'training template archive input');
      const result = await repository.archiveTrainingTemplate(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('templateId'), 'templateId'),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/assignments', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTrainingAssignments(
        actor, c.req.param('orgSlug'), trainingAssignmentFilterOf(c),
        trainingPaginationOf(c, ['status']), requestId,
      );
      return c.json({ assignments: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/training/assignments', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      const result = await repository.createTrainingAssignment(
        actor, c.req.param('orgSlug'), parseTrainingAssignmentInput(body.value),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      assertQueryKeys(c, []);
      return c.json(await repository.getTrainingAssignment(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'), requestId,
      ));
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/revise', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      const result = await repository.reviseTrainingAssignment(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
        parseTrainingAssignmentInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  const trainingAssignmentLifecycleHandler = (action: 'publish' | 'close') => async (c: Context) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      assertOnlyKeys(body.value, [], `training assignment ${action} input`);
      const orgSlug = c.req.param('orgSlug') ?? '';
      const assignmentId = uuidParam(c.req.param('assignmentId') ?? '', 'assignmentId');
      const result = action === 'publish'
        ? await repository.publishTrainingAssignment(
          actor, orgSlug, assignmentId, key, sha256(body.raw), requestId,
        )
        : await repository.closeTrainingAssignment(
          actor, orgSlug, assignmentId, key, sha256(body.raw), requestId,
        );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  };

  routes.post(
    '/teaching/organizations/:orgSlug/training/assignments/:assignmentId/publish',
    trainingAssignmentLifecycleHandler('publish'),
  );
  routes.post(
    '/teaching/organizations/:orgSlug/training/assignments/:assignmentId/close',
    trainingAssignmentLifecycleHandler('close'),
  );

  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTrainingAssignmentTargets(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
        trainingTargetFilterOf(c), trainingPaginationOf(c, ['targetKind']), requestId,
      );
      return c.json({ targets: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets/:studentId/evidence', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTrainingTargetEvidence(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
        uuidParam(c.req.param('studentId'), 'studentId'), trainingPaginationOf(c), requestId,
      );
      return c.json({ evidence: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets/:studentId/reviews', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTrainingTargetReviews(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
        uuidParam(c.req.param('studentId'), 'studentId'), trainingPaginationOf(c), requestId,
      );
      return c.json({ reviews: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/training/assignments/:assignmentId/targets/:studentId/reviews', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c, TRAINING_EVIDENCE_MAX_BODY_BYTES);
      const assignmentId = uuidParam(c.req.param('assignmentId'), 'assignmentId');
      const studentId = uuidParam(c.req.param('studentId'), 'studentId');
      const result = await repository.createTrainingTargetReview(
        actor, c.req.param('orgSlug'), assignmentId, studentId, parseTrainingReviewInput(body.value),
        key, trainingReviewRequestHash(assignmentId, studentId, body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/students/:studentId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const student = await repository.getStudent(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('studentId'), 'studentId'), requestId,
      );
      return c.json({ student });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/campuses', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listCampuses(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
      return c.json({ campuses: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/campuses', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createCampus(
        actor, c.req.param('orgSlug'), parseCampusInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/campuses/:campusId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const campus = await repository.getCampus(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('campusId'), 'campusId'), requestId,
      );
      return c.json({ campus });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/campuses/:campusId/archive', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      if (Object.keys(body.value).length) {
        throw new TeachingApiException('INVALID_INPUT', 400, 'Campus archive body must be empty');
      }
      const result = await repository.archiveCampus(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('campusId'), 'campusId'),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/groups', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listGroups(actor, c.req.param('orgSlug'), paginationOf(c), requestId);
      return c.json({ groups: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/groups', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createGroup(
        actor, c.req.param('orgSlug'), parseGroupInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/groups/:groupId', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const group = await repository.getGroup(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('groupId'), 'groupId'), requestId,
      );
      return c.json({ group });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/groups/:groupId/archive', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      if (Object.keys(body.value).length) {
        throw new TeachingApiException('INVALID_INPUT', 400, 'Group archive body must be empty');
      }
      const result = await repository.archiveGroup(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('groupId'), 'groupId'),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/groups/:groupId/students', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listGroupStudents(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('groupId'), 'groupId'), paginationOf(c), requestId,
      );
      return c.json({ memberships: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/groups/:groupId/students', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createStudentGroupMembership(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('groupId'), 'groupId'),
        parseStudentGroupMembershipInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/student-group-memberships/:membershipId/revoke', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      if (Object.keys(body.value).length) {
        throw new TeachingApiException('INVALID_INPUT', 400, 'Membership revoke body must be empty');
      }
      const result = await repository.revokeStudentGroupMembership(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('membershipId'), 'membershipId'),
        key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.get('/teaching/organizations/:orgSlug/teacher-assignments', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const page = await repository.listTeacherAssignments(
        actor, c.req.param('orgSlug'), teacherAssignmentTargetOf(c), paginationOf(c), requestId,
      );
      return c.json({ assignments: page.items, total: page.total, page: page.page, pageSize: page.pageSize });
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/teacher-assignments', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      const result = await repository.createTeacherAssignment(
        actor, c.req.param('orgSlug'), parseTeacherAssignmentInput(body.value), key, sha256(body.raw), requestId,
      );
      return c.json(result.body, result.status);
    } catch (error) {
      return errorResponse(c, error, requestId);
    }
  });

  routes.post('/teaching/organizations/:orgSlug/teacher-assignments/:assignmentId/revoke', async (c) => {
    const requestId = requestIdOf(c);
    c.header('Cache-Control', 'no-store');
    try {
      const actor = await authenticate(c);
      const key = idempotencyKeyOf(c);
      const body = await jsonBody(c);
      if (Object.keys(body.value).length) {
        throw new TeachingApiException('INVALID_INPUT', 400, 'Assignment revoke body must be empty');
      }
      const result = await repository.revokeTeacherAssignment(
        actor, c.req.param('orgSlug'), uuidParam(c.req.param('assignmentId'), 'assignmentId'),
        key, sha256(body.raw), requestId,
      );
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
