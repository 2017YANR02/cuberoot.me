import {
  TEACHING_ATTENDANCE_STATUSES,
  TEACHING_CAMPUS_STATUSES,
  TEACHING_CONVERSATION_ACTOR_ROLES,
  TEACHING_CREDIT_LEDGER_ENTRY_TYPES,
  TEACHING_CREDIT_UNITS,
  TEACHING_FEEDBACK_VISIBILITIES,
  TEACHING_GROUP_STATUSES,
  TEACHING_MEMBER_STATUSES,
  TEACHING_ORGANIZATION_ROLES,
  TEACHING_ORGANIZATION_STATUSES,
  TEACHING_PACKAGE_ACQUISITION_TYPES,
  TEACHING_PACKAGE_PRODUCT_STATUSES,
  TEACHING_SESSION_STATUSES,
  TEACHING_STUDENT_PACKAGE_STATUSES,
  TEACHING_STUDENT_STATUSES,
  TEACHING_WEEKLY_REPORT_STATUSES,
  TEACHING_WEEKLY_REPORT_VISIBILITIES,
  TRAINING_ASSIGNMENT_STATUSES,
  TRAINING_EVIDENCE_SOURCES,
  TRAINING_GOAL_METRIC_KEYS,
  TRAINING_GOAL_OPERATORS,
  TRAINING_REVIEW_STATUSES,
  TRAINING_SCHEDULE_KINDS,
  TRAINING_TEMPLATE_STATUSES,
  TRAINING_TRUST_LEVELS,
  isTrainingSourceActivity,
  type TeachingAttendanceStatus,
  type TeachingCampus,
  type CreateTeachingConversationInput,
  type CreateTeachingConversationResponse,
  type TeachingCreditUnit,
  type MarkTeachingConversationReadInput,
  type MarkTeachingConversationReadResponse,
  type ReplyTeachingConversationInput,
  type ReplyTeachingConversationResponse,
  type TeachingConversationActorSnapshot,
  type TeachingConversationDetailResponse,
  type TeachingConversationListResponse,
  type TeachingConversationMessage,
  type TeachingConversationMessagesResponse,
  type TeachingConversationSummary,
  type TeachingCreditAdjustment,
  type TeachingCreditLedgerEntry,
  type TeachingFeedbackVisibility,
  type TeachingJsonValue,
  type TeachingGroup,
  type TeachingMemberStatus,
  type TeachingOperationsOverview,
  type TeachingOrganizationRole,
  type TeachingOrganizationStatus,
  type TeachingPackageAcquisitionType,
  type TeachingPackageProductStatus,
  type TeachingSessionStatus,
  type TeachingStudentPackageStatus,
  type TeachingStudentStatus,
  type TeachingStudentGroupMembership,
  type TeachingTeacherAssignment,
  type TeachingSelfTrainingAssignment,
  type TeachingStudentAccountBindingConsumed,
  type TeachingStudentAccountBindingInvite,
  type TeachingStudentAccountBindingInviteCreated,
  type TeachingStudentAccountBindingPreview,
  type TeachingGuardianAccountBindingConsumed,
  type TeachingGuardianAccountBindingPreview,
  type TeachingLearningContext,
  type TeachingLearnerLessonFeedback,
  type TeachingLearnerWeeklyReport,
  type TeachingTrainingAssignment,
  type TeachingTrainingAssignmentDetail,
  type TeachingTrainingAssignmentGoalMetric,
  type TeachingTrainingAssignmentTarget,
  type TeachingTrainingAssignmentWriteInput,
  type TeachingTrainingEvidence,
  type TeachingTrainingReviewCreateInput,
  type TeachingTrainingSubmissionReview,
  type TeachingTrainingTemplate,
  type TeachingTrainingTemplateCreateInput,
  type TeachingTrainingTemplateVersion,
  type TeachingTrainingTemplateVersionCreateInput,
  type GenerateTeachingWeeklyReportInput,
  type PublishTeachingWeeklyReportInput,
  type TeachingWeeklyReport,
  type TeachingWeeklyReportAggregate,
  type TeachingWeeklyReportAssignmentItem,
  type TeachingWeeklyReportLessonFeedbackItem,
  type TeachingWeeklyReportSummary,
  type TeachingWeeklyReportTrainingDimension,
} from '@cuberoot/shared/teaching';
import { apiUrl } from '@/lib/api-base';
import { getSessionToken } from '@/lib/auth-store';

const REQUEST_TIMEOUT_MS = 12_000;

export interface TeachingOrganizationAccess {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  status: TeachingOrganizationStatus;
  version: number;
  role: TeachingOrganizationRole;
}

export interface TeachingOrganizationSummary {
  organization: TeachingOrganizationAccess;
  memberCount: number | null;
  studentCount: number | null;
}

export interface TeachingStudent {
  id: string;
  accountUserId: number | null;
  externalRef: string | null;
  displayName: string;
  status: TeachingStudentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TeachingMember {
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  role: TeachingOrganizationRole;
  status: TeachingMemberStatus;
  joinedAt: string | null;
  createdAt: string | null;
}

export interface TeachingPackageProduct {
  id: string;
  code: string;
  name: string;
  status: TeachingPackageProductStatus;
  creditUnit: TeachingCreditUnit;
  creditType: string;
  totalCredits: number;
  validityDays: number | null;
  priceAmountMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingStudentPackage {
  id: string;
  studentId: string;
  productId: string;
  productCode: string;
  productName: string;
  creditUnit: TeachingCreditUnit;
  creditType: string;
  entitledCredits: number;
  remainingCredits: number;
  validityDays: number | null;
  priceAmountMinor: number;
  currency: string;
  status: TeachingStudentPackageStatus;
  acquisitionType: TeachingPackageAcquisitionType;
  validFrom: string;
  validUntil: string | null;
  sourceSystem: string | null;
  sourceRef: string | null;
  sourceLineRef: string | null;
  createdAt: string;
}

export type { TeachingCreditAdjustment, TeachingCreditLedgerEntry } from '@cuberoot/shared/teaching';

export interface TeachingCreditLedgerMutationResult {
  ledgerEntry: TeachingCreditLedgerEntry;
  studentPackage: TeachingStudentPackage;
}

export interface TeachingSessionTeacher {
  userId: number;
  displayName: string;
  role: 'lead' | 'assistant';
}

export interface TeachingAttendance {
  id: string;
  studentId: string;
  displayName: string | null;
  studentPackageId: string | null;
  status: TeachingAttendanceStatus;
  creditCost: number;
  notes: string;
  updatedAt: string;
}

export interface TeachingSessionSummary {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: TeachingSessionStatus;
  version: number;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  teachers: TeachingSessionTeacher[];
  attendanceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeachingSession extends TeachingSessionSummary {
  attendance: TeachingAttendance[];
}

export interface TeachingSessionCompletion {
  session: {
    id: string;
    status: 'completed';
    completedAt: string;
  };
  consumption: {
    attendanceCount: number;
    totalCredits: number;
  };
}

export interface TeachingLessonFeedback {
  id: string;
  sessionId: string;
  studentId: string;
  revision: number;
  visibility: TeachingFeedbackVisibility;
  summary: string;
  strengths: string | null;
  challenges: string | null;
  nextGoals: string | null;
  internalNotes: string | null;
  studentDisplayNameSnapshot: string;
  attendanceStatusSnapshot: TeachingAttendanceStatus;
  creditCostSnapshot: number;
  authorUserId: number | null;
  authorUserIdSnapshot: number;
  authorDisplayNameSnapshot: string;
  authorRoleSnapshot: TeachingOrganizationRole;
  publishedAt: string | null;
  createdAt: string;
}

export class TeachingApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'TeachingApiError';
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} response is invalid`);
  }
  return value as Record<string, unknown>;
}

function exactRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  const parsed = record(value, label);
  const actualKeys = Object.keys(parsed).sort();
  const expectedKeys = [...keys].sort();
  if (
    actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} response is invalid`);
  }
  return parsed;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return string(value, label);
}

function optionalNullableString(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  return string(value, label);
}

function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return value;
}

function integer(value: unknown, label: string, minimum = 0): number {
  const parsed = number(value, label);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return parsed;
}

