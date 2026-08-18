import {
  TEACHING_ATTENDANCE_STATUSES,
  TEACHING_CAMPUS_STATUSES,
  TEACHING_CREDIT_UNITS,
  TEACHING_GROUP_STATUSES,
  TEACHING_MEMBER_STATUSES,
  TEACHING_ORGANIZATION_ROLES,
  TEACHING_ORGANIZATION_STATUSES,
  TEACHING_PACKAGE_ACQUISITION_TYPES,
  TEACHING_PACKAGE_PRODUCT_STATUSES,
  TEACHING_SESSION_STATUSES,
  TEACHING_STUDENT_PACKAGE_STATUSES,
  TEACHING_STUDENT_STATUSES,
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
  type TeachingCreditUnit,
  type TeachingGroup,
  type TeachingMemberStatus,
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

export interface TeachingCreditLedgerEntry {
  id: number;
  studentId: string;
  entryType: string;
  delta: number;
  attendanceId: string | null;
  sessionId: string | null;
  sourceSystem: string | null;
  sourceRef: string | null;
  sourceLineRef: string | null;
  reversalOfLedgerId: number | null;
  reason: string | null;
  actorRole: string | null;
  actorDisplayName: string | null;
  metadata: unknown;
  createdAt: string;
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

function enumValue<const T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  const parsed = string(value, label);
  if (!(values as readonly string[]).includes(parsed)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return parsed as T[number];
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
  const item = record(value, 'studentPackage');
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
  const item = record(value, 'ledger');
  return {
    id: integer(item.id, 'ledger.id', 1),
    studentId: string(item.studentId, 'ledger.studentId'),
    entryType: string(item.entryType, 'ledger.entryType'),
    delta: integer(item.delta, 'ledger.delta', Number.MIN_SAFE_INTEGER),
    attendanceId: nullableString(item.attendanceId, 'ledger.attendanceId'),
    sessionId: nullableString(item.sessionId, 'ledger.sessionId'),
    sourceSystem: nullableString(item.sourceSystem, 'ledger.sourceSystem'),
    sourceRef: nullableString(item.sourceRef, 'ledger.sourceRef'),
    sourceLineRef: nullableString(item.sourceLineRef, 'ledger.sourceLineRef'),
    reversalOfLedgerId: item.reversalOfLedgerId === null ? null : integer(item.reversalOfLedgerId, 'ledger.reversalOfLedgerId', 1),
    reason: nullableString(item.reason, 'ledger.reason'),
    actorRole: nullableString(item.actorRole, 'ledger.actorRole'),
    actorDisplayName: nullableString(item.actorDisplayName, 'ledger.actorDisplayName'),
    metadata: item.metadata,
    createdAt: string(item.createdAt, 'ledger.createdAt'),
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

function orgPath(orgSlug: string, suffix = ''): string {
  return `/v1/teaching/organizations/${encodeURIComponent(orgSlug)}${suffix}`;
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
  return page(
    await request(orgPath(orgSlug, `/student-packages/${encodeURIComponent(studentPackageId)}/ledger${pageQuery(pageNumber, pageSize)}`)),
    'ledger',
    creditLedgerEntry,
  );
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
