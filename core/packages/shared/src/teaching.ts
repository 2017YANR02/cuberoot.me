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

export const TEACHING_PACKAGE_PRODUCT_STATUSES = ['active', 'retired'] as const;
export type TeachingPackageProductStatus = (typeof TEACHING_PACKAGE_PRODUCT_STATUSES)[number];

export const TEACHING_STUDENT_PACKAGE_STATUSES = ['active', 'frozen', 'cancelled'] as const;
export type TeachingStudentPackageStatus = (typeof TEACHING_STUDENT_PACKAGE_STATUSES)[number];

export const TEACHING_CREDIT_UNITS = ['lesson', 'minute'] as const;
export type TeachingCreditUnit = (typeof TEACHING_CREDIT_UNITS)[number];

export const TEACHING_PACKAGE_ACQUISITION_TYPES = ['purchase', 'grant', 'migration'] as const;
export type TeachingPackageAcquisitionType = (typeof TEACHING_PACKAGE_ACQUISITION_TYPES)[number];

export const TEACHING_SESSION_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;
export type TeachingSessionStatus = (typeof TEACHING_SESSION_STATUSES)[number];

export const TEACHING_ATTENDANCE_STATUSES = ['expected', 'present', 'late', 'absent', 'excused'] as const;
export type TeachingAttendanceStatus = (typeof TEACHING_ATTENDANCE_STATUSES)[number];

export const TEACHING_CAMPUS_STATUSES = ['active', 'archived'] as const;
export type TeachingCampusStatus = (typeof TEACHING_CAMPUS_STATUSES)[number];

export const TEACHING_GROUP_STATUSES = ['active', 'archived'] as const;
export type TeachingGroupStatus = (typeof TEACHING_GROUP_STATUSES)[number];