function isoDate(value: unknown, label: string): string {
  const parsed = string(value, label);
  const date = new Date(`${parsed}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(parsed)
    || Number.isNaN(date.valueOf())
    || date.toISOString().slice(0, 10) !== parsed
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return parsed;
}

function enumValue<const T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  const parsed = string(value, label);
  if (!(values as readonly string[]).includes(parsed)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return parsed as T[number];
}

const POSTGRES_BIGINT_MAX = '9223372036854775807';

function positiveBigIntString(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (
    !/^[1-9]\d*$/.test(parsed)
    || parsed.length > POSTGRES_BIGINT_MAX.length
    || (parsed.length === POSTGRES_BIGINT_MAX.length && parsed > POSTGRES_BIGINT_MAX)
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return parsed;
}

function isoTimestamp(value: unknown, label: string): string {
  const parsed = string(value, label);
  const timestamp = Date.parse(parsed);
  if (Number.isNaN(timestamp) || new Date(timestamp).toISOString() !== parsed) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return parsed;
}

function jsonValue(value: unknown, label: string): TeachingJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => jsonValue(item, `${label}[${index}]`));
  const item = record(value, label);
  return Object.fromEntries(
    Object.entries(item).map(([key, nested]) => [key, jsonValue(nested, `${label}.${key}`)]),
  );
}

function nullableNumber(value: unknown, label: string): number | null {
  if (value === null) return null;
  return number(value, label);
}

function nullableInteger(value: unknown, label: string, minimum = 0): number | null {
  if (value === null) return null;
  return integer(value, label, minimum);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return value;
}

function organization(value: unknown): TeachingOrganizationAccess {
  const item = record(value, 'organization');
  return {
    id: string(item.id, 'organization.id'),
    slug: string(item.slug, 'organization.slug'),
    name: string(item.name, 'organization.name'),
    timezone: string(item.timezone, 'organization.timezone'),
    status: enumValue(item.status, TEACHING_ORGANIZATION_STATUSES, 'organization.status'),
    version: integer(item.version, 'organization.version'),
    role: enumValue(item.role, TEACHING_ORGANIZATION_ROLES, 'organization.role'),
  };
}

function operationsOverview(value: unknown): TeachingOperationsOverview {
  const item = exactRecord(
    value,
    ['range', 'sessions', 'attendance', 'creditConsumption', 'packages', 'training', 'teacherLoad'],
    'operationsOverview',
  );
  const range = exactRecord(item.range, ['fromDate', 'throughDate', 'timezone', 'days'], 'operationsOverview.range');
  const fromDate = isoDate(range.fromDate, 'operationsOverview.range.fromDate');
  const throughDate = isoDate(range.throughDate, 'operationsOverview.range.throughDate');
  const timezone = string(range.timezone, 'operationsOverview.range.timezone').trim();
  const days = integer(range.days, 'operationsOverview.range.days', 1);
  if (!timezone || days !== 30 || fromDate > throughDate) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'operationsOverview.range response is invalid');
  }

  const sessions = exactRecord(
    item.sessions,
    ['scheduled', 'inProgress', 'completed', 'cancelled', 'total'],
    'operationsOverview.sessions',
  );
  const parsedSessions = {
    scheduled: integer(sessions.scheduled, 'operationsOverview.sessions.scheduled'),
    inProgress: integer(sessions.inProgress, 'operationsOverview.sessions.inProgress'),
    completed: integer(sessions.completed, 'operationsOverview.sessions.completed'),
    cancelled: integer(sessions.cancelled, 'operationsOverview.sessions.cancelled'),
    total: integer(sessions.total, 'operationsOverview.sessions.total'),
  };
  if (
    parsedSessions.total
    !== parsedSessions.scheduled + parsedSessions.inProgress + parsedSessions.completed + parsedSessions.cancelled
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'operationsOverview.sessions response is invalid');
  }

  const attendance = exactRecord(
    item.attendance,
    ['expected', 'present', 'late', 'absent', 'excused', 'total'],
    'operationsOverview.attendance',
  );
  const parsedAttendance = {
    expected: integer(attendance.expected, 'operationsOverview.attendance.expected'),
    present: integer(attendance.present, 'operationsOverview.attendance.present'),
    late: integer(attendance.late, 'operationsOverview.attendance.late'),
    absent: integer(attendance.absent, 'operationsOverview.attendance.absent'),
    excused: integer(attendance.excused, 'operationsOverview.attendance.excused'),
    total: integer(attendance.total, 'operationsOverview.attendance.total'),
  };
  if (
    parsedAttendance.total
    !== parsedAttendance.expected
      + parsedAttendance.present
      + parsedAttendance.late
      + parsedAttendance.absent
      + parsedAttendance.excused
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'operationsOverview.attendance response is invalid');
  }

  if (!Array.isArray(item.creditConsumption)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'operationsOverview.creditConsumption response is invalid');
  }
  const creditConsumption = item.creditConsumption.map((value, index) => {
    const credit = exactRecord(
      value,
      ['creditUnit', 'creditType', 'amount'],
      `operationsOverview.creditConsumption[${index}]`,
    );
    const creditType = string(credit.creditType, `operationsOverview.creditConsumption[${index}].creditType`).trim();
    const amount = string(credit.amount, `operationsOverview.creditConsumption[${index}].amount`);
    if (!creditType || !/^(0|[1-9]\d*)$/.test(amount)) {
      throw new TeachingApiError('INVALID_RESPONSE', 502, `operationsOverview.creditConsumption[${index}] response is invalid`);
    }
    return {
      creditUnit: enumValue(
        credit.creditUnit,
        TEACHING_CREDIT_UNITS,
        `operationsOverview.creditConsumption[${index}].creditUnit`,
      ),
      creditType,
      amount,
    };
  });

  const packages = exactRecord(
    item.packages,
    ['active', 'lowBalance', 'expiringSoon'],
    'operationsOverview.packages',
  );
  const parsedPackages = {
    active: integer(packages.active, 'operationsOverview.packages.active'),
    lowBalance: integer(packages.lowBalance, 'operationsOverview.packages.lowBalance'),
    expiringSoon: integer(packages.expiringSoon, 'operationsOverview.packages.expiringSoon'),
  };
  if (parsedPackages.lowBalance > parsedPackages.active || parsedPackages.expiringSoon > parsedPackages.active) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'operationsOverview.packages response is invalid');
  }

  const training = exactRecord(
    item.training,
    ['assignments', 'studentTargets', 'targetsWithEvidence'],
    'operationsOverview.training',
  );
  const parsedTraining = {
    assignments: integer(training.assignments, 'operationsOverview.training.assignments'),
    studentTargets: integer(training.studentTargets, 'operationsOverview.training.studentTargets'),
    targetsWithEvidence: integer(training.targetsWithEvidence, 'operationsOverview.training.targetsWithEvidence'),
  };
  if (parsedTraining.targetsWithEvidence > parsedTraining.studentTargets) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'operationsOverview.training response is invalid');
  }

  if (!Array.isArray(item.teacherLoad) || item.teacherLoad.length > 10) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'operationsOverview.teacherLoad response is invalid');
  }
  const teacherLoad = item.teacherLoad.map((value, index) => {
    const teacher = exactRecord(
      value,
      ['displayName', 'sessionCount', 'completedSessionCount'],
      `operationsOverview.teacherLoad[${index}]`,
    );
    const displayName = string(teacher.displayName, `operationsOverview.teacherLoad[${index}].displayName`).trim();
    const sessionCount = integer(teacher.sessionCount, `operationsOverview.teacherLoad[${index}].sessionCount`);
    const completedSessionCount = integer(
      teacher.completedSessionCount,
      `operationsOverview.teacherLoad[${index}].completedSessionCount`,
    );
    if (!displayName || completedSessionCount > sessionCount) {
      throw new TeachingApiError('INVALID_RESPONSE', 502, `operationsOverview.teacherLoad[${index}] response is invalid`);
    }
    return { displayName, sessionCount, completedSessionCount };
  });

  return {
    range: { fromDate, throughDate, timezone, days },
    sessions: parsedSessions,
    attendance: parsedAttendance,
    creditConsumption,
    packages: parsedPackages,
    training: parsedTraining,
    teacherLoad,
  };
}

function student(value: unknown): TeachingStudent {
  const item = record(value, 'student');
  return {
    id: string(item.id, 'student.id'),
    accountUserId: nullableNumber(item.accountUserId, 'student.accountUserId'),
    externalRef: nullableString(item.externalRef, 'student.externalRef'),
    displayName: string(item.displayName, 'student.displayName'),
    status: enumValue(item.status, TEACHING_STUDENT_STATUSES, 'student.status'),
    createdAt: string(item.createdAt, 'student.createdAt'),
    updatedAt: string(item.updatedAt, 'student.updatedAt'),
  };
}

function campus(value: unknown): TeachingCampus {
  const item = record(value, 'campus');
  return {
    id: string(item.id, 'campus.id'),
    code: nullableString(item.code, 'campus.code'),
    name: string(item.name, 'campus.name'),
    timezone: nullableString(item.timezone, 'campus.timezone'),
    status: enumValue(item.status, TEACHING_CAMPUS_STATUSES, 'campus.status'),
    archivedAt: nullableString(item.archivedAt, 'campus.archivedAt'),
    createdAt: string(item.createdAt, 'campus.createdAt'),
    updatedAt: string(item.updatedAt, 'campus.updatedAt'),
  };
}

function group(value: unknown): TeachingGroup {
  const item = record(value, 'group');
  return {
    id: string(item.id, 'group.id'),
    campusId: nullableString(item.campusId, 'group.campusId'),
    code: nullableString(item.code, 'group.code'),
    name: string(item.name, 'group.name'),
    status: enumValue(item.status, TEACHING_GROUP_STATUSES, 'group.status'),
    archivedAt: nullableString(item.archivedAt, 'group.archivedAt'),
    createdAt: string(item.createdAt, 'group.createdAt'),
    updatedAt: string(item.updatedAt, 'group.updatedAt'),
  };
}

function member(value: unknown): TeachingMember {
  const item = record(value, 'member');
  return {
    userId: integer(item.userId, 'member.userId', 1),
    displayName: string(item.displayName, 'member.displayName'),
    avatarUrl: optionalNullableString(item.avatarUrl, 'member.avatarUrl'),
    role: enumValue(item.role, TEACHING_ORGANIZATION_ROLES, 'member.role'),
    status: enumValue(item.status, TEACHING_MEMBER_STATUSES, 'member.status'),
    joinedAt: optionalNullableString(item.joinedAt, 'member.joinedAt'),
    createdAt: optionalNullableString(item.createdAt, 'member.createdAt'),
  };
}

function studentGroupMembership(value: unknown): TeachingStudentGroupMembership {
  const item = record(value, 'membership');
  const studentItem = record(item.student, 'membership.student');
  return {
    id: string(item.id, 'membership.id'),
    groupId: string(item.groupId, 'membership.groupId'),
    effectiveFrom: string(item.effectiveFrom, 'membership.effectiveFrom'),
    effectiveTo: nullableString(item.effectiveTo, 'membership.effectiveTo'),
    createdAt: string(item.createdAt, 'membership.createdAt'),
    student: {
      id: string(studentItem.id, 'membership.student.id'),
      externalRef: nullableString(studentItem.externalRef, 'membership.student.externalRef'),
      displayName: string(studentItem.displayName, 'membership.student.displayName'),
      status: enumValue(studentItem.status, TEACHING_STUDENT_STATUSES, 'membership.student.status'),
    },
  };
}

const ASSIGNABLE_TEACHING_ROLES = ['owner', 'admin', 'teacher', 'assistant'] as const;

function teacherAssignment(value: unknown): TeachingTeacherAssignment {
  const item = record(value, 'assignment');
  const teacher = record(item.teacher, 'assignment.teacher');
  return {
    id: string(item.id, 'assignment.id'),
    teacherUserId: nullableNumber(item.teacherUserId, 'assignment.teacherUserId'),
    teacherUserIdSnapshot: integer(item.teacherUserIdSnapshot, 'assignment.teacherUserIdSnapshot', 1),
    groupId: nullableString(item.groupId, 'assignment.groupId'),
    studentId: nullableString(item.studentId, 'assignment.studentId'),
    effectiveFrom: string(item.effectiveFrom, 'assignment.effectiveFrom'),
    effectiveTo: nullableString(item.effectiveTo, 'assignment.effectiveTo'),
    createdAt: string(item.createdAt, 'assignment.createdAt'),
    teacher: {
      userId: nullableNumber(teacher.userId, 'assignment.teacher.userId'),
      displayName: string(teacher.displayName, 'assignment.teacher.displayName'),
      role: enumValue(teacher.role, ASSIGNABLE_TEACHING_ROLES, 'assignment.teacher.role'),
      status: teacher.status === null ? null : enumValue(teacher.status, TEACHING_MEMBER_STATUSES, 'assignment.teacher.status'),
    },
  };
}

function packageProduct(value: unknown): TeachingPackageProduct {
  const item = record(value, 'packageProduct');
  return {
    id: string(item.id, 'packageProduct.id'),
    code: string(item.code, 'packageProduct.code'),
    name: string(item.name, 'packageProduct.name'),
    status: enumValue(item.status, TEACHING_PACKAGE_PRODUCT_STATUSES, 'packageProduct.status'),
    creditUnit: enumValue(item.creditUnit, TEACHING_CREDIT_UNITS, 'packageProduct.creditUnit'),
    creditType: string(item.creditType, 'packageProduct.creditType'),
    totalCredits: integer(item.totalCredits, 'packageProduct.totalCredits', 1),
    validityDays: item.validityDays === null ? null : integer(item.validityDays, 'packageProduct.validityDays', 1),
    priceAmountMinor: integer(item.priceAmountMinor, 'packageProduct.priceAmountMinor'),
    currency: string(item.currency, 'packageProduct.currency'),
    createdAt: string(item.createdAt, 'packageProduct.createdAt'),
    updatedAt: string(item.updatedAt, 'packageProduct.updatedAt'),
  };
}

function studentPackage(value: unknown): TeachingStudentPackage {
  const item = exactRecord(
    value,
    [
      'id', 'studentId', 'productId', 'productCode', 'productName', 'creditUnit', 'creditType',
      'entitledCredits', 'remainingCredits', 'validityDays', 'priceAmountMinor', 'currency',
      'status', 'acquisitionType', 'validFrom', 'validUntil', 'sourceSystem', 'sourceRef',
      'sourceLineRef', 'createdAt',
    ],
    'studentPackage',
  );
  return {
    id: string(item.id, 'studentPackage.id'),
    studentId: string(item.studentId, 'studentPackage.studentId'),
    productId: string(item.productId, 'studentPackage.productId'),
    productCode: string(item.productCode, 'studentPackage.productCode'),
    productName: string(item.productName, 'studentPackage.productName'),
    creditUnit: enumValue(item.creditUnit, TEACHING_CREDIT_UNITS, 'studentPackage.creditUnit'),
    creditType: string(item.creditType, 'studentPackage.creditType'),
    entitledCredits: integer(item.entitledCredits, 'studentPackage.entitledCredits', 1),
    remainingCredits: integer(item.remainingCredits, 'studentPackage.remainingCredits'),
    validityDays: item.validityDays === null ? null : integer(item.validityDays, 'studentPackage.validityDays', 1),
    priceAmountMinor: integer(item.priceAmountMinor, 'studentPackage.priceAmountMinor'),
    currency: string(item.currency, 'studentPackage.currency'),
    status: enumValue(item.status, TEACHING_STUDENT_PACKAGE_STATUSES, 'studentPackage.status'),
    acquisitionType: enumValue(item.acquisitionType, TEACHING_PACKAGE_ACQUISITION_TYPES, 'studentPackage.acquisitionType'),
    validFrom: string(item.validFrom, 'studentPackage.validFrom'),
    validUntil: nullableString(item.validUntil, 'studentPackage.validUntil'),
    sourceSystem: nullableString(item.sourceSystem, 'studentPackage.sourceSystem'),
    sourceRef: nullableString(item.sourceRef, 'studentPackage.sourceRef'),
    sourceLineRef: nullableString(item.sourceLineRef, 'studentPackage.sourceLineRef'),
    createdAt: string(item.createdAt, 'studentPackage.createdAt'),
  };
}

function creditLedgerEntry(value: unknown): TeachingCreditLedgerEntry {
  const item = exactRecord(
    value,
    [
      'id', 'studentId', 'entryType', 'delta', 'attendanceId', 'sessionId', 'sourceSystem',
      'sourceRef', 'sourceLineRef', 'reversalOfLedgerId', 'reversedByLedgerId', 'reason',
      'actorRole', 'actorDisplayName', 'metadata', 'createdAt',
    ],
    'ledgerEntry',
  );
  const parsed: TeachingCreditLedgerEntry = {
    id: positiveBigIntString(item.id, 'ledgerEntry.id'),
    studentId: string(item.studentId, 'ledgerEntry.studentId'),
    entryType: enumValue(item.entryType, TEACHING_CREDIT_LEDGER_ENTRY_TYPES, 'ledgerEntry.entryType'),
    delta: integer(item.delta, 'ledgerEntry.delta', -1_000_000),
    attendanceId: nullableString(item.attendanceId, 'ledgerEntry.attendanceId'),
    sessionId: nullableString(item.sessionId, 'ledgerEntry.sessionId'),
    sourceSystem: nullableString(item.sourceSystem, 'ledgerEntry.sourceSystem'),
    sourceRef: nullableString(item.sourceRef, 'ledgerEntry.sourceRef'),
    sourceLineRef: nullableString(item.sourceLineRef, 'ledgerEntry.sourceLineRef'),
    reversalOfLedgerId: item.reversalOfLedgerId === null
      ? null
      : positiveBigIntString(item.reversalOfLedgerId, 'ledgerEntry.reversalOfLedgerId'),
    reversedByLedgerId: item.reversedByLedgerId === null
      ? null
      : positiveBigIntString(item.reversedByLedgerId, 'ledgerEntry.reversedByLedgerId'),
    reason: string(item.reason, 'ledgerEntry.reason'),
    actorRole: string(item.actorRole, 'ledgerEntry.actorRole'),
    actorDisplayName: string(item.actorDisplayName, 'ledgerEntry.actorDisplayName'),
    metadata: jsonValue(item.metadata, 'ledgerEntry.metadata'),
    createdAt: isoTimestamp(item.createdAt, 'ledgerEntry.createdAt'),
  };

  const hasSourcePair = parsed.sourceSystem !== null && parsed.sourceRef !== null;
  const hasNoSource = parsed.sourceSystem === null
    && parsed.sourceRef === null
    && parsed.sourceLineRef === null;
  const sourcesAreCanonical = (
    (parsed.sourceSystem === null || (
      parsed.sourceSystem.length >= 1
      && parsed.sourceSystem.length <= 64
      && parsed.sourceSystem.trim() === parsed.sourceSystem
    ))
    && (parsed.sourceRef === null || (
      parsed.sourceRef.length >= 1
      && parsed.sourceRef.length <= 160
      && parsed.sourceRef.trim() === parsed.sourceRef
    ))
    && (parsed.sourceLineRef === null || (
      parsed.sourceLineRef.length >= 1
      && parsed.sourceLineRef.length <= 160
      && parsed.sourceLineRef.trim() === parsed.sourceLineRef
    ))
  );
  const reasonIsCanonical = parsed.reason.length >= 1
    && parsed.reason.length <= 500
    && parsed.reason.trim() === parsed.reason;
  if (
    parsed.delta === 0
    || parsed.delta > 1_000_000
    || (parsed.sourceSystem === null) !== (parsed.sourceRef === null)
    || (parsed.sourceLineRef !== null && !hasSourcePair)
    || !sourcesAreCanonical
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'ledgerEntry response is invalid');
  }

  const hasAttendance = parsed.attendanceId !== null;
  const hasSession = parsed.sessionId !== null;
  const hasReversalTarget = parsed.reversalOfLedgerId !== null;
  const standardShape = !hasAttendance && !hasSession && !hasReversalTarget;
  const validEntryShape = (
    ((parsed.entryType === 'purchase' || parsed.entryType === 'grant') && parsed.delta > 0 && standardShape)
    || (parsed.entryType === 'consume' && parsed.delta < 0 && hasAttendance && hasSession && !hasReversalTarget)
    || (parsed.entryType === 'refund' && parsed.delta < 0 && standardShape && hasSourcePair && reasonIsCanonical)
    || (parsed.entryType === 'adjustment' && standardShape)
    || (parsed.entryType === 'expiration' && parsed.delta < 0 && standardShape)
    || (parsed.entryType === 'reversal' && parsed.delta !== 0 && !hasAttendance && !hasSession && hasReversalTarget && hasNoSource && reasonIsCanonical)
  );
  if (!validEntryShape) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'ledgerEntry response is invalid');
  }
  return parsed;
}

function creditAdjustment(value: unknown): TeachingCreditAdjustment {
  const item = exactRecord(value, ['ledgerEntry', 'student', 'studentPackage'], 'creditAdjustment');
  const adjustmentStudent = exactRecord(item.student, ['id', 'displayName'], 'creditAdjustment.student');
  const adjustmentPackage = exactRecord(
    item.studentPackage,
    ['id', 'productCode', 'productName', 'creditUnit', 'creditType'],
    'creditAdjustment.studentPackage',
  );
  const ledgerEntry = creditLedgerEntry(item.ledgerEntry);
  const studentId = string(adjustmentStudent.id, 'creditAdjustment.student.id');
  if (
    ledgerEntry.studentId !== studentId
    || !(['adjustment', 'refund', 'reversal', 'expiration'] as const).includes(
      ledgerEntry.entryType as 'adjustment' | 'refund' | 'reversal' | 'expiration',
    )
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'creditAdjustment response is invalid');
  }
  return {
    ledgerEntry,
    student: {
      id: studentId,
      displayName: string(adjustmentStudent.displayName, 'creditAdjustment.student.displayName'),
    },
    studentPackage: {
      id: string(adjustmentPackage.id, 'creditAdjustment.studentPackage.id'),
      productCode: string(adjustmentPackage.productCode, 'creditAdjustment.studentPackage.productCode'),
      productName: string(adjustmentPackage.productName, 'creditAdjustment.studentPackage.productName'),
      creditUnit: enumValue(
        adjustmentPackage.creditUnit,
        TEACHING_CREDIT_UNITS,
        'creditAdjustment.studentPackage.creditUnit',
      ),
      creditType: string(adjustmentPackage.creditType, 'creditAdjustment.studentPackage.creditType'),
    },
  };
}

function creditLedgerMutationResult(value: unknown): TeachingCreditLedgerMutationResult {
  const envelope = exactRecord(value, ['ledgerEntry', 'studentPackage'], 'credit ledger mutation');
  return {
    ledgerEntry: creditLedgerEntry(envelope.ledgerEntry),
    studentPackage: studentPackage(envelope.studentPackage),
  };
}

const TEACHING_SESSION_TEACHER_ROLES = ['lead', 'assistant'] as const;

function sessionTeacher(value: unknown): TeachingSessionTeacher {
  const item = record(value, 'session.teacher');
  return {
    userId: integer(item.userId, 'session.teacher.userId', 1),
    displayName: string(item.displayName, 'session.teacher.displayName'),
    role: enumValue(item.role, TEACHING_SESSION_TEACHER_ROLES, 'session.teacher.role'),
  };
}

function attendance(value: unknown): TeachingAttendance {
  const item = record(value, 'attendance');
  return {
    id: string(item.id, 'attendance.id'),
    studentId: string(item.studentId, 'attendance.studentId'),
    displayName: optionalNullableString(item.displayName, 'attendance.displayName'),
    studentPackageId: optionalNullableString(item.studentPackageId, 'attendance.studentPackageId'),
    status: enumValue(item.status, TEACHING_ATTENDANCE_STATUSES, 'attendance.status'),
    creditCost: integer(item.creditCost, 'attendance.creditCost', 1),
    notes: string(item.notes, 'attendance.notes'),
    updatedAt: string(item.updatedAt, 'attendance.updatedAt'),
  };
}

function lessonFeedback(value: unknown): TeachingLessonFeedback {
  const item = record(value, 'lesson feedback');
  return {
    id: string(item.id, 'lesson feedback.id'),
    sessionId: string(item.sessionId, 'lesson feedback.sessionId'),
    studentId: string(item.studentId, 'lesson feedback.studentId'),
    revision: integer(item.revision, 'lesson feedback.revision', 1),
    visibility: enumValue(item.visibility, TEACHING_FEEDBACK_VISIBILITIES, 'lesson feedback.visibility'),
    summary: string(item.summary, 'lesson feedback.summary'),
    strengths: nullableString(item.strengths, 'lesson feedback.strengths'),
    challenges: nullableString(item.challenges, 'lesson feedback.challenges'),
    nextGoals: nullableString(item.nextGoals, 'lesson feedback.nextGoals'),
    internalNotes: nullableString(item.internalNotes, 'lesson feedback.internalNotes'),
    studentDisplayNameSnapshot: string(item.studentDisplayNameSnapshot, 'lesson feedback.studentDisplayNameSnapshot'),
    attendanceStatusSnapshot: enumValue(item.attendanceStatusSnapshot, TEACHING_ATTENDANCE_STATUSES, 'lesson feedback.attendanceStatusSnapshot'),
    creditCostSnapshot: integer(item.creditCostSnapshot, 'lesson feedback.creditCostSnapshot'),
    authorUserId: nullableInteger(item.authorUserId, 'lesson feedback.authorUserId', 1),
    authorUserIdSnapshot: integer(item.authorUserIdSnapshot, 'lesson feedback.authorUserIdSnapshot', 1),
    authorDisplayNameSnapshot: string(item.authorDisplayNameSnapshot, 'lesson feedback.authorDisplayNameSnapshot'),
    authorRoleSnapshot: enumValue(item.authorRoleSnapshot, TEACHING_ORGANIZATION_ROLES, 'lesson feedback.authorRoleSnapshot'),
    publishedAt: nullableString(item.publishedAt, 'lesson feedback.publishedAt'),
    createdAt: string(item.createdAt, 'lesson feedback.createdAt'),
  };
}

function sessionSummary(value: unknown): TeachingSessionSummary {
  const item = record(value, 'session');
  if (!Array.isArray(item.teachers)) throw new TeachingApiError('INVALID_RESPONSE', 502, 'session.teachers is invalid');
  return {
    id: string(item.id, 'session.id'),
    title: string(item.title, 'session.title'),
    startsAt: string(item.startsAt, 'session.startsAt'),
    endsAt: string(item.endsAt, 'session.endsAt'),
    timezone: string(item.timezone, 'session.timezone'),
    status: enumValue(item.status, TEACHING_SESSION_STATUSES, 'session.status'),
    version: integer(item.version, 'session.version', 1),
    startedAt: nullableString(item.startedAt, 'session.startedAt'),
    completedAt: nullableString(item.completedAt, 'session.completedAt'),
    cancelledAt: nullableString(item.cancelledAt, 'session.cancelledAt'),
    teachers: item.teachers.map(sessionTeacher),
    attendanceCount: integer(item.attendanceCount, 'session.attendanceCount'),
    createdAt: string(item.createdAt, 'session.createdAt'),
    updatedAt: string(item.updatedAt, 'session.updatedAt'),
  };
}

function sessionDetail(value: unknown): TeachingSession {
  const item = record(value, 'session');
  if (!Array.isArray(item.attendance)) throw new TeachingApiError('INVALID_RESPONSE', 502, 'session.attendance is invalid');
  const parsedAttendance = item.attendance.map(attendance);
  return {
    ...sessionSummary({ ...item, attendanceCount: item.attendanceCount ?? parsedAttendance.length }),
    attendance: parsedAttendance,
  };
}

function trainingTemplate(value: unknown): TeachingTrainingTemplate {
  const item = record(value, 'trainingTemplate');
  return {
    id: string(item.id, 'trainingTemplate.id'),
    organizationId: string(item.organizationId, 'trainingTemplate.organizationId'),
    name: string(item.name, 'trainingTemplate.name'),
    description: string(item.description, 'trainingTemplate.description'),
    status: enumValue(item.status, TRAINING_TEMPLATE_STATUSES, 'trainingTemplate.status'),
    latestVersionNumber: nullableInteger(item.latestVersionNumber, 'trainingTemplate.latestVersionNumber', 1),
    createdAt: string(item.createdAt, 'trainingTemplate.createdAt'),
    updatedAt: string(item.updatedAt, 'trainingTemplate.updatedAt'),
  };
}

function trainingToolConfig(value: unknown): { schemaVersion: 1 } {
  const item = record(value, 'trainingTemplateVersion.toolConfig');
  if (item.schemaVersion !== 1 || Object.keys(item).some((key) => key !== 'schemaVersion')) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'trainingTemplateVersion.toolConfig is invalid');
  }
  return { schemaVersion: 1 };
}

function trainingTemplateVersion(value: unknown): TeachingTrainingTemplateVersion {
  const item = record(value, 'trainingTemplateVersion');
  const source = enumValue(item.source, TRAINING_EVIDENCE_SOURCES, 'trainingTemplateVersion.source');
  const activity = string(item.activity, 'trainingTemplateVersion.activity');
  if (!isTrainingSourceActivity(source, activity)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'trainingTemplateVersion.activity is invalid');
  }
  return {
    id: string(item.id, 'trainingTemplateVersion.id'),
    organizationId: string(item.organizationId, 'trainingTemplateVersion.organizationId'),
    templateId: string(item.templateId, 'trainingTemplateVersion.templateId'),
    versionNumber: integer(item.versionNumber, 'trainingTemplateVersion.versionNumber', 1),
    title: string(item.title, 'trainingTemplateVersion.title'),
    instructions: string(item.instructions, 'trainingTemplateVersion.instructions'),
    source,
    activity,
    toolConfig: trainingToolConfig(item.toolConfig),
    publishedAt: string(item.publishedAt, 'trainingTemplateVersion.publishedAt'),
  };
}

function trainingAssignment(value: unknown): TeachingTrainingAssignment {
  const item = record(value, 'trainingAssignment');
  return {
    id: string(item.id, 'trainingAssignment.id'),
    organizationId: string(item.organizationId, 'trainingAssignment.organizationId'),
    templateVersionId: string(item.templateVersionId, 'trainingAssignment.templateVersionId'),
    title: string(item.title, 'trainingAssignment.title'),
    instructions: string(item.instructions, 'trainingAssignment.instructions'),
    status: enumValue(item.status, TRAINING_ASSIGNMENT_STATUSES, 'trainingAssignment.status'),
    scheduleKind: enumValue(item.scheduleKind, TRAINING_SCHEDULE_KINDS, 'trainingAssignment.scheduleKind'),
    expectedCount: integer(item.expectedCount, 'trainingAssignment.expectedCount', 1),
    timezoneSnapshot: string(item.timezoneSnapshot, 'trainingAssignment.timezoneSnapshot'),
    startsAt: string(item.startsAt, 'trainingAssignment.startsAt'),
    endsAt: nullableString(item.endsAt, 'trainingAssignment.endsAt'),
    publishedAt: nullableString(item.publishedAt, 'trainingAssignment.publishedAt'),
    closedAt: nullableString(item.closedAt, 'trainingAssignment.closedAt'),
    createdAt: string(item.createdAt, 'trainingAssignment.createdAt'),
    updatedAt: string(item.updatedAt, 'trainingAssignment.updatedAt'),
  };
}

function trainingGoal(value: unknown): TeachingTrainingAssignmentGoalMetric {
  const item = record(value, 'trainingGoal');
  return {
    id: string(item.id, 'trainingGoal.id'),
    organizationId: string(item.organizationId, 'trainingGoal.organizationId'),
    assignmentId: string(item.assignmentId, 'trainingGoal.assignmentId'),
    metricKey: enumValue(item.metricKey, TRAINING_GOAL_METRIC_KEYS, 'trainingGoal.metricKey'),
    operator: enumValue(item.operator, TRAINING_GOAL_OPERATORS, 'trainingGoal.operator'),
    targetValue: integer(item.targetValue, 'trainingGoal.targetValue'),
  };
}

function trainingAssignmentDetail(value: unknown): TeachingTrainingAssignmentDetail {
  const item = record(value, 'trainingAssignmentDetail');
  if (!Array.isArray(item.goals)) throw new TeachingApiError('INVALID_RESPONSE', 502, 'trainingAssignmentDetail.goals is invalid');
  return {
    assignment: trainingAssignment(item.assignment),
    templateVersion: trainingTemplateVersion(item.templateVersion),
    goals: item.goals.map(trainingGoal),
  };
}

function trainingTarget(value: unknown): TeachingTrainingAssignmentTarget {
  const item = record(value, 'trainingTarget');
  const base = {
    id: string(item.id, 'trainingTarget.id'),
    organizationId: string(item.organizationId, 'trainingTarget.organizationId'),
    assignmentId: string(item.assignmentId, 'trainingTarget.assignmentId'),
    evidenceCount: string(item.evidenceCount, 'trainingTarget.evidenceCount'),
    firstEvidenceAt: nullableString(item.firstEvidenceAt, 'trainingTarget.firstEvidenceAt'),
    lastEvidenceAt: nullableString(item.lastEvidenceAt, 'trainingTarget.lastEvidenceAt'),
    latestReviewRevision: integer(item.latestReviewRevision, 'trainingTarget.latestReviewRevision'),
    latestReviewStatus: item.latestReviewStatus === null
      ? null
      : enumValue(item.latestReviewStatus, TRAINING_REVIEW_STATUSES, 'trainingTarget.latestReviewStatus'),
  };
  const targetKind = enumValue(item.targetKind, ['group', 'student'] as const, 'trainingTarget.targetKind');
  if (targetKind === 'group') {
    return {
      ...base,
      targetKind,
      groupId: string(item.groupId, 'trainingTarget.groupId'),
      sourceGroupId: null,
      studentId: null,
      groupNameSnapshot: string(item.groupNameSnapshot, 'trainingTarget.groupNameSnapshot'),
      studentDisplayNameSnapshot: null,
      studentExternalRefSnapshot: null,
    };
  }
  return {
    ...base,
    targetKind,
    groupId: null,
    sourceGroupId: nullableString(item.sourceGroupId, 'trainingTarget.sourceGroupId'),
    studentId: string(item.studentId, 'trainingTarget.studentId'),
    groupNameSnapshot: null,
    studentDisplayNameSnapshot: string(item.studentDisplayNameSnapshot, 'trainingTarget.studentDisplayNameSnapshot'),
    studentExternalRefSnapshot: nullableString(item.studentExternalRefSnapshot, 'trainingTarget.studentExternalRefSnapshot'),
  };
}

function trainingEvidence(value: unknown): TeachingTrainingEvidence {
  const item = record(value, 'trainingEvidence');
  const source = enumValue(item.source, TRAINING_EVIDENCE_SOURCES, 'trainingEvidence.source');
  const activity = string(item.activity, 'trainingEvidence.activity');
  if (!isTrainingSourceActivity(source, activity)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'trainingEvidence.activity is invalid');
  }
  return {
    id: string(item.id, 'trainingEvidence.id'),
    organizationId: string(item.organizationId, 'trainingEvidence.organizationId'),
    studentId: string(item.studentId, 'trainingEvidence.studentId'),
    source,
    sourceEventId: string(item.sourceEventId, 'trainingEvidence.sourceEventId'),
    trustLevel: enumValue(item.trustLevel, TRAINING_TRUST_LEVELS, 'trainingEvidence.trustLevel'),
    occurredAt: string(item.occurredAt, 'trainingEvidence.occurredAt'),
    timezoneSnapshot: string(item.timezoneSnapshot, 'trainingEvidence.timezoneSnapshot'),
    localDate: string(item.localDate, 'trainingEvidence.localDate'),
    activity,
    durationMs: nullableInteger(item.durationMs, 'trainingEvidence.durationMs'),
    resultMs: nullableInteger(item.resultMs, 'trainingEvidence.resultMs'),
    success: item.success === null ? null : boolean(item.success, 'trainingEvidence.success'),
    payloadVersion: integer(item.payloadVersion, 'trainingEvidence.payloadVersion', 1),
    createdAt: string(item.createdAt, 'trainingEvidence.createdAt'),
  };
}

const TRAINING_REVIEWER_ROLES = ['owner', 'admin', 'teacher', 'assistant'] as const;

function trainingReview(value: unknown): TeachingTrainingSubmissionReview {
  const item = record(value, 'trainingReview');
  return {
    id: string(item.id, 'trainingReview.id'),
    organizationId: string(item.organizationId, 'trainingReview.organizationId'),
    assignmentId: string(item.assignmentId, 'trainingReview.assignmentId'),
    studentId: string(item.studentId, 'trainingReview.studentId'),
    revision: integer(item.revision, 'trainingReview.revision', 1),
    reviewerUserId: nullableInteger(item.reviewerUserId, 'trainingReview.reviewerUserId', 1),
    reviewerUserIdSnapshot: integer(item.reviewerUserIdSnapshot, 'trainingReview.reviewerUserIdSnapshot', 1),
    reviewerDisplayNameSnapshot: string(item.reviewerDisplayNameSnapshot, 'trainingReview.reviewerDisplayNameSnapshot'),
    reviewerRoleSnapshot: enumValue(item.reviewerRoleSnapshot, TRAINING_REVIEWER_ROLES, 'trainingReview.reviewerRoleSnapshot'),
    status: enumValue(item.status, TRAINING_REVIEW_STATUSES, 'trainingReview.status'),
    rating: nullableInteger(item.rating, 'trainingReview.rating'),
    feedback: string(item.feedback, 'trainingReview.feedback'),
    createdAt: string(item.createdAt, 'trainingReview.createdAt'),
  };
}

const WEEKLY_REPORT_AUTHOR_ROLES = ['owner', 'admin', 'teacher', 'assistant'] as const;

function weeklyReportTrainingDimension(value: unknown): TeachingWeeklyReportTrainingDimension {
  const item = record(value, 'weeklyReport.aggregate.training.dimension');
  const source = enumValue(item.source, TRAINING_EVIDENCE_SOURCES, 'weeklyReport.aggregate.training.dimension.source');
  const activity = string(item.activity, 'weeklyReport.aggregate.training.dimension.activity');
  if (!isTrainingSourceActivity(source, activity)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'weeklyReport.aggregate.training.dimension.activity is invalid');
  }
  return {
    source,
    activity,
    trustLevel: enumValue(item.trustLevel, TRAINING_TRUST_LEVELS, 'weeklyReport.aggregate.training.dimension.trustLevel'),
    evidenceCount: string(item.evidenceCount, 'weeklyReport.aggregate.training.dimension.evidenceCount'),
    durationMs: string(item.durationMs, 'weeklyReport.aggregate.training.dimension.durationMs'),
    successCount: string(item.successCount, 'weeklyReport.aggregate.training.dimension.successCount'),
  };
}

function weeklyReportAssignment(value: unknown): TeachingWeeklyReportAssignmentItem {
  const item = record(value, 'weeklyReport.aggregate.assignments.assignment');
  return {
    assignmentId: string(item.assignmentId, 'weeklyReport.aggregate.assignments.assignment.assignmentId'),
    title: string(item.title, 'weeklyReport.aggregate.assignments.assignment.title'),
    status: enumValue(item.status, TRAINING_ASSIGNMENT_STATUSES, 'weeklyReport.aggregate.assignments.assignment.status'),
    scheduleKind: enumValue(item.scheduleKind, TRAINING_SCHEDULE_KINDS, 'weeklyReport.aggregate.assignments.assignment.scheduleKind'),
    expectedCount: integer(item.expectedCount, 'weeklyReport.aggregate.assignments.assignment.expectedCount', 1),
    evidenceCount: string(item.evidenceCount, 'weeklyReport.aggregate.assignments.assignment.evidenceCount'),
    latestReviewRevision: integer(item.latestReviewRevision, 'weeklyReport.aggregate.assignments.assignment.latestReviewRevision'),
    latestReviewStatus: item.latestReviewStatus === null
      ? null
      : enumValue(item.latestReviewStatus, TRAINING_REVIEW_STATUSES, 'weeklyReport.aggregate.assignments.assignment.latestReviewStatus'),
    startsAt: string(item.startsAt, 'weeklyReport.aggregate.assignments.assignment.startsAt'),
    endsAt: nullableString(item.endsAt, 'weeklyReport.aggregate.assignments.assignment.endsAt'),
  };
}

function weeklyReportLessonFeedback(value: unknown): TeachingWeeklyReportLessonFeedbackItem {
  const item = record(value, 'weeklyReport.aggregate.lessonFeedback.feedback');
  return {
    feedbackId: string(item.feedbackId, 'weeklyReport.aggregate.lessonFeedback.feedback.feedbackId'),
    sessionId: string(item.sessionId, 'weeklyReport.aggregate.lessonFeedback.feedback.sessionId'),
    revision: integer(item.revision, 'weeklyReport.aggregate.lessonFeedback.feedback.revision', 1),
    visibility: enumValue(item.visibility, TEACHING_FEEDBACK_VISIBILITIES, 'weeklyReport.aggregate.lessonFeedback.feedback.visibility'),
    summary: string(item.summary, 'weeklyReport.aggregate.lessonFeedback.feedback.summary'),
    strengths: nullableString(item.strengths, 'weeklyReport.aggregate.lessonFeedback.feedback.strengths'),
    challenges: nullableString(item.challenges, 'weeklyReport.aggregate.lessonFeedback.feedback.challenges'),
    nextGoals: nullableString(item.nextGoals, 'weeklyReport.aggregate.lessonFeedback.feedback.nextGoals'),
    publishedAt: nullableString(item.publishedAt, 'weeklyReport.aggregate.lessonFeedback.feedback.publishedAt'),
    createdAt: string(item.createdAt, 'weeklyReport.aggregate.lessonFeedback.feedback.createdAt'),
  };
}

function weeklyReportAggregate(value: unknown): TeachingWeeklyReportAggregate {
  const aggregate = record(value, 'weeklyReport.aggregate');
  const attendance = record(aggregate.attendance, 'weeklyReport.aggregate.attendance');
  const credits = record(aggregate.credits, 'weeklyReport.aggregate.credits');
  const training = record(aggregate.training, 'weeklyReport.aggregate.training');
  const assignments = record(aggregate.assignments, 'weeklyReport.aggregate.assignments');
  const lessonFeedback = record(aggregate.lessonFeedback, 'weeklyReport.aggregate.lessonFeedback');
  if (!Array.isArray(training.dimensions)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'weeklyReport.aggregate.training.dimensions is invalid');
  }
  if (!Array.isArray(assignments.assignments)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'weeklyReport.aggregate.assignments.assignments is invalid');
  }
  if (!Array.isArray(lessonFeedback.feedback)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'weeklyReport.aggregate.lessonFeedback.feedback is invalid');
  }
  return {
    attendance: {
      sessionCount: integer(attendance.sessionCount, 'weeklyReport.aggregate.attendance.sessionCount'),
      completedSessionCount: integer(attendance.completedSessionCount, 'weeklyReport.aggregate.attendance.completedSessionCount'),
      presentCount: integer(attendance.presentCount, 'weeklyReport.aggregate.attendance.presentCount'),
      lateCount: integer(attendance.lateCount, 'weeklyReport.aggregate.attendance.lateCount'),
      absentCount: integer(attendance.absentCount, 'weeklyReport.aggregate.attendance.absentCount'),
      excusedCount: integer(attendance.excusedCount, 'weeklyReport.aggregate.attendance.excusedCount'),
    },
    credits: {
      ledgerEntryCount: integer(credits.ledgerEntryCount, 'weeklyReport.aggregate.credits.ledgerEntryCount'),
      consumedCredits: string(credits.consumedCredits, 'weeklyReport.aggregate.credits.consumedCredits'),
      creditedCredits: string(credits.creditedCredits, 'weeklyReport.aggregate.credits.creditedCredits'),
      netCreditDelta: string(credits.netCreditDelta, 'weeklyReport.aggregate.credits.netCreditDelta'),
    },
    training: {
      activeDayCount: integer(training.activeDayCount, 'weeklyReport.aggregate.training.activeDayCount'),
      evidenceCount: string(training.evidenceCount, 'weeklyReport.aggregate.training.evidenceCount'),
      durationMs: string(training.durationMs, 'weeklyReport.aggregate.training.durationMs'),
      successCount: string(training.successCount, 'weeklyReport.aggregate.training.successCount'),
      dimensions: training.dimensions.map(weeklyReportTrainingDimension),
    },
    assignments: {
      assignmentCount: integer(assignments.assignmentCount, 'weeklyReport.aggregate.assignments.assignmentCount'),
      assignments: assignments.assignments.map(weeklyReportAssignment),
    },
    lessonFeedback: {
      feedbackCount: integer(lessonFeedback.feedbackCount, 'weeklyReport.aggregate.lessonFeedback.feedbackCount'),
      feedback: lessonFeedback.feedback.map(weeklyReportLessonFeedback),
    },
  };
}

function weeklyReportSummary(value: unknown): TeachingWeeklyReportSummary {
  const item = record(value, 'weeklyReport');
  return {
    id: string(item.id, 'weeklyReport.id'),
    organizationId: string(item.organizationId, 'weeklyReport.organizationId'),
    studentId: string(item.studentId, 'weeklyReport.studentId'),
    studentDisplayNameSnapshot: string(item.studentDisplayNameSnapshot, 'weeklyReport.studentDisplayNameSnapshot'),
    studentExternalRefSnapshot: nullableString(item.studentExternalRefSnapshot, 'weeklyReport.studentExternalRefSnapshot'),
    weekStart: string(item.weekStart, 'weeklyReport.weekStart'),
    weekEnd: string(item.weekEnd, 'weeklyReport.weekEnd'),
    timezoneSnapshot: string(item.timezoneSnapshot, 'weeklyReport.timezoneSnapshot'),
    revision: integer(item.revision, 'weeklyReport.revision', 1),
    status: enumValue(item.status, TEACHING_WEEKLY_REPORT_STATUSES, 'weeklyReport.status'),
    visibility: enumValue(item.visibility, TEACHING_WEEKLY_REPORT_VISIBILITIES, 'weeklyReport.visibility'),
    teacherSummary: string(item.teacherSummary, 'weeklyReport.teacherSummary'),
    nextWeekPlan: string(item.nextWeekPlan, 'weeklyReport.nextWeekPlan'),
    generatedByUserId: nullableInteger(item.generatedByUserId, 'weeklyReport.generatedByUserId', 1),
    generatedByUserIdSnapshot: integer(item.generatedByUserIdSnapshot, 'weeklyReport.generatedByUserIdSnapshot', 1),
    generatedByDisplayNameSnapshot: string(item.generatedByDisplayNameSnapshot, 'weeklyReport.generatedByDisplayNameSnapshot'),
    generatedByRoleSnapshot: enumValue(item.generatedByRoleSnapshot, WEEKLY_REPORT_AUTHOR_ROLES, 'weeklyReport.generatedByRoleSnapshot'),
    generatedAt: string(item.generatedAt, 'weeklyReport.generatedAt'),
    publishedByUserId: nullableInteger(item.publishedByUserId, 'weeklyReport.publishedByUserId', 1),
    publishedByUserIdSnapshot: nullableInteger(item.publishedByUserIdSnapshot, 'weeklyReport.publishedByUserIdSnapshot', 1),
    publishedByDisplayNameSnapshot: nullableString(item.publishedByDisplayNameSnapshot, 'weeklyReport.publishedByDisplayNameSnapshot'),
    publishedByRoleSnapshot: item.publishedByRoleSnapshot === null
      ? null
      : enumValue(item.publishedByRoleSnapshot, WEEKLY_REPORT_AUTHOR_ROLES, 'weeklyReport.publishedByRoleSnapshot'),
    publishedAt: nullableString(item.publishedAt, 'weeklyReport.publishedAt'),
    createdAt: string(item.createdAt, 'weeklyReport.createdAt'),
    updatedAt: string(item.updatedAt, 'weeklyReport.updatedAt'),
  };
}

function weeklyReport(value: unknown): TeachingWeeklyReport {
  const item = record(value, 'weeklyReport');
  return { ...weeklyReportSummary(item), aggregate: weeklyReportAggregate(item.aggregate) };
}

function learningRelationship(value: unknown): TeachingLearningContext['relationships'][number] {
  const item = record(value, 'learningContext.relationship');
  const kind = enumValue(item.kind, ['student', 'guardian'] as const, 'learningContext.relationship.kind');
  if (kind === 'student') return { kind };
  return {
    kind,
    guardianLinkId: string(item.guardianLinkId, 'learningContext.relationship.guardianLinkId'),
    relationship: string(item.relationship, 'learningContext.relationship.relationship'),
  };
}

function learningContext(value: unknown): TeachingLearningContext {
  const item = record(value, 'learningContext');
  const organizationItem = record(item.organization, 'learningContext.organization');
  const studentItem = record(item.student, 'learningContext.student');
  if (!Array.isArray(item.relationships) || item.relationships.length === 0) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learningContext.relationships is invalid');
  }
  return {
    organization: {
      slug: string(organizationItem.slug, 'learningContext.organization.slug'),
      name: string(organizationItem.name, 'learningContext.organization.name'),
    },
    student: {
      id: string(studentItem.id, 'learningContext.student.id'),
      displayName: string(studentItem.displayName, 'learningContext.student.displayName'),
    },
    relationships: item.relationships.map(learningRelationship),
  };
}

function conversationActor(value: unknown, label: string): TeachingConversationActorSnapshot {
  const item = record(value, label);
  return {
    displayName: string(item.displayName, `${label}.displayName`),
    role: enumValue(item.role, TEACHING_CONVERSATION_ACTOR_ROLES, `${label}.role`),
    relationship: nullableString(item.relationship, `${label}.relationship`),
  };
}

function conversationSummary(value: unknown): TeachingConversationSummary {
  const item = record(value, 'conversation');
  const organizationItem = record(item.organization, 'conversation.organization');
  const studentItem = record(item.student, 'conversation.student');
  return {
    id: string(item.id, 'conversation.id'),
    organization: {
      slug: string(organizationItem.slug, 'conversation.organization.slug'),
      name: string(organizationItem.name, 'conversation.organization.name'),
    },
    student: {
      id: string(studentItem.id, 'conversation.student.id'),
      displayName: string(studentItem.displayName, 'conversation.student.displayName'),
    },
    subject: string(item.subject, 'conversation.subject'),
    lastMessageSequence: integer(item.lastMessageSequence, 'conversation.lastMessageSequence', 1),
    lastMessageAt: string(item.lastMessageAt, 'conversation.lastMessageAt'),
    createdAt: string(item.createdAt, 'conversation.createdAt'),
    createdBy: conversationActor(item.createdBy, 'conversation.createdBy'),
    lastReadSequence: integer(item.lastReadSequence, 'conversation.lastReadSequence'),
    unreadCount: integer(item.unreadCount, 'conversation.unreadCount'),
  };
}

function conversationMessage(value: unknown): TeachingConversationMessage {
  const item = record(value, 'conversationMessage');
  return {
    id: string(item.id, 'conversationMessage.id'),
    conversationId: string(item.conversationId, 'conversationMessage.conversationId'),
    sequence: integer(item.sequence, 'conversationMessage.sequence', 1),
    body: string(item.body, 'conversationMessage.body'),
    author: conversationActor(item.author, 'conversationMessage.author'),
    createdAt: string(item.createdAt, 'conversationMessage.createdAt'),
  };
}

function conversationReplyState(
  value: unknown,
): ReplyTeachingConversationResponse['conversation'] {
  const item = record(value, 'conversation reply state');
  return {
    id: string(item.id, 'conversation reply state.id'),
    lastMessageSequence: integer(item.lastMessageSequence, 'conversation reply state.lastMessageSequence', 1),
    lastMessageAt: string(item.lastMessageAt, 'conversation reply state.lastMessageAt'),
    lastReadSequence: integer(item.lastReadSequence, 'conversation reply state.lastReadSequence'),
    unreadCount: integer(item.unreadCount, 'conversation reply state.unreadCount'),
  };
}

function learnerWeeklyReport(value: unknown, requireAggregate: boolean): TeachingLearnerWeeklyReport {
  const item = record(value, 'learnerWeeklyReport');
  const visibility = enumValue(
    item.visibility,
    ['student', 'student_and_guardians'] as const,
    'learnerWeeklyReport.visibility',
  );
  if (item.status !== 'published') {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learnerWeeklyReport.status is invalid');
  }
  if (requireAggregate && item.aggregate === undefined) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learnerWeeklyReport.aggregate is invalid');
  }
  return {
    id: string(item.id, 'learnerWeeklyReport.id'),
    studentId: string(item.studentId, 'learnerWeeklyReport.studentId'),
    studentDisplayNameSnapshot: string(item.studentDisplayNameSnapshot, 'learnerWeeklyReport.studentDisplayNameSnapshot'),
    weekStart: string(item.weekStart, 'learnerWeeklyReport.weekStart'),
    weekEnd: string(item.weekEnd, 'learnerWeeklyReport.weekEnd'),
    timezoneSnapshot: string(item.timezoneSnapshot, 'learnerWeeklyReport.timezoneSnapshot'),
    revision: integer(item.revision, 'learnerWeeklyReport.revision', 1),
    status: 'published',
    visibility,
    teacherSummary: string(item.teacherSummary, 'learnerWeeklyReport.teacherSummary'),
    nextWeekPlan: string(item.nextWeekPlan, 'learnerWeeklyReport.nextWeekPlan'),
    publishedByDisplayNameSnapshot: string(item.publishedByDisplayNameSnapshot, 'learnerWeeklyReport.publishedByDisplayNameSnapshot'),
    publishedByRoleSnapshot: enumValue(item.publishedByRoleSnapshot, WEEKLY_REPORT_AUTHOR_ROLES, 'learnerWeeklyReport.publishedByRoleSnapshot'),
    publishedAt: string(item.publishedAt, 'learnerWeeklyReport.publishedAt'),
    ...(item.aggregate === undefined ? {} : { aggregate: weeklyReportAggregate(item.aggregate) }),
  };
}

function learnerLessonFeedback(value: unknown): TeachingLearnerLessonFeedback {
  const item = record(value, 'learnerLessonFeedback');
  return {
    id: string(item.id, 'learnerLessonFeedback.id'),
    sessionId: string(item.sessionId, 'learnerLessonFeedback.sessionId'),
    studentId: string(item.studentId, 'learnerLessonFeedback.studentId'),
    revision: integer(item.revision, 'learnerLessonFeedback.revision', 1),
    visibility: enumValue(
      item.visibility,
      ['student', 'student_and_guardians'] as const,
      'learnerLessonFeedback.visibility',
    ),
    summary: string(item.summary, 'learnerLessonFeedback.summary'),
    strengths: nullableString(item.strengths, 'learnerLessonFeedback.strengths'),
    challenges: nullableString(item.challenges, 'learnerLessonFeedback.challenges'),
    nextGoals: nullableString(item.nextGoals, 'learnerLessonFeedback.nextGoals'),
    studentDisplayNameSnapshot: string(item.studentDisplayNameSnapshot, 'learnerLessonFeedback.studentDisplayNameSnapshot'),
    attendanceStatusSnapshot: enumValue(item.attendanceStatusSnapshot, TEACHING_ATTENDANCE_STATUSES, 'learnerLessonFeedback.attendanceStatusSnapshot'),
    authorDisplayNameSnapshot: string(item.authorDisplayNameSnapshot, 'learnerLessonFeedback.authorDisplayNameSnapshot'),
    authorRoleSnapshot: enumValue(item.authorRoleSnapshot, WEEKLY_REPORT_AUTHOR_ROLES, 'learnerLessonFeedback.authorRoleSnapshot'),
    publishedAt: string(item.publishedAt, 'learnerLessonFeedback.publishedAt'),
    createdAt: string(item.createdAt, 'learnerLessonFeedback.createdAt'),
  };
}

function bindingInvite(value: unknown): TeachingStudentAccountBindingInvite {
  const item = record(value, 'bindingInvite');
  return {
    id: string(item.id, 'bindingInvite.id'),
    organizationId: string(item.organizationId, 'bindingInvite.organizationId'),
    studentId: string(item.studentId, 'bindingInvite.studentId'),
    status: enumValue(item.status, ['pending', 'expired', 'revoked', 'consumed'] as const, 'bindingInvite.status'),
    expiresAt: string(item.expiresAt, 'bindingInvite.expiresAt'),
    expiredAt: nullableString(item.expiredAt, 'bindingInvite.expiredAt'),
    consumedAt: nullableString(item.consumedAt, 'bindingInvite.consumedAt'),
    revokedAt: nullableString(item.revokedAt, 'bindingInvite.revokedAt'),
    createdAt: string(item.createdAt, 'bindingInvite.createdAt'),
  };
}

function selfTrainingAssignment(value: unknown): TeachingSelfTrainingAssignment {
  const item = record(value, 'selfTrainingAssignment');
  const templateItem = record(item.template, 'selfTrainingAssignment.template');
  const target = trainingTarget(item.target);
  if (target.targetKind !== 'student') {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'selfTrainingAssignment.target is invalid');
  }
  if (!Array.isArray(item.goals)) throw new TeachingApiError('INVALID_RESPONSE', 502, 'selfTrainingAssignment.goals is invalid');
  return {
    assignment: trainingAssignment(item.assignment),
    target,
    template: {
      id: string(templateItem.id, 'selfTrainingAssignment.template.id'),
      name: string(templateItem.name, 'selfTrainingAssignment.template.name'),
    },
    templateVersion: trainingTemplateVersion(item.templateVersion),
    goals: item.goals.map(trainingGoal),
  };
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = getSessionToken();
  if (!token) throw new TeachingApiError('UNAUTHENTICATED', 401, 'Authentication required');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(apiUrl(path), {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    const payload = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      const envelope = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
      const detail = envelope.error && typeof envelope.error === 'object' && !Array.isArray(envelope.error)
        ? envelope.error as Record<string, unknown>
        : {};
      throw new TeachingApiError(
        typeof detail.code === 'string' ? detail.code : 'REQUEST_FAILED',
        response.status,
        typeof detail.message === 'string' ? detail.message : `Teaching request failed (${response.status})`,
        typeof detail.requestId === 'string' ? detail.requestId : null,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof TeachingApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new TeachingApiError('TIMEOUT', 408, 'Teaching request timed out');
    }
    throw new TeachingApiError('NETWORK_ERROR', 0, 'Teaching service is unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

async function post(path: string, body: unknown, idempotencyKey: string): Promise<unknown> {
  return request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}

async function postWithoutIdempotency(path: string, body: unknown): Promise<unknown> {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function page<T>(value: unknown, key: string, parse: (item: unknown) => T): TeachingPage<T> {
  const envelope = record(value, `${key} page`);
  if (!Array.isArray(envelope[key])) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${key} response is invalid`);
  }
  return {
    items: envelope[key].map(parse),
    total: integer(envelope.total, `${key}.total`),
    page: integer(envelope.page, `${key}.page`, 1),
    pageSize: integer(envelope.pageSize, `${key}.pageSize`, 1),
  };
}

