import {
  TEACHING_ORGANIZATION_STATUSES,
  TEACHING_ORGANIZATION_ROLES,
  type TeachingOperationsOverview,
  TEACHING_CREDIT_UNITS,
  type TeachingAuditEvent,
  TEACHING_AUDIT_OUTCOMES,
  TEACHING_STUDENT_STATUSES,
  type TeachingCampus,
  TEACHING_CAMPUS_STATUSES,
  type TeachingGroup,
  TEACHING_GROUP_STATUSES,
  TEACHING_MEMBER_STATUSES,
  type TeachingStudentGroupMembership,
  type TeachingTeacherAssignment,
  type TeachingAuditOutcome,
  type TeachingOrganizationRole,
} from '@cuberoot/shared/teaching';
import {
  type TeachingOrganizationAccess,
  type TeachingStudent,
  type TeachingMember,
  type TeachingOrganizationSummary,
  type TeachingPage,
} from './types';
import {
  record,
  string,
  enumValue,
  integer,
  exactRecord,
  isoDate,
  unicodeCodePointLength,
  positiveBigIntString,
  isoTimestamp,
  nullableNumber,
  nullableString,
  optionalNullableString,
} from './validation';
import { TeachingApiError } from './errors';
import { request, post } from './transport';
import {
  orgPath,
  exactPage,
  page,
  pageQuery,
} from './pagination';

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

function auditEvent(value: unknown): TeachingAuditEvent {
  const item = exactRecord(
    value,
    ['id', 'actorDisplayName', 'actorRole', 'action', 'entityType', 'entityId', 'outcome', 'requestId', 'createdAt'],
    'auditEvent',
  );
  const actorDisplayName = string(item.actorDisplayName, 'auditEvent.actorDisplayName');
  const action = string(item.action, 'auditEvent.action');
  const entityType = string(item.entityType, 'auditEvent.entityType');
  const entityId = item.entityId === null ? null : string(item.entityId, 'auditEvent.entityId');
  const requestId = item.requestId === null ? null : string(item.requestId, 'auditEvent.requestId');
  if (
    unicodeCodePointLength(actorDisplayName) > 200
    || unicodeCodePointLength(action) > 100
    || action.trim().length < 1
    || unicodeCodePointLength(entityType) > 80
    || entityType.trim().length < 1
    || (entityId !== null && unicodeCodePointLength(entityId) > 100)
    || (requestId !== null && unicodeCodePointLength(requestId) > 100)
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'auditEvent response is invalid');
  }
  return {
    id: positiveBigIntString(item.id, 'auditEvent.id'),
    actorDisplayName,
    actorRole: item.actorRole === null
      ? null
      : enumValue(item.actorRole, TEACHING_ORGANIZATION_ROLES, 'auditEvent.actorRole'),
    action,
    entityType,
    entityId,
    outcome: enumValue(item.outcome, TEACHING_AUDIT_OUTCOMES, 'auditEvent.outcome'),
    requestId,
    createdAt: isoTimestamp(item.createdAt, 'auditEvent.createdAt'),
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

export async function listTeachingAuditEvents(
  orgSlug: string,
  pageNumber = 1,
  pageSize = 30,
  filters: { q?: string; outcome?: TeachingAuditOutcome | null } = {},
): Promise<TeachingPage<TeachingAuditEvent>> {
  const safePage = Number.isSafeInteger(pageNumber) ? Math.max(1, pageNumber) : 1;
  const safePageSize = Number.isSafeInteger(pageSize) ? Math.min(100, Math.max(1, pageSize)) : 30;
  const query = new URLSearchParams({ page: String(safePage), pageSize: String(safePageSize) });
  const search = filters.q?.trim();
  if (search) query.set('q', search);
  if (filters.outcome) query.set('outcome', filters.outcome);
  return exactPage(
    await request(orgPath(orgSlug, `/audit-events?${query.toString()}`)),
    'auditEvents',
    auditEvent,
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