export interface TeachingCampus {
  id: string;
  code: string | null;
  name: string;
  timezone: string | null;
  status: TeachingCampusStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingGroup {
  id: string;
  campusId: string | null;
  code: string | null;
  name: string;
  status: TeachingGroupStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingStudentSummary {
  id: string;
  externalRef: string | null;
  displayName: string;
  status: TeachingStudentStatus;
}

export interface TeachingStudentGroupMembership {
  id: string;
  groupId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  student: TeachingStudentSummary;
}

export interface TeachingTeacherAssignment {
  id: string;
  teacherUserId: number | null;
  teacherUserIdSnapshot: number;
  groupId: string | null;
  studentId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  teacher: {
    userId: number | null;
    displayName: string;
    role: 'owner' | 'admin' | 'teacher' | 'assistant';
    status: TeachingMemberStatus | null;
  };
}

export interface CreateTeachingCampusInput {
  code: string | null;
  name: string;
  timezone: string | null;
}

export interface CreateTeachingGroupInput {
  campusId: string | null;
  code: string | null;
  name: string;
}

export interface CreateTeachingStudentGroupMembershipInput {
  studentId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CreateTeachingTeacherAssignmentInput {
  teacherUserId: number;
  groupId: string | null;
  studentId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

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

const PACKAGE_PRODUCT_STATUS_TRANSITIONS: Record<TeachingPackageProductStatus, readonly TeachingPackageProductStatus[]> = {
  active: ['retired'],
  retired: [],
};

const STUDENT_PACKAGE_STATUS_TRANSITIONS: Record<TeachingStudentPackageStatus, readonly TeachingStudentPackageStatus[]> = {
  active: ['frozen', 'cancelled'],
  frozen: ['active', 'cancelled'],
  cancelled: [],
};

const SESSION_STATUS_TRANSITIONS: Record<TeachingSessionStatus, readonly TeachingSessionStatus[]> = {
  scheduled: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
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

export const canTransitionTeachingPackageProductStatus = (
  from: TeachingPackageProductStatus,
  to: TeachingPackageProductStatus,
): boolean => PACKAGE_PRODUCT_STATUS_TRANSITIONS[from].includes(to);

export const canTransitionTeachingStudentPackageStatus = (
  from: TeachingStudentPackageStatus,
  to: TeachingStudentPackageStatus,
): boolean => STUDENT_PACKAGE_STATUS_TRANSITIONS[from].includes(to);

export const canTransitionTeachingSessionStatus = (
  from: TeachingSessionStatus,
  to: TeachingSessionStatus,
): boolean => SESSION_STATUS_TRANSITIONS[from].includes(to);

export const TEACHING_PERMISSIONS = [
  'organization:manage',
  'member:read',
  'member:manage',
  'student:read',
  'student:manage',
  'campus:read',
  'campus:manage',
  'group:read',
  'group:manage',
  'assignment:manage',
  'package:read',
  'package:manage',
  'session:read',
  'session:manage',
  'session:create',
  'finance:read',
  'finance:manage',
  'audit:read',
  'training:template:read',
  'training:template:manage',
  'training:assignment:read',
  'training:assignment:manage',
  'training:review',
] as const;

export type TeachingPermission = (typeof TEACHING_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<TeachingOrganizationRole, readonly TeachingPermission[]> = {
  owner: TEACHING_PERMISSIONS,
  admin: TEACHING_PERMISSIONS,
  teacher: [
    'member:read', 'student:read', 'campus:read', 'group:read', 'session:read', 'session:manage',
    'training:template:read', 'training:assignment:read', 'training:assignment:manage', 'training:review',
  ],
  assistant: [
    'member:read', 'student:read', 'campus:read', 'group:read', 'session:read', 'session:manage',
    'training:template:read', 'training:assignment:read', 'training:review',
  ],
  finance: ['member:read', 'package:read', 'package:manage', 'finance:read', 'finance:manage'],
  viewer: ['member:read'],
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

export const TRAINING_TRUST_LEVELS = [
  'self_reported',
  'server_recomputed',
  'server_challenge_recomputed',
  'server_originated',
] as const;
export type TrainingTrustLevel = (typeof TRAINING_TRUST_LEVELS)[number];

export const TRAINING_SCHEDULE_KINDS = ['once', 'daily'] as const;
export type TrainingScheduleKind = (typeof TRAINING_SCHEDULE_KINDS)[number];

export const TRAINING_TEMPLATE_STATUSES = ['active', 'archived'] as const;
export type TrainingTemplateStatus = (typeof TRAINING_TEMPLATE_STATUSES)[number];

export const TRAINING_ASSIGNMENT_STATUSES = ['draft', 'published', 'closed'] as const;
export type TrainingAssignmentStatus = (typeof TRAINING_ASSIGNMENT_STATUSES)[number];

export const TRAINING_REVIEW_STATUSES = ['commented', 'needs_changes', 'accepted'] as const;
export type TrainingReviewStatus = (typeof TRAINING_REVIEW_STATUSES)[number];

export const TRAINING_GOAL_METRIC_KEYS = [
  'evidence_count',
  'duration_ms',
  'success_count',
  'best_result_ms',
] as const;
export type TrainingGoalMetricKey = (typeof TRAINING_GOAL_METRIC_KEYS)[number];

export const TRAINING_GOAL_OPERATORS = ['gte', 'lte'] as const;
export type TrainingGoalOperator = (typeof TRAINING_GOAL_OPERATORS)[number];

type TrainingEvidenceMetricKey = 'success' | 'resultMs';
type TrainingGoalDefinition = Partial<
  Record<TrainingGoalMetricKey, readonly TrainingGoalOperator[]>
>;
interface TrainingActivityDefinition {
  metrics: readonly TrainingEvidenceMetricKey[];
  goals: TrainingGoalDefinition;
}

/**
 * Canonical source/activity contract. Parsers and goal validation derive from
 * this registry so adding a tool cannot silently create an impossible goal.
 */
export const TRAINING_ACTIVITY_REGISTRY = {
  timer: {
    solve: {
      metrics: ['success', 'resultMs'],
      goals: {
        evidence_count: ['gte'],
        duration_ms: ['gte'],
        success_count: ['gte'],
        best_result_ms: ['lte'],
      },
    },
  },
  predict: {
    prediction: {
      metrics: ['success'],
      goals: {
        evidence_count: ['gte'],
        duration_ms: ['gte'],
        success_count: ['gte'],
      },
    },
  },
  'alg-trainer': {
    algorithm_attempt: {
      metrics: ['success'],
      goals: {
        evidence_count: ['gte'],
        duration_ms: ['gte'],
        success_count: ['gte'],
      },
    },
  },
} as const satisfies Record<
  TrainingEvidenceSource,
  Record<string, TrainingActivityDefinition>
>;

type TrainingActivityRegistry = typeof TRAINING_ACTIVITY_REGISTRY;

export type TrainingEvidenceActivityForSource<Source extends TrainingEvidenceSource> =
  Source extends TrainingEvidenceSource
    ? Extract<keyof TrainingActivityRegistry[Source], string>
    : never;

export type TrainingEvidenceActivity =
  TrainingEvidenceActivityForSource<TrainingEvidenceSource>;

function trainingActivityKeys<Source extends TrainingEvidenceSource>(
  source: Source,
): readonly TrainingEvidenceActivityForSource<Source>[] {
  return Object.keys(TRAINING_ACTIVITY_REGISTRY[source]) as TrainingEvidenceActivityForSource<Source>[];
}

export const TRAINING_SOURCE_ACTIVITIES = {
  timer: trainingActivityKeys('timer'),
  predict: trainingActivityKeys('predict'),
  'alg-trainer': trainingActivityKeys('alg-trainer'),
} satisfies {
  readonly [Source in TrainingEvidenceSource]: readonly TrainingEvidenceActivityForSource<Source>[];
};

type TrainingGoalRegistry = {
  readonly [Source in TrainingEvidenceSource]: {
    readonly [Activity in keyof TrainingActivityRegistry[Source]]:
      TrainingActivityRegistry[Source][Activity] extends { readonly goals: infer Goals }
        ? Goals
        : never;
  };
};

export const TRAINING_GOAL_REGISTRY = {
  timer: {
    solve: TRAINING_ACTIVITY_REGISTRY.timer.solve.goals,
  },
  predict: {
    prediction: TRAINING_ACTIVITY_REGISTRY.predict.prediction.goals,
  },
  'alg-trainer': {
    algorithm_attempt: TRAINING_ACTIVITY_REGISTRY['alg-trainer'].algorithm_attempt.goals,
  },
} as const satisfies TrainingGoalRegistry;

function trainingActivityDefinition(
  source: TrainingEvidenceSource,
  activity: string,
): TrainingActivityDefinition | undefined {
  return (TRAINING_ACTIVITY_REGISTRY[source] as Record<string, TrainingActivityDefinition>)[activity];
}

export const TRAINING_EVIDENCE_FUTURE_TOLERANCE_MS = 5 * 60 * 1_000;

export const TRAINING_EVIDENCE_MAX_BODY_BYTES = 64 * 1024;
export const TRAINING_EVIDENCE_JSON_LIMITS = {
  maxDepth: 8,
  maxNodes: 2_048,
  maxObjectKeys: 128,
  maxTotalKeys: 512,
  maxArrayItems: 256,
  maxKeyLength: 80,
  maxStringLength: 2_000,
  maxTotalStringLength: 32_768,
  maxAssignmentIds: 50,
} as const;

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
interface TrainingEvidenceV1Base {
  schemaVersion: 1;
  sourceEventId: string;
  occurredAt: string;
  durationMs?: number | null;
  metrics: Record<string, TrainingEvidenceValue>;
  payloadVersion: number;
  payload?: Record<string, TrainingEvidenceValue>;
  assignmentIds?: string[];
}

export type TrainingEvidenceV1 = TrainingEvidenceV1Base & {
  [Source in TrainingEvidenceSource]: {
    source: Source;
    activity: TrainingEvidenceActivityForSource<Source>;
  };
}[TrainingEvidenceSource];

export interface TeachingTrainingTemplate {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  status: TrainingTemplateStatus;
  latestVersionNumber: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingTrainingTemplateVersion {
  id: string;
  organizationId: string;
  templateId: string;
  versionNumber: number;
  title: string;
  instructions: string;
  source: TrainingEvidenceSource;
  activity: TrainingEvidenceActivity;
  toolConfig: Record<string, TrainingEvidenceValue>;
  publishedAt: string;
}

export interface TeachingTrainingAssignment {
  id: string;
  organizationId: string;
  templateVersionId: string;
  title: string;
  instructions: string;
  status: TrainingAssignmentStatus;
  scheduleKind: TrainingScheduleKind;
  expectedCount: number;
  timezoneSnapshot: string;
  startsAt: string;
  endsAt: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TeachingTrainingAssignmentTargetBase {
  id: string;
  organizationId: string;
  assignmentId: string;
  evidenceCount: string;
  firstEvidenceAt: string | null;
  lastEvidenceAt: string | null;
  latestReviewRevision: number;
  latestReviewStatus: TrainingReviewStatus | null;
}

export type TeachingTrainingAssignmentTarget = TeachingTrainingAssignmentTargetBase & (
  | {
      targetKind: 'group';
      groupId: string;
      sourceGroupId: null;
      studentId: null;
      groupNameSnapshot: string;
      studentDisplayNameSnapshot: null;
      studentExternalRefSnapshot: null;
    }
  | {
      targetKind: 'student';
      groupId: null;
      sourceGroupId: string | null;
      studentId: string;
      groupNameSnapshot: null;
      studentDisplayNameSnapshot: string;
      studentExternalRefSnapshot: string | null;
    }
);

export interface TeachingTrainingAssignmentGoalMetric {
  id: string;
  organizationId: string;
  assignmentId: string;
  metricKey: TrainingGoalMetricKey;
  operator: TrainingGoalOperator;
  targetValue: number;
}

export interface TeachingTrainingEvidence {
  id: string;
  organizationId: string;
  studentId: string;
  source: TrainingEvidenceSource;
  sourceEventId: string;
  trustLevel: TrainingTrustLevel;
  occurredAt: string;
  timezoneSnapshot: string;
  localDate: string;
  activity: TrainingEvidenceActivity;
  durationMs: number | null;
  resultMs: number | null;
  success: boolean | null;
  payloadVersion: number;
  createdAt: string;
}

export interface TeachingTrainingSubmissionReview {
  id: string;
  organizationId: string;
  assignmentId: string;
  studentId: string;
  revision: number;
  reviewerUserId: number | null;
  reviewerUserIdSnapshot: number;
  reviewerDisplayNameSnapshot: string;
  reviewerRoleSnapshot: 'owner' | 'admin' | 'teacher' | 'assistant';
  status: TrainingReviewStatus;
  rating: number | null;
  feedback: string;
  createdAt: string;
}

export interface TeachingDailyTrainingRollup {
  organizationId: string;
  studentId: string;
  localDate: string;
  source: TrainingEvidenceSource;
  activity: TrainingEvidenceActivity;
  trustLevel: TrainingTrustLevel;
  evidenceCount: string;
  durationMs: string;
  successCount: string;
  updatedAt: string;
}

export type TeachingStudentAccountBindingInviteStatus = 'pending' | 'expired' | 'revoked' | 'consumed';

export interface TeachingStudentAccountBindingInvite {
  id: string;
  organizationId: string;
  studentId: string;
  status: TeachingStudentAccountBindingInviteStatus;
  expiresAt: string;
  expiredAt: string | null;
  consumedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface TeachingStudentAccountBindingInviteCreated {
  invite: TeachingStudentAccountBindingInvite;
  token: string;
}

export interface TeachingStudentAccountBindingPreview {
  organizationName: string;
  studentDisplayName: string;
  expiresAt: string;
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
  if (typeof value !== 'string') {
    throw new TrainingEvidenceValidationError(`${key} must be a non-empty string up to ${maxLength} characters`);
  }
  const canonical = value.trim();
  if (canonical.length === 0 || canonical.length > maxLength) {
    throw new TrainingEvidenceValidationError(`${key} must be a non-empty string up to ${maxLength} characters`);
  }
  return canonical;
}

const TRAINING_EVIDENCE_RESERVED_NESTED_KEYS = new Set([
  'organizationid',
  'organizationslug',
  'studentid',
  'actorid',
  'actoruserid',
  'accountuserid',
  'submittedby',
  'submittedbyuserid',
  'trustlevel',
]);

function isReservedTrainingEvidenceKey(key: string): boolean {
  return TRAINING_EVIDENCE_RESERVED_NESTED_KEYS.has(key.toLowerCase().replace(/[_-]/g, ''));
}

function parseStrictOffsetDateTime(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) throw new TrainingEvidenceValidationError('occurredAt must be an ISO date-time with an explicit offset');

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = '', zone, sign, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(fraction.padEnd(3, '0'));
  const offsetHour = zone === 'Z' ? 0 : Number(offsetHourText);
  const offsetMinute = zone === 'Z' ? 0 : Number(offsetMinuteText);
  if (year < 1970 || year > 9999 || month < 1 || month > 12 || day < 1
      || hour > 23 || minute > 59 || second > 59
      || offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
    throw new TrainingEvidenceValidationError('occurredAt contains an invalid calendar or offset value');
  }

  const localEpoch = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const localRoundTrip = new Date(localEpoch);
  if (localRoundTrip.getUTCFullYear() !== year
      || localRoundTrip.getUTCMonth() !== month - 1
      || localRoundTrip.getUTCDate() !== day
      || localRoundTrip.getUTCHours() !== hour
      || localRoundTrip.getUTCMinutes() !== minute
      || localRoundTrip.getUTCSeconds() !== second
      || localRoundTrip.getUTCMilliseconds() !== millisecond) {
    throw new TrainingEvidenceValidationError('occurredAt contains an invalid calendar value');
  }

  const offsetMinutes = zone === 'Z' ? 0 : (offsetHour * 60 + offsetMinute) * (sign === '+' ? 1 : -1);
  const epoch = localEpoch - offsetMinutes * 60_000;
  if (!Number.isFinite(epoch) || epoch < Date.UTC(1970, 0, 1)
      || epoch > Date.now() + TRAINING_EVIDENCE_FUTURE_TOLERANCE_MS) {
    throw new TrainingEvidenceValidationError('occurredAt must be from 1970 onward and not more than 5 minutes in the future');
  }
  return epoch;
}

interface TrainingEvidenceJsonBudget {
  nodes: number;
  keys: number;
  stringLength: number;
  seen: WeakSet<object>;
}

function isTrainingEvidenceValue(
  value: unknown,
  depth: number,
  budget: TrainingEvidenceJsonBudget,
): value is TrainingEvidenceValue {
  budget.nodes += 1;
  if (budget.nodes > TRAINING_EVIDENCE_JSON_LIMITS.maxNodes) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
  if (typeof value === 'string') {
    budget.stringLength += value.length;
    return value.length <= TRAINING_EVIDENCE_JSON_LIMITS.maxStringLength
      && budget.stringLength <= TRAINING_EVIDENCE_JSON_LIMITS.maxTotalStringLength;
  }
  if (depth >= TRAINING_EVIDENCE_JSON_LIMITS.maxDepth || typeof value !== 'object') return false;
  if (budget.seen.has(value)) return false;
  budget.seen.add(value);
  let valid: boolean;
  if (Array.isArray(value)) {
    valid = value.length <= TRAINING_EVIDENCE_JSON_LIMITS.maxArrayItems
      && value.every((item) => isTrainingEvidenceValue(item, depth + 1, budget));
  } else {
    const entries = Object.entries(value);
    budget.keys += entries.length;
    valid = entries.length <= TRAINING_EVIDENCE_JSON_LIMITS.maxObjectKeys
      && budget.keys <= TRAINING_EVIDENCE_JSON_LIMITS.maxTotalKeys
      && entries.every(([key, item]) => key.length > 0
        && key.length <= TRAINING_EVIDENCE_JSON_LIMITS.maxKeyLength
        && !isReservedTrainingEvidenceKey(key)
        && isTrainingEvidenceValue(item, depth + 1, budget));
  }
  budget.seen.delete(value);
  return valid;
}

function requireEvidenceRecord(record: Record<string, unknown>, key: string): Record<string, TrainingEvidenceValue> {
  const value = record[key];
  const budget: TrainingEvidenceJsonBudget = { nodes: 0, keys: 0, stringLength: 0, seen: new WeakSet() };
  if (!isRecord(value) || !isTrainingEvidenceValue(value, 0, budget)) {
    throw new TrainingEvidenceValidationError(`${key} exceeds the bounded JSON limits or contains an invalid value`);
  }
  return value as Record<string, TrainingEvidenceValue>;
}

function requireAssignmentIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > TRAINING_EVIDENCE_JSON_LIMITS.maxAssignmentIds) {
    throw new TrainingEvidenceValidationError(
      `assignmentIds must be an array with at most ${TRAINING_EVIDENCE_JSON_LIMITS.maxAssignmentIds} items`,
    );
  }
  const ids = value.map((item) => {
    const canonical = typeof item === 'string' ? item.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(canonical)) {
      throw new TrainingEvidenceValidationError('assignmentIds must contain UUIDs');
    }
    return canonical.toLowerCase();
  });
  return [...new Set(ids)].sort();
}

function validateEvidenceMetricRegistry(
  source: TrainingEvidenceSource,
  activity: TrainingEvidenceActivity,
  metrics: Record<string, TrainingEvidenceValue>,
): void {
  const definition = trainingActivityDefinition(source, activity);
  if (!definition) throw new TrainingEvidenceValidationError(`activity is not registered for ${source}`);
  const allowed = new Set<string>(definition.metrics);
  for (const key of Object.keys(metrics)) {
    if (!allowed.has(key)) throw new TrainingEvidenceValidationError(`metrics.${key} is not registered for ${source}/${activity}`);
  }
  if (typeof metrics.success !== 'boolean') {
    throw new TrainingEvidenceValidationError('metrics.success must be a boolean');
  }
  if ('resultMs' in metrics && metrics.resultMs !== null
      && (!Number.isSafeInteger(metrics.resultMs) || (metrics.resultMs as number) < 0
        || (metrics.resultMs as number) > 86_400_000)) {
    throw new TrainingEvidenceValidationError('metrics.resultMs must be an integer from 0 to 86400000 or null');
  }
  if (source === 'timer' && metrics.success && metrics.resultMs == null) {
    throw new TrainingEvidenceValidationError('successful timer evidence requires metrics.resultMs');
  }
}

export function parseTrainingEvidenceV1(value: unknown): TrainingEvidenceV1 {
  if (!isRecord(value)) throw new TrainingEvidenceValidationError('evidence must be an object');
  const allowedKeys = new Set([
    'schemaVersion', 'source', 'sourceEventId', 'occurredAt', 'activity', 'durationMs',
    'metrics', 'payloadVersion', 'payload', 'assignmentIds',
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) throw new TrainingEvidenceValidationError(`${key} is not accepted in client evidence`);
  }
  if (value.schemaVersion !== 1) throw new TrainingEvidenceValidationError('schemaVersion must be 1');
  if (typeof value.source !== 'string' || !(TRAINING_EVIDENCE_SOURCES as readonly string[]).includes(value.source)) {
    throw new TrainingEvidenceValidationError('source is not supported');
  }

  const source = value.source as TrainingEvidenceSource;
  const activity = requireString(value, 'activity', 100) as TrainingEvidenceActivity;
  if (!trainingActivityDefinition(source, activity)) {
    throw new TrainingEvidenceValidationError(`activity is not registered for ${source}`);
  }

  const occurredAt = requireString(value, 'occurredAt', 40);
  const occurredAtEpoch = parseStrictOffsetDateTime(occurredAt);
  if (!Number.isSafeInteger(value.payloadVersion) || (value.payloadVersion as number) < 1
      || (value.payloadVersion as number) > 100) {
    throw new TrainingEvidenceValidationError('payloadVersion must be an integer from 1 to 100');
  }
  if (value.durationMs != null && (!Number.isSafeInteger(value.durationMs) || (value.durationMs as number) < 0
      || (value.durationMs as number) > 86_400_000)) {
    throw new TrainingEvidenceValidationError('durationMs must be an integer from 0 to 86400000 or null');
  }

  const metrics = requireEvidenceRecord(value, 'metrics');
  validateEvidenceMetricRegistry(source, activity, metrics);

  return {
    schemaVersion: 1,
    source,
    sourceEventId: requireString(value, 'sourceEventId', 200),
    occurredAt: new Date(occurredAtEpoch).toISOString(),
    activity,
    durationMs: value.durationMs as number | null | undefined,
    metrics,
    payloadVersion: value.payloadVersion as number,
    payload: value.payload === undefined ? undefined : requireEvidenceRecord(value, 'payload'),
    assignmentIds: requireAssignmentIds(value.assignmentIds),
  } as TrainingEvidenceV1;
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
  'RATE_LIMITED',
  'CONFLICT',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_CONFLICT',
  'EVIDENCE_DUPLICATE',
  'EVIDENCE_INVALID',
  'ASSIGNMENT_CLOSED',
  'INTERNAL_ERROR',
] as const;

export type TeachingErrorCode = (typeof TEACHING_ERROR_CODES)[number];

export interface TeachingApiErrorBody {
  error: {
    code: TeachingErrorCode;
    message: string;
    requestId?: string;
  };
}

export const TEACHING_PLATFORM_ASSERTION_HEADER = 'X-CubeRoot-Platform-Assertion';
export const TEACHING_PLATFORM_ASSERTION_ISSUER = 'cuberoot-platform';
export const TEACHING_PLATFORM_ASSERTION_AUDIENCE = 'cuberoot-teaching-api';
export const TEACHING_PLATFORM_ASSERTION_MAX_AGE_SECONDS = 90;

/** Server-to-server proof emitted by the migrated teaching platform. */
export interface TeachingPlatformAssertionV1 {
  v: 1;
  iss: typeof TEACHING_PLATFORM_ASSERTION_ISSUER;
  aud: typeof TEACHING_PLATFORM_ASSERTION_AUDIENCE;
  sub: string;
  phone: string;
  name: string;
  method: string;
  path: string;
  bodySha256: string;
  idempotencyKey: string | null;
  iat: number;
  exp: number;
  jti: string;
}
