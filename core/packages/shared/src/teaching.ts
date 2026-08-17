export const TEACHING_ORGANIZATION_ROLES = [
  'owner',
  'admin',
  'teacher',
  'assistant',
  'finance',
  'viewer',
] as const;

export type TeachingOrganizationRole = (typeof TEACHING_ORGANIZATION_ROLES)[number];

export const TEACHING_ORGANIZATION_STATUSES = ['active', 'suspended', 'archived'] as const;
export type TeachingOrganizationStatus = (typeof TEACHING_ORGANIZATION_STATUSES)[number];

export const TEACHING_MEMBER_STATUSES = ['invited', 'active', 'suspended', 'revoked'] as const;
export type TeachingMemberStatus = (typeof TEACHING_MEMBER_STATUSES)[number];

export const TEACHING_STUDENT_STATUSES = ['active', 'inactive', 'archived'] as const;
export type TeachingStudentStatus = (typeof TEACHING_STUDENT_STATUSES)[number];

export const TEACHING_GUARDIAN_LINK_STATUSES = ['active', 'revoked'] as const;
export type TeachingGuardianLinkStatus = (typeof TEACHING_GUARDIAN_LINK_STATUSES)[number];

const ORGANIZATION_STATUS_TRANSITIONS: Record<TeachingOrganizationStatus, readonly TeachingOrganizationStatus[]> = {
  active: ['suspended', 'archived'],
  suspended: ['active', 'archived'],
  archived: [],
};

const MEMBER_STATUS_TRANSITIONS: Record<TeachingMemberStatus, readonly TeachingMemberStatus[]> = {
  invited: ['active', 'revoked'],
  active: ['suspended', 'revoked'],
  suspended: ['active', 'revoked'],
  revoked: [],
};

const STUDENT_STATUS_TRANSITIONS: Record<TeachingStudentStatus, readonly TeachingStudentStatus[]> = {
  active: ['inactive', 'archived'],
  inactive: ['active', 'archived'],
  archived: [],
};

const GUARDIAN_STATUS_TRANSITIONS: Record<TeachingGuardianLinkStatus, readonly TeachingGuardianLinkStatus[]> = {
  active: ['revoked'],
  revoked: [],
};

export const canTransitionTeachingOrganizationStatus = (
  from: TeachingOrganizationStatus,
  to: TeachingOrganizationStatus,
): boolean => ORGANIZATION_STATUS_TRANSITIONS[from].includes(to);

export const canTransitionTeachingMemberStatus = (
  from: TeachingMemberStatus,
  to: TeachingMemberStatus,
): boolean => MEMBER_STATUS_TRANSITIONS[from].includes(to);

export const canTransitionTeachingStudentStatus = (
  from: TeachingStudentStatus,
  to: TeachingStudentStatus,
): boolean => STUDENT_STATUS_TRANSITIONS[from].includes(to);

export const canTransitionTeachingGuardianLinkStatus = (
  from: TeachingGuardianLinkStatus,
  to: TeachingGuardianLinkStatus,
): boolean => GUARDIAN_STATUS_TRANSITIONS[from].includes(to);

export const TEACHING_PERMISSIONS = [
  'organization:manage',
  'member:read',
  'member:manage',
  'student:read',
  'student:manage',
  'finance:read',
  'finance:manage',
  'audit:read',
] as const;

export type TeachingPermission = (typeof TEACHING_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<TeachingOrganizationRole, readonly TeachingPermission[]> = {
  owner: TEACHING_PERMISSIONS,
  admin: TEACHING_PERMISSIONS,
  teacher: ['member:read', 'student:read', 'student:manage'],
  assistant: ['member:read', 'student:read', 'student:manage'],
  finance: ['member:read', 'student:read', 'finance:read', 'finance:manage'],
  viewer: ['member:read', 'student:read', 'finance:read'],
};

export function isTeachingOrganizationRole(value: unknown): value is TeachingOrganizationRole {
  return typeof value === 'string' && (TEACHING_ORGANIZATION_ROLES as readonly string[]).includes(value);
}

export function hasTeachingPermission(
  role: TeachingOrganizationRole,
  permission: TeachingPermission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const TRAINING_EVIDENCE_SOURCES = ['timer', 'predict', 'alg-trainer'] as const;
export type TrainingEvidenceSource = (typeof TRAINING_EVIDENCE_SOURCES)[number];

export type TrainingEvidenceValue =
  | string
  | number
  | boolean
  | null
  | TrainingEvidenceValue[]
  | { [key: string]: TrainingEvidenceValue };

/**
 * Immutable evidence emitted by a CubeRoot training tool.
 * Aggregates are deliberately excluded: the API derives them from source data.
 */
export interface TrainingEvidenceV1 {
  schemaVersion: 1;
  organizationId: string;
  studentId: string;
  assignmentId?: string | null;
  source: TrainingEvidenceSource;
  sourceEventId: string;
  actorUserId: string;
  occurredAt: string;
  activity: string;
  durationMs?: number | null;
  metrics: Record<string, TrainingEvidenceValue>;
  payloadVersion: number;
  payload?: Record<string, TrainingEvidenceValue>;
}

export class TrainingEvidenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TrainingEvidenceValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string, maxLength: number): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new TrainingEvidenceValidationError(`${key} must be a non-empty string up to ${maxLength} characters`);
  }
  return value;
}