function exactPage<T>(value: unknown, key: string, parse: (item: unknown) => T): TeachingPage<T> {
  const envelope = exactRecord(value, [key, 'total', 'page', 'pageSize'], `${key} page`);
  if (!Array.isArray(envelope[key])) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${key} response is invalid`);
  }
  return {
    items: envelope[key].map(parse),
    total: integer(envelope.total, `${key}.total`),
    page: integer(envelope.page, `${key}.page`, 1),
    pageSize: integer(envelope.pageSize, `${key}.pageSize`, 1),
  };
}

function orgPath(orgSlug: string, suffix = ''): string {
  return `/v1/teaching/organizations/${encodeURIComponent(orgSlug)}${suffix}`;
}

function conversationPath(orgSlug: string, studentId: string, suffix = ''): string {
  return orgPath(
    orgSlug,
    `/students/${encodeURIComponent(studentId)}/conversations${suffix}`,
  );
}

function pageQuery(pageNumber: number, pageSize: number): string {
  const safePage = Number.isSafeInteger(pageNumber) ? Math.max(1, pageNumber) : 1;
  const safePageSize = Number.isSafeInteger(pageSize) ? Math.min(100, Math.max(1, pageSize)) : 25;
  return `?page=${safePage}&pageSize=${safePageSize}`;
}

export async function listTeachingOrganizations(): Promise<TeachingOrganizationAccess[]> {
  const envelope = record(await request('/v1/teaching/organizations'), 'organizations');
  if (!Array.isArray(envelope.organizations)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'organizations response is invalid');
  }
  return envelope.organizations.map(organization);
}

export async function createTeachingOrganization(
  input: { slug: string; name: string; timezone: string },
  idempotencyKey: string,
): Promise<TeachingOrganizationAccess> {
  return organization(record(await post('/v1/teaching/organizations', input, idempotencyKey), 'organization create').organization);
}

export async function getTeachingOrganization(orgSlug: string): Promise<TeachingOrganizationAccess> {
  return organization(record(await request(orgPath(orgSlug)), 'organization').organization);
}

export async function getTeachingOrganizationSummary(orgSlug: string): Promise<TeachingOrganizationSummary> {
  const envelope = record(await request(orgPath(orgSlug, '/summary')), 'organization summary');
  const summary = record(envelope.summary, 'summary');
  return {
    organization: organization(summary.organization),
    memberCount: nullableNumber(summary.memberCount, 'summary.memberCount'),
    studentCount: nullableNumber(summary.studentCount, 'summary.studentCount'),
  };
}

export async function getTeachingOperationsOverview(orgSlug: string): Promise<TeachingOperationsOverview> {
  const envelope = exactRecord(
    await request(orgPath(orgSlug, '/operations/overview')),
    ['operationsOverview'],
    'operations overview envelope',
  );
  return operationsOverview(envelope.operationsOverview);
}

export async function listTeachingCreditAdjustments(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingCreditAdjustment>> {
  return exactPage(
    await request(orgPath(orgSlug, `/operations/credit-adjustments${pageQuery(pageNumber, pageSize)}`)),
    'creditAdjustments',
    creditAdjustment,
  );
}

export async function listTeachingStudents(orgSlug: string, pageNumber = 1, pageSize = 25): Promise<TeachingPage<TeachingStudent>> {
  return page(await request(orgPath(orgSlug, `/students${pageQuery(pageNumber, pageSize)}`)), 'students', student);
}

export async function createTeachingStudent(
  orgSlug: string,
  input: { displayName: string; externalRef: string | null },
  idempotencyKey: string,
): Promise<TeachingStudent> {
  return student(record(await post(orgPath(orgSlug, '/students'), input, idempotencyKey), 'student create').student);
}

export async function getTeachingStudent(orgSlug: string, studentId: string): Promise<TeachingStudent> {
  return student(record(await request(orgPath(orgSlug, `/students/${encodeURIComponent(studentId)}`)), 'student').student);
}

export async function listTeachingMembers(orgSlug: string, pageNumber = 1, pageSize = 25): Promise<TeachingPage<TeachingMember>> {
  return page(await request(orgPath(orgSlug, `/members${pageQuery(pageNumber, pageSize)}`)), 'members', member);
}

export async function createTeachingMember(
  orgSlug: string,
  input: { userId: number; role: Exclude<TeachingOrganizationRole, 'owner'> },
  idempotencyKey: string,
): Promise<TeachingMember> {
  return member(record(await post(orgPath(orgSlug, '/members'), input, idempotencyKey), 'member create').member);
}

export async function listTeachingCampuses(orgSlug: string, pageNumber = 1, pageSize = 25): Promise<TeachingPage<TeachingCampus>> {
  return page(await request(orgPath(orgSlug, `/campuses${pageQuery(pageNumber, pageSize)}`)), 'campuses', campus);
}

export async function createTeachingCampus(
  orgSlug: string,
  input: { code: string | null; name: string; timezone: string | null },
  idempotencyKey: string,
): Promise<TeachingCampus> {
  return campus(record(await post(orgPath(orgSlug, '/campuses'), input, idempotencyKey), 'campus create').campus);
}

export async function listTeachingGroups(orgSlug: string, pageNumber = 1, pageSize = 25): Promise<TeachingPage<TeachingGroup>> {
  return page(await request(orgPath(orgSlug, `/groups${pageQuery(pageNumber, pageSize)}`)), 'groups', group);
}

export async function createTeachingGroup(
  orgSlug: string,
  input: { campusId: string | null; code: string | null; name: string },
  idempotencyKey: string,
): Promise<TeachingGroup> {
  return group(record(await post(orgPath(orgSlug, '/groups'), input, idempotencyKey), 'group create').group);
}

export async function getTeachingGroup(orgSlug: string, groupId: string): Promise<TeachingGroup> {
  return group(record(await request(orgPath(orgSlug, `/groups/${encodeURIComponent(groupId)}`)), 'group').group);
}

export async function listTeachingGroupMemberships(
  orgSlug: string,
  groupId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingStudentGroupMembership>> {
  return page(
    await request(orgPath(orgSlug, `/groups/${encodeURIComponent(groupId)}/students${pageQuery(pageNumber, pageSize)}`)),
    'memberships',
    studentGroupMembership,
  );
}

export async function createTeachingGroupMembership(
  orgSlug: string,
  groupId: string,
  input: { studentId: string; effectiveFrom: string; effectiveTo: string | null },
  idempotencyKey: string,
): Promise<TeachingStudentGroupMembership> {
  const envelope = record(await post(orgPath(orgSlug, `/groups/${encodeURIComponent(groupId)}/students`), input, idempotencyKey), 'membership create');
  return studentGroupMembership(envelope.membership);
}

export async function revokeTeachingGroupMembership(
  orgSlug: string,
  membershipId: string,
  idempotencyKey: string,
): Promise<TeachingStudentGroupMembership> {
  const envelope = record(await post(orgPath(orgSlug, `/student-group-memberships/${encodeURIComponent(membershipId)}/revoke`), {}, idempotencyKey), 'membership revoke');
  return studentGroupMembership(envelope.membership);
}

export async function listTeachingTeacherAssignments(
  orgSlug: string,
  target: { groupId: string } | { studentId: string },
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingTeacherAssignment>> {
  const query = new URLSearchParams({
    ...target,
    page: String(Math.max(1, pageNumber)),
    pageSize: String(Math.min(100, Math.max(1, pageSize))),
  });
  return page(await request(orgPath(orgSlug, `/teacher-assignments?${query}`)), 'assignments', teacherAssignment);
}

export async function createTeachingTeacherAssignment(
  orgSlug: string,
  input: { teacherUserId: number; groupId: string | null; studentId: string | null; effectiveFrom: string; effectiveTo: string | null },
  idempotencyKey: string,
): Promise<TeachingTeacherAssignment> {
  const envelope = record(await post(orgPath(orgSlug, '/teacher-assignments'), input, idempotencyKey), 'assignment create');
  return teacherAssignment(envelope.assignment);
}

export async function revokeTeachingTeacherAssignment(
  orgSlug: string,
  assignmentId: string,
  idempotencyKey: string,
): Promise<TeachingTeacherAssignment> {
  const envelope = record(await post(orgPath(orgSlug, `/teacher-assignments/${encodeURIComponent(assignmentId)}/revoke`), {}, idempotencyKey), 'assignment revoke');
  return teacherAssignment(envelope.assignment);
}

export async function listTeachingPackageProducts(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingPackageProduct>> {
  return page(await request(orgPath(orgSlug, `/package-products${pageQuery(pageNumber, pageSize)}`)), 'packageProducts', packageProduct);
}

export async function createTeachingPackageProduct(
  orgSlug: string,
  input: {
    code: string;
    name: string;
    creditUnit: TeachingCreditUnit;
    creditType: string;
    totalCredits: number;
    validityDays: number | null;
    priceAmountMinor: number;
    currency: string;
  },
  idempotencyKey: string,
): Promise<TeachingPackageProduct> {
  const envelope = record(await post(orgPath(orgSlug, '/package-products'), input, idempotencyKey), 'package product create');
  return packageProduct(envelope.packageProduct);
}

export async function listTeachingStudentPackages(
  orgSlug: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingStudentPackage>> {
  return page(
    await request(orgPath(orgSlug, `/students/${encodeURIComponent(studentId)}/packages${pageQuery(pageNumber, pageSize)}`)),
    'studentPackages',
    studentPackage,
  );
}

export async function createTeachingStudentPackage(
  orgSlug: string,
  studentId: string,
  input: {
    productId: string;
    acquisitionType: TeachingPackageAcquisitionType;
    validFrom?: string;
    sourceSystem?: string | null;
    sourceRef?: string | null;
    sourceLineRef?: string | null;
  },
  idempotencyKey: string,
): Promise<TeachingStudentPackage> {
  const envelope = record(
    await post(orgPath(orgSlug, `/students/${encodeURIComponent(studentId)}/packages`), input, idempotencyKey),
    'student package create',
  );
  return studentPackage(envelope.studentPackage);
}

export async function listTeachingStudentPackageLedger(
  orgSlug: string,
  studentPackageId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingCreditLedgerEntry>> {
  return exactPage(
    await request(orgPath(orgSlug, `/student-packages/${encodeURIComponent(studentPackageId)}/ledger${pageQuery(pageNumber, pageSize)}`)),
    'ledger',
    creditLedgerEntry,
  );
}

export async function refundTeachingStudentPackage(
  orgSlug: string,
  studentPackageId: string,
  input: {
    credits: number;
    reason: string;
    sourceSystem: string;
    sourceRef: string;
    sourceLineRef: string | null;
  },
  idempotencyKey: string,
): Promise<TeachingCreditLedgerMutationResult> {
  const result = creditLedgerMutationResult(await post(
    orgPath(orgSlug, `/student-packages/${encodeURIComponent(studentPackageId)}/refunds`),
    input,
    idempotencyKey,
  ));
  if (
    result.studentPackage.id !== studentPackageId
    || result.studentPackage.studentId !== result.ledgerEntry.studentId
    || result.ledgerEntry.entryType !== 'refund'
    || result.ledgerEntry.delta !== -input.credits
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'credit refund response is invalid');
  }
  return result;
}

export async function reverseTeachingCreditLedgerEntry(
  orgSlug: string,
  studentPackageId: string,
  ledgerId: string,
  input: { reason: string },
  idempotencyKey: string,
): Promise<TeachingCreditLedgerMutationResult> {
  const result = creditLedgerMutationResult(await post(
    orgPath(
      orgSlug,
      `/student-packages/${encodeURIComponent(studentPackageId)}/ledger/${encodeURIComponent(ledgerId)}/reversal`,
    ),
    input,
    idempotencyKey,
  ));
  if (
    result.studentPackage.id !== studentPackageId
    || result.studentPackage.studentId !== result.ledgerEntry.studentId
    || result.ledgerEntry.entryType !== 'reversal'
    || result.ledgerEntry.reversalOfLedgerId !== ledgerId
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'credit reversal response is invalid');
  }
  return result;
}

export async function listTeachingSessions(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingSessionSummary>> {
  return page(await request(orgPath(orgSlug, `/sessions${pageQuery(pageNumber, pageSize)}`)), 'sessions', sessionSummary);
}

export async function createTeachingSession(
  orgSlug: string,
  input: {
    title: string;
    startsAt: string;
    endsAt: string;
    timezone?: string;
    teacherUserIds?: number[];
    attendees?: Array<{ studentId: string; studentPackageId: string; creditCost: number }>;
  },
  idempotencyKey: string,
): Promise<TeachingSession> {
  const envelope = record(await post(orgPath(orgSlug, '/sessions'), input, idempotencyKey), 'session create');
  return sessionDetail(envelope.session);
}

export async function getTeachingSession(orgSlug: string, sessionId: string): Promise<TeachingSession> {
  const envelope = record(await request(orgPath(orgSlug, `/sessions/${encodeURIComponent(sessionId)}`)), 'session');
  return sessionDetail(envelope.session);
}

export async function saveTeachingAttendanceBatch(
  orgSlug: string,
  sessionId: string,
  records: Array<{ attendanceId: string; status: Exclude<TeachingAttendanceStatus, 'expected'> }>,
  idempotencyKey: string,
): Promise<TeachingAttendance[]> {
  const envelope = record(
    await post(orgPath(orgSlug, `/sessions/${encodeURIComponent(sessionId)}/attendance/batch`), { records }, idempotencyKey),
    'attendance batch',
  );
  if (!Array.isArray(envelope.attendance)) throw new TeachingApiError('INVALID_RESPONSE', 502, 'attendance response is invalid');
  return envelope.attendance.map(attendance);
}

export async function completeTeachingSession(
  orgSlug: string,
  sessionId: string,
  idempotencyKey: string,
): Promise<TeachingSessionCompletion> {
  const envelope = record(await post(orgPath(orgSlug, `/sessions/${encodeURIComponent(sessionId)}/complete`), {}, idempotencyKey), 'session complete');
  const sessionItem = record(envelope.session, 'session completion');
  const consumption = record(envelope.consumption, 'session consumption');
  return {
    session: {
      id: string(sessionItem.id, 'session completion.id'),
      status: enumValue(sessionItem.status, ['completed'] as const, 'session completion.status'),
      completedAt: string(sessionItem.completedAt, 'session completion.completedAt'),
    },
    consumption: {
      attendanceCount: integer(consumption.attendanceCount, 'session consumption.attendanceCount'),
      totalCredits: integer(consumption.totalCredits, 'session consumption.totalCredits'),
    },
  };
}

export async function listTeachingLessonFeedback(
  orgSlug: string,
  sessionId: string,
  pageNumber = 1,
  pageSize = 100,
): Promise<TeachingPage<TeachingLessonFeedback>> {
  return page(
    await request(orgPath(orgSlug, `/sessions/${encodeURIComponent(sessionId)}/feedback${pageQuery(pageNumber, pageSize)}`)),
    'feedback',
    lessonFeedback,
  );
}

export async function listTeachingWeeklyReports(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
  studentId?: string,
): Promise<TeachingPage<TeachingWeeklyReportSummary>> {
  const query = new URLSearchParams(pageQuery(pageNumber, pageSize).slice(1));
  if (studentId) query.set('studentId', studentId);
  return page(
    await request(orgPath(orgSlug, `/weekly-reports?${query}`)),
    'weeklyReports',
    weeklyReportSummary,
  );
}

export async function generateTeachingWeeklyReport(
  orgSlug: string,
  input: GenerateTeachingWeeklyReportInput,
  idempotencyKey: string,
): Promise<TeachingWeeklyReport> {
  const envelope = record(
    await post(
      orgPath(orgSlug, '/weekly-reports/generate'),
      { studentId: input.studentId, weekStart: input.weekStart },
      idempotencyKey,
    ),
    'weekly report generate',
  );
  return weeklyReport(envelope.weeklyReport);
}

export async function getTeachingWeeklyReport(orgSlug: string, reportId: string): Promise<TeachingWeeklyReport> {
  const envelope = record(
    await request(orgPath(orgSlug, `/weekly-reports/${encodeURIComponent(reportId)}`)),
    'weekly report',
  );
  return weeklyReport(envelope.weeklyReport);
}

export async function publishTeachingWeeklyReport(
  orgSlug: string,
  reportId: string,
  input: PublishTeachingWeeklyReportInput,
  idempotencyKey: string,
): Promise<TeachingWeeklyReport> {
  const envelope = record(
    await post(
      orgPath(orgSlug, `/weekly-reports/${encodeURIComponent(reportId)}/publish`),
      {
        teacherSummary: input.teacherSummary,
        nextWeekPlan: input.nextWeekPlan,
        visibility: input.visibility,
      },
      idempotencyKey,
    ),
    'weekly report publish',
  );
  return weeklyReport(envelope.weeklyReport);
}

export async function createTeachingLessonFeedback(
  orgSlug: string,
  sessionId: string,
  studentId: string,
  input: {
    visibility: TeachingFeedbackVisibility;
    summary: string;
    strengths?: string | null;
    challenges?: string | null;
    nextGoals?: string | null;
    internalNotes?: string | null;
  },
  idempotencyKey: string,
): Promise<TeachingLessonFeedback> {
  const envelope = record(
    await post(
      orgPath(orgSlug, `/sessions/${encodeURIComponent(sessionId)}/students/${encodeURIComponent(studentId)}/feedback`),
      input,
      idempotencyKey,
    ),
    'lesson feedback create',
  );
  return lessonFeedback(envelope.feedback);
}

export async function listTeachingTrainingTemplates(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingTrainingTemplate>> {
  return page(
    await request(orgPath(orgSlug, `/training/templates${pageQuery(pageNumber, pageSize)}`)),
    'templates',
    trainingTemplate,
  );
}

export async function getTeachingTrainingTemplate(
  orgSlug: string,
  templateId: string,
): Promise<TeachingTrainingTemplate> {
  const envelope = record(
    await request(orgPath(orgSlug, `/training/templates/${encodeURIComponent(templateId)}`)),
    'training template',
  );
  return trainingTemplate(envelope.template);
}

export async function createTeachingTrainingTemplate(
  orgSlug: string,
  input: TeachingTrainingTemplateCreateInput,
  idempotencyKey: string,
): Promise<TeachingTrainingTemplate> {
  const envelope = record(
    await post(orgPath(orgSlug, '/training/templates'), input, idempotencyKey),
    'training template create',
  );
  return trainingTemplate(envelope.template);
}

export async function listTeachingTrainingTemplateVersions(
  orgSlug: string,
  templateId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingTrainingTemplateVersion>> {
  return page(
    await request(orgPath(orgSlug, `/training/templates/${encodeURIComponent(templateId)}/versions${pageQuery(pageNumber, pageSize)}`)),
    'templateVersions',
    trainingTemplateVersion,
  );
}

export async function createTeachingTrainingTemplateVersion(
  orgSlug: string,
  templateId: string,
  input: TeachingTrainingTemplateVersionCreateInput,
  idempotencyKey: string,
): Promise<TeachingTrainingTemplateVersion> {
  const envelope = record(
    await post(orgPath(orgSlug, `/training/templates/${encodeURIComponent(templateId)}/versions`), input, idempotencyKey),
    'training template version create',
  );
  return trainingTemplateVersion(envelope.templateVersion);
}

export async function archiveTeachingTrainingTemplate(
  orgSlug: string,
  templateId: string,
  idempotencyKey: string,
): Promise<TeachingTrainingTemplate> {
  const envelope = record(
    await post(orgPath(orgSlug, `/training/templates/${encodeURIComponent(templateId)}/archive`), {}, idempotencyKey),
    'training template archive',
  );
  return trainingTemplate(envelope.template);
}

export async function listTeachingTrainingAssignments(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
  status?: TeachingTrainingAssignment['status'],
): Promise<TeachingPage<TeachingTrainingAssignment>> {
  const query = new URLSearchParams({
    page: String(Math.max(1, pageNumber)),
    pageSize: String(Math.min(100, Math.max(1, pageSize))),
  });
  if (status) query.set('status', status);
  return page(
    await request(orgPath(orgSlug, `/training/assignments?${query}`)),
    'assignments',
    trainingAssignment,
  );
}

export async function getTeachingTrainingAssignment(
  orgSlug: string,
  assignmentId: string,
): Promise<TeachingTrainingAssignmentDetail> {
  return trainingAssignmentDetail(await request(
    orgPath(orgSlug, `/training/assignments/${encodeURIComponent(assignmentId)}`),
  ));
}

export async function createTeachingTrainingAssignment(
  orgSlug: string,
  input: TeachingTrainingAssignmentWriteInput,
  idempotencyKey: string,
): Promise<TeachingTrainingAssignmentDetail> {
  return trainingAssignmentDetail(await post(
    orgPath(orgSlug, '/training/assignments'),
    input,
    idempotencyKey,
  ));
}

export async function reviseTeachingTrainingAssignment(
  orgSlug: string,
  assignmentId: string,
  input: TeachingTrainingAssignmentWriteInput,
  idempotencyKey: string,
): Promise<TeachingTrainingAssignmentDetail> {
  return trainingAssignmentDetail(await post(
    orgPath(orgSlug, `/training/assignments/${encodeURIComponent(assignmentId)}/revise`),
    input,
    idempotencyKey,
  ));
}

export async function publishTeachingTrainingAssignment(
  orgSlug: string,
  assignmentId: string,
  idempotencyKey: string,
): Promise<TeachingTrainingAssignmentDetail> {
  return trainingAssignmentDetail(await post(
    orgPath(orgSlug, `/training/assignments/${encodeURIComponent(assignmentId)}/publish`),
    {},
    idempotencyKey,
  ));
}

export async function closeTeachingTrainingAssignment(
  orgSlug: string,
  assignmentId: string,
  idempotencyKey: string,
): Promise<TeachingTrainingAssignmentDetail> {
  return trainingAssignmentDetail(await post(
    orgPath(orgSlug, `/training/assignments/${encodeURIComponent(assignmentId)}/close`),
    {},
    idempotencyKey,
  ));
}

export async function listTeachingTrainingAssignmentTargets(
  orgSlug: string,
  assignmentId: string,
  pageNumber = 1,
  pageSize = 25,
  targetKind?: TeachingTrainingAssignmentTarget['targetKind'],
): Promise<TeachingPage<TeachingTrainingAssignmentTarget>> {
  const query = new URLSearchParams({
    page: String(Math.max(1, pageNumber)),
    pageSize: String(Math.min(100, Math.max(1, pageSize))),
  });
  if (targetKind) query.set('targetKind', targetKind);
  return page(
    await request(orgPath(orgSlug, `/training/assignments/${encodeURIComponent(assignmentId)}/targets?${query}`)),
    'targets',
    trainingTarget,
  );
}

export async function listTeachingTrainingTargetEvidence(
  orgSlug: string,
  assignmentId: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingTrainingEvidence>> {
  return page(
    await request(orgPath(
      orgSlug,
      `/training/assignments/${encodeURIComponent(assignmentId)}/targets/${encodeURIComponent(studentId)}/evidence${pageQuery(pageNumber, pageSize)}`,
    )),
    'evidence',
    trainingEvidence,
  );
}

export async function listTeachingTrainingTargetReviews(
  orgSlug: string,
  assignmentId: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingTrainingSubmissionReview>> {
  return page(
    await request(orgPath(
      orgSlug,
      `/training/assignments/${encodeURIComponent(assignmentId)}/targets/${encodeURIComponent(studentId)}/reviews${pageQuery(pageNumber, pageSize)}`,
    )),
    'reviews',
    trainingReview,
  );
}

export async function createTeachingTrainingTargetReview(
  orgSlug: string,
  assignmentId: string,
  studentId: string,
  input: TeachingTrainingReviewCreateInput,
  idempotencyKey: string,
): Promise<TeachingTrainingSubmissionReview> {
  const envelope = record(await post(orgPath(
    orgSlug,
    `/training/assignments/${encodeURIComponent(assignmentId)}/targets/${encodeURIComponent(studentId)}/reviews`,
  ), input, idempotencyKey), 'training review create');
  return trainingReview(envelope.review);
}

export async function getCurrentTeachingStudentAccountBindingInvite(
  orgSlug: string,
  studentId: string,
): Promise<TeachingStudentAccountBindingInvite | null> {
  const envelope = record(await request(orgPath(
    orgSlug,
    `/students/${encodeURIComponent(studentId)}/account-binding-invite`,
  )), 'binding invite current');
  return envelope.invite === null ? null : bindingInvite(envelope.invite);
}

export async function createTeachingStudentAccountBindingInvite(
  orgSlug: string,
  studentId: string,
  expiresInMinutes: number,
): Promise<TeachingStudentAccountBindingInviteCreated> {
  const envelope = record(await postWithoutIdempotency(orgPath(
    orgSlug,
    `/students/${encodeURIComponent(studentId)}/account-binding-invites`,
  ), { expiresInMinutes }), 'binding invite create');
  return {
    invite: bindingInvite(envelope.invite),
    token: string(envelope.token, 'binding invite token'),
  };
}

export async function revokeTeachingStudentAccountBindingInvite(
  orgSlug: string,
  studentId: string,
  inviteId: string,
  idempotencyKey: string,
): Promise<TeachingStudentAccountBindingInvite> {
  const envelope = record(await post(orgPath(
    orgSlug,
    `/students/${encodeURIComponent(studentId)}/account-binding-invites/${encodeURIComponent(inviteId)}/revoke`,
  ), {}, idempotencyKey), 'binding invite revoke');
  return bindingInvite(envelope.invite);
}

export async function previewTeachingStudentAccountBinding(
  token: string,
): Promise<TeachingStudentAccountBindingPreview> {
  const item = record(
    await postWithoutIdempotency('/v1/teaching/me/student-account-binding/preview', { token }),
    'binding preview',
  );
  return {
    organizationName: string(item.organizationName, 'binding preview.organizationName'),
    studentDisplayName: string(item.studentDisplayName, 'binding preview.studentDisplayName'),
    expiresAt: string(item.expiresAt, 'binding preview.expiresAt'),
  };
}

export async function consumeTeachingStudentAccountBinding(
  token: string,
): Promise<TeachingStudentAccountBindingConsumed> {
  const item = record(
    await postWithoutIdempotency('/v1/teaching/me/student-account-binding/consume', { token }),
    'binding consume',
  );
  const invite = record(item.invite, 'binding consume.invite');
  const linkedStudent = record(item.student, 'binding consume.student');
  return {
    invite: {
      id: string(invite.id, 'binding consume.invite.id'),
      status: enumValue(invite.status, ['consumed'] as const, 'binding consume.invite.status'),
      expiresAt: string(invite.expiresAt, 'binding consume.invite.expiresAt'),
      consumedAt: string(invite.consumedAt, 'binding consume.invite.consumedAt'),
      createdAt: string(invite.createdAt, 'binding consume.invite.createdAt'),
    },
    student: {
      id: string(linkedStudent.id, 'binding consume.student.id'),
      organizationName: string(linkedStudent.organizationName, 'binding consume.student.organizationName'),
      displayName: string(linkedStudent.displayName, 'binding consume.student.displayName'),
      accountLinkedAt: string(linkedStudent.accountLinkedAt, 'binding consume.student.accountLinkedAt'),
    },
  };
}

export async function previewTeachingGuardianAccountBinding(
  token: string,
): Promise<TeachingGuardianAccountBindingPreview> {
  const item = record(
    await postWithoutIdempotency('/v1/teaching/me/guardian-account-binding/preview', { token }),
    'guardian binding preview',
  );
  return {
    organizationName: string(item.organizationName, 'guardian binding preview.organizationName'),
    studentDisplayName: string(item.studentDisplayName, 'guardian binding preview.studentDisplayName'),
    relationship: string(item.relationship, 'guardian binding preview.relationship'),
    expiresAt: string(item.expiresAt, 'guardian binding preview.expiresAt'),
  };
}

export async function consumeTeachingGuardianAccountBinding(
  token: string,
): Promise<TeachingGuardianAccountBindingConsumed> {
  const item = record(
    await postWithoutIdempotency('/v1/teaching/me/guardian-account-binding/consume', { token }),
    'guardian binding consume',
  );
  const invite = record(item.invite, 'guardian binding consume.invite');
  const guardian = record(item.guardian, 'guardian binding consume.guardian');
  return {
    invite: {
      id: string(invite.id, 'guardian binding consume.invite.id'),
      status: enumValue(invite.status, ['consumed'] as const, 'guardian binding consume.invite.status'),
      expiresAt: string(invite.expiresAt, 'guardian binding consume.invite.expiresAt'),
      consumedAt: string(invite.consumedAt, 'guardian binding consume.invite.consumedAt'),
      createdAt: string(invite.createdAt, 'guardian binding consume.invite.createdAt'),
    },
    guardian: {
      guardianLinkId: string(guardian.guardianLinkId, 'guardian binding consume.guardian.guardianLinkId'),
      studentId: string(guardian.studentId, 'guardian binding consume.guardian.studentId'),
      organizationName: string(guardian.organizationName, 'guardian binding consume.guardian.organizationName'),
      studentDisplayName: string(guardian.studentDisplayName, 'guardian binding consume.guardian.studentDisplayName'),
      relationship: string(guardian.relationship, 'guardian binding consume.guardian.relationship'),
      accountLinkedAt: string(guardian.accountLinkedAt, 'guardian binding consume.guardian.accountLinkedAt'),
    },
  };
}

function learningContextsEnvelope(value: unknown): TeachingLearningContext[] {
  const envelope = record(value, 'learningContexts');
  if (!Array.isArray(envelope.learningContexts)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learningContexts response is invalid');
  }
  return envelope.learningContexts.map(learningContext);
}

export async function listTeachingLearningContexts(): Promise<TeachingLearningContext[]> {
  return learningContextsEnvelope(await request('/v1/teaching/me/learning-contexts'));
}

export async function listTeachingOrganizationLearningContexts(
  orgSlug: string,
): Promise<TeachingLearningContext[]> {
  return learningContextsEnvelope(await request(orgPath(orgSlug, '/me/students')));
}

function assertConversationScope(
  item: TeachingConversationSummary,
  orgSlug: string,
  studentId: string,
): void {
  if (item.organization.slug !== orgSlug || item.student.id !== studentId) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation scope is invalid');
  }
  if (
    item.lastReadSequence > item.lastMessageSequence
    || item.unreadCount !== item.lastMessageSequence - item.lastReadSequence
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation read state is invalid');
  }
}

export async function listTeachingConversations(
  orgSlug: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingConversationListResponse> {
  const envelope = record(
    await request(conversationPath(orgSlug, studentId, pageQuery(pageNumber, pageSize))),
    'conversations',
  );
  if (!Array.isArray(envelope.conversations)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversations response is invalid');
  }
  const conversations = envelope.conversations.map(conversationSummary);
  conversations.forEach((item) => assertConversationScope(item, orgSlug, studentId));
  const total = integer(envelope.total, 'conversations.total');
  const page = integer(envelope.page, 'conversations.page', 1);
  const parsedPageSize = integer(envelope.pageSize, 'conversations.pageSize', 1);
  const safePage = Number.isSafeInteger(pageNumber) ? Math.max(1, pageNumber) : 1;
  const safePageSize = Number.isSafeInteger(pageSize) ? Math.min(100, Math.max(1, pageSize)) : 25;
  if (page !== safePage || parsedPageSize !== safePageSize || total < conversations.length) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation pagination is invalid');
  }
  return {
    conversations,
    total,
    page,
    pageSize: parsedPageSize,
  };
}

export async function createTeachingConversation(
  orgSlug: string,
  studentId: string,
  input: CreateTeachingConversationInput,
  idempotencyKey: string,
): Promise<CreateTeachingConversationResponse> {
  const envelope = record(await post(
    conversationPath(orgSlug, studentId),
    { subject: input.subject, body: input.body },
    idempotencyKey,
  ), 'conversation create');
  const conversation = conversationSummary(envelope.conversation);
  const message = conversationMessage(envelope.message);
  assertConversationScope(conversation, orgSlug, studentId);
  if (message.conversationId !== conversation.id || message.sequence !== conversation.lastMessageSequence) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation create state is invalid');
  }
  return { conversation, message };
}

export async function getTeachingConversation(
  orgSlug: string,
  studentId: string,
  conversationId: string,
): Promise<TeachingConversationDetailResponse> {
  const envelope = record(await request(conversationPath(
    orgSlug,
    studentId,
    `/${encodeURIComponent(conversationId)}`,
  )), 'conversation detail');
  const conversation = conversationSummary(envelope.conversation);
  assertConversationScope(conversation, orgSlug, studentId);
  if (conversation.id !== conversationId) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation identity is invalid');
  }
  return { conversation };
}

export async function listTeachingConversationMessages(
  orgSlug: string,
  studentId: string,
  conversationId: string,
  afterSequence = 0,
  limit = 50,
): Promise<TeachingConversationMessagesResponse> {
  const safeAfterSequence = Number.isSafeInteger(afterSequence)
    ? Math.min(2_147_483_647, Math.max(0, afterSequence))
    : 0;
  const safeLimit = Number.isSafeInteger(limit) ? Math.min(100, Math.max(1, limit)) : 50;
  const query = new URLSearchParams({
    afterSequence: String(safeAfterSequence),
    limit: String(safeLimit),
  });
  const envelope = record(await request(conversationPath(
    orgSlug,
    studentId,
    `/${encodeURIComponent(conversationId)}/messages?${query}`,
  )), 'conversation messages');
  if (!Array.isArray(envelope.messages)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation messages response is invalid');
  }
  const messages = envelope.messages.map(conversationMessage);
  const parsedAfterSequence = integer(envelope.afterSequence, 'conversation messages.afterSequence');
  const nextAfterSequence = integer(envelope.nextAfterSequence, 'conversation messages.nextAfterSequence');
  const hasMore = boolean(envelope.hasMore, 'conversation messages.hasMore');
  let previousSequence = parsedAfterSequence;
  for (const message of messages) {
    if (message.conversationId !== conversationId || message.sequence <= previousSequence) {
      throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation message order is invalid');
    }
    previousSequence = message.sequence;
  }
  if (
    parsedAfterSequence !== safeAfterSequence
    || nextAfterSequence !== previousSequence
    || (hasMore && messages.length === 0)
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation message cursor is invalid');
  }
  return { messages, afterSequence: parsedAfterSequence, nextAfterSequence, hasMore };
}

export async function replyTeachingConversation(
  orgSlug: string,
  studentId: string,
  conversationId: string,
  input: ReplyTeachingConversationInput,
  idempotencyKey: string,
): Promise<ReplyTeachingConversationResponse> {
  const envelope = record(await post(conversationPath(
    orgSlug,
    studentId,
    `/${encodeURIComponent(conversationId)}/messages`,
  ), { body: input.body }, idempotencyKey), 'conversation reply');
  const message = conversationMessage(envelope.message);
  const conversation = conversationReplyState(envelope.conversation);
  if (
    message.conversationId !== conversationId
    || conversation.id !== conversationId
    || message.sequence !== conversation.lastMessageSequence
    || conversation.lastReadSequence !== conversation.lastMessageSequence
    || conversation.unreadCount !== 0
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation reply state is invalid');
  }
  return { message, conversation };
}

export async function markTeachingConversationRead(
  orgSlug: string,
  studentId: string,
  conversationId: string,
  input: MarkTeachingConversationReadInput,
  idempotencyKey: string,
): Promise<MarkTeachingConversationReadResponse> {
  const envelope = record(await post(conversationPath(
    orgSlug,
    studentId,
    `/${encodeURIComponent(conversationId)}/read`,
  ), { lastReadSequence: input.lastReadSequence }, idempotencyKey), 'conversation read');
  const readItem = record(envelope.read, 'conversation read state');
  const read = {
    conversationId: string(readItem.conversationId, 'conversation read state.conversationId'),
    lastReadSequence: integer(readItem.lastReadSequence, 'conversation read state.lastReadSequence'),
  };
  if (read.conversationId !== conversationId || read.lastReadSequence < input.lastReadSequence) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'conversation read state is invalid');
  }
  return { read };
}

export async function listLearnerTeachingWeeklyReports(
  orgSlug: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingLearnerWeeklyReport>> {
  return page(
    await request(orgPath(
      orgSlug,
      `/me/students/${encodeURIComponent(studentId)}/weekly-reports${pageQuery(pageNumber, pageSize)}`,
    )),
    'weeklyReports',
    (value) => learnerWeeklyReport(value, false),
  );
}

export async function getLearnerTeachingWeeklyReport(
  orgSlug: string,
  studentId: string,
  reportId: string,
): Promise<TeachingLearnerWeeklyReport> {
  const envelope = record(await request(orgPath(
    orgSlug,
    `/me/students/${encodeURIComponent(studentId)}/weekly-reports/${encodeURIComponent(reportId)}`,
  )), 'learner weekly report');
  return learnerWeeklyReport(envelope.weeklyReport, true);
}

export async function listLearnerTeachingLessonFeedback(
  orgSlug: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingLearnerLessonFeedback>> {
  return page(
    await request(orgPath(
      orgSlug,
      `/me/students/${encodeURIComponent(studentId)}/lesson-feedback${pageQuery(pageNumber, pageSize)}`,
    )),
    'feedback',
    learnerLessonFeedback,
  );
}

export async function listSelfTeachingTrainingAssignments(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingSelfTrainingAssignment>> {
  return page(
    await request(orgPath(orgSlug, `/me/training/assignments${pageQuery(pageNumber, pageSize)}`)),
    'assignments',
    selfTrainingAssignment,
  );
}
