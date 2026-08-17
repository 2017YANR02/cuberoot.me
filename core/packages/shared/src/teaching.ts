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