function isTrainingEvidenceValue(value: unknown, depth = 0, seen = new WeakSet<object>()): value is TrainingEvidenceValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (depth >= 12 || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isTrainingEvidenceValue(item, depth + 1, seen))
    : Object.values(value).every((item) => isTrainingEvidenceValue(item, depth + 1, seen));
  seen.delete(value);
  return valid;
}

function requireEvidenceRecord(record: Record<string, unknown>, key: string): Record<string, TrainingEvidenceValue> {
  const value = record[key];
  if (!isRecord(value) || !isTrainingEvidenceValue(value)) {
    throw new TrainingEvidenceValidationError(`${key} must be a JSON object with finite values`);
  }
  return value as Record<string, TrainingEvidenceValue>;
}

export function parseTrainingEvidenceV1(value: unknown): TrainingEvidenceV1 {
  if (!isRecord(value)) throw new TrainingEvidenceValidationError('evidence must be an object');
  if (value.schemaVersion !== 1) throw new TrainingEvidenceValidationError('schemaVersion must be 1');
  if (typeof value.source !== 'string' || !(TRAINING_EVIDENCE_SOURCES as readonly string[]).includes(value.source)) {
    throw new TrainingEvidenceValidationError('source is not supported');
  }

  const occurredAt = requireString(value, 'occurredAt', 40);
  if (!Number.isFinite(Date.parse(occurredAt))) {
    throw new TrainingEvidenceValidationError('occurredAt must be an ISO date-time');
  }
  if (!Number.isSafeInteger(value.payloadVersion) || (value.payloadVersion as number) < 1) {
    throw new TrainingEvidenceValidationError('payloadVersion must be a positive integer');
  }
  if (value.durationMs != null && (!Number.isSafeInteger(value.durationMs) || (value.durationMs as number) < 0)) {
    throw new TrainingEvidenceValidationError('durationMs must be a non-negative integer');
  }
  if (value.assignmentId != null && (typeof value.assignmentId !== 'string' || value.assignmentId.length === 0)) {
    throw new TrainingEvidenceValidationError('assignmentId must be a non-empty string or null');
  }

  return {
    schemaVersion: 1,
    organizationId: requireString(value, 'organizationId', 128),
    studentId: requireString(value, 'studentId', 128),
    assignmentId: value.assignmentId as string | null | undefined,
    source: value.source as TrainingEvidenceSource,
    sourceEventId: requireString(value, 'sourceEventId', 200),
    actorUserId: requireString(value, 'actorUserId', 128),
    occurredAt,
    activity: requireString(value, 'activity', 100),
    durationMs: value.durationMs as number | null | undefined,
    metrics: requireEvidenceRecord(value, 'metrics'),
    payloadVersion: value.payloadVersion as number,
    payload: value.payload === undefined ? undefined : requireEvidenceRecord(value, 'payload'),
  };
}

export const TEACHING_ERROR_CODES = [
  'UNAUTHENTICATED',
  'INVALID_PLATFORM_ASSERTION',
  'ORGANIZATION_NOT_FOUND',
  'ORGANIZATION_ACCESS_DENIED',
  'ORGANIZATION_SUSPENDED',
  'MEMBER_INACTIVE',
  'PERMISSION_DENIED',
  'RESOURCE_NOT_FOUND',
  'RESOURCE_ORGANIZATION_MISMATCH',
  'INVALID_INPUT',
  'CONFLICT',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_CONFLICT',
  'EVIDENCE_DUPLICATE',
  'EVIDENCE_INVALID',
  'ASSIGNMENT_CLOSED',
] as const;

export type TeachingErrorCode = (typeof TEACHING_ERROR_CODES)[number];

export interface TeachingApiErrorBody {
  error: {
    code: TeachingErrorCode;
    message: string;
    requestId?: string;
  };
}
