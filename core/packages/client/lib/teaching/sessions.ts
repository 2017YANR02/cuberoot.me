import {
  TEACHING_ATTENDANCE_STATUSES,
  TEACHING_FEEDBACK_VISIBILITIES,
  TEACHING_ORGANIZATION_ROLES,
  TEACHING_SESSION_STATUSES,
  type TeachingAttendanceActorSnapshot,
  type TeachingLeaveRequest,
  TEACHING_LEAVE_REQUEST_STATUSES,
  type TeachingMakeupAttempt,
  TEACHING_MAKEUP_ATTEMPT_STATUSES,
  type TeachingLearnerSessionSummary,
  type TeachingMakeupCandidate,
  type TeachingAttendanceStatus,
} from '@cuberoot/shared/teaching';
import {
  type TeachingSessionTeacher,
  type TeachingAttendance,
  type TeachingLessonFeedback,
  type TeachingSessionSummary,
  type TeachingSession,
  type TeachingPage,
  type TeachingLeaveRequestMutationResult,
  type TeachingMakeupMutationResult,
  type TeachingSessionCancellationResult,
  type TeachingSessionCompletion,
} from './types';
import {
  record,
  integer,
  string,
  enumValue,
  optionalNullableString,
  canonicalBoundedResponseString,
  isoTimestamp,
  nullableString,
  nullableInteger,
  exactRecord,
  positiveBigIntString,
  canonicalResponseString,
  uuidString,
} from './validation';
import { TeachingApiError } from './errors';
import {
  page,
  orgPath,
  pageQuery,
  exactPage,
} from './pagination';
import { request, post } from './transport';

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
  const creditCost = integer(item.creditCost, 'attendance.creditCost');
  if (creditCost > 1_000_000) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'attendance.creditCost is invalid');
  }
  return {
    id: string(item.id, 'attendance.id'),
    studentId: string(item.studentId, 'attendance.studentId'),
    displayName: optionalNullableString(item.displayName, 'attendance.displayName'),
    studentPackageId: optionalNullableString(item.studentPackageId, 'attendance.studentPackageId'),
    status: enumValue(item.status, TEACHING_ATTENDANCE_STATUSES, 'attendance.status'),
    creditCost,
    notes: canonicalBoundedResponseString(item.notes, 'attendance.notes', 500),
    updatedAt: isoTimestamp(item.updatedAt, 'attendance.updatedAt'),
  };
}

export function lessonFeedback(value: unknown): TeachingLessonFeedback {
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

const TEACHING_LEAVE_ACTOR_ROLES = ['owner', 'admin', 'teacher', 'assistant', 'student', 'guardian'] as const;

const TEACHING_LEARNER_TEACHER_ROLES = ['teacher', 'assistant'] as const;

function teachingActorSnapshot(value: unknown, label: string): TeachingAttendanceActorSnapshot {
  const item = exactRecord(value, ['userId', 'displayName', 'role', 'relationship'], label);
  const role = enumValue(item.role, TEACHING_LEAVE_ACTOR_ROLES, `${label}.role`);
  const relationship = nullableString(item.relationship, `${label}.relationship`);
  if (
    (role === 'guardian' && (
      relationship === null
      || relationship.length > 100
      || relationship.trim() !== relationship
    ))
    || (role !== 'guardian' && relationship !== null)
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label}.relationship is invalid`);
  }
  return {
    userId: positiveBigIntString(item.userId, `${label}.userId`),
    displayName: canonicalResponseString(item.displayName, `${label}.displayName`, 160),
    role,
    relationship,
  };
}

function teachingStaffActorSnapshot(value: unknown, label: string): TeachingAttendanceActorSnapshot {
  const actor = teachingActorSnapshot(value, label);
  if (actor.role === 'student' || actor.role === 'guardian') {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label}.role is invalid`);
  }
  return actor;
}

function nullableStaffActorSnapshot(value: unknown, label: string): TeachingAttendanceActorSnapshot | null {
  if (value === null) return null;
  return teachingStaffActorSnapshot(value, label);
}

function leaveRequest(value: unknown): TeachingLeaveRequest {
  const item = exactRecord(value, [
    'id', 'organizationId', 'sessionId', 'attendanceId', 'studentId', 'status', 'reason',
    'decisionReason', 'requestedBy', 'decidedBy', 'decidedAt', 'createdAt', 'updatedAt',
  ], 'leaveRequest');
  const status = enumValue(item.status, TEACHING_LEAVE_REQUEST_STATUSES, 'leaveRequest.status');
  const decisionReason = item.decisionReason === null
    ? null
    : canonicalResponseString(item.decisionReason, 'leaveRequest.decisionReason', 500);
  const decidedBy = nullableStaffActorSnapshot(item.decidedBy, 'leaveRequest.decidedBy');
  const decidedAt = item.decidedAt === null ? null : isoTimestamp(item.decidedAt, 'leaveRequest.decidedAt');
  const hasDecision = decisionReason !== null && decidedBy !== null && decidedAt !== null;
  if (
    (decisionReason === null) !== (decidedBy === null)
    || (decidedBy === null) !== (decidedAt === null)
    || (status === 'pending' && hasDecision)
    || (status !== 'pending' && !hasDecision)
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'leaveRequest decision state is invalid');
  }
  return {
    id: uuidString(item.id, 'leaveRequest.id'),
    organizationId: uuidString(item.organizationId, 'leaveRequest.organizationId'),
    sessionId: uuidString(item.sessionId, 'leaveRequest.sessionId'),
    attendanceId: uuidString(item.attendanceId, 'leaveRequest.attendanceId'),
    studentId: uuidString(item.studentId, 'leaveRequest.studentId'),
    status,
    reason: canonicalResponseString(item.reason, 'leaveRequest.reason', 500),
    decisionReason,
    requestedBy: teachingActorSnapshot(item.requestedBy, 'leaveRequest.requestedBy'),
    decidedBy,
    decidedAt,
    createdAt: isoTimestamp(item.createdAt, 'leaveRequest.createdAt'),
    updatedAt: isoTimestamp(item.updatedAt, 'leaveRequest.updatedAt'),
  };
}

function makeupAttempt(value: unknown): TeachingMakeupAttempt {
  const item = exactRecord(value, [
    'id', 'organizationId', 'sourceSessionId', 'sourceAttendanceId', 'targetSessionId', 'targetAttendanceId',
    'studentId', 'studentPackageId', 'creditCost', 'status', 'reason', 'createdBy', 'resolvedBy',
    'resolutionReason', 'resolvedAt', 'createdAt', 'updatedAt',
  ], 'makeupAttempt');
  const status = enumValue(item.status, TEACHING_MAKEUP_ATTEMPT_STATUSES, 'makeupAttempt.status');
  const resolvedBy = nullableStaffActorSnapshot(item.resolvedBy, 'makeupAttempt.resolvedBy');
  const resolutionReason = item.resolutionReason === null
    ? null
    : canonicalResponseString(item.resolutionReason, 'makeupAttempt.resolutionReason', 500);
  const resolvedAt = item.resolvedAt === null ? null : isoTimestamp(item.resolvedAt, 'makeupAttempt.resolvedAt');
  const hasResolution = resolvedBy !== null && resolutionReason !== null && resolvedAt !== null;
  if (
    (resolvedBy === null) !== (resolutionReason === null)
    || (resolutionReason === null) !== (resolvedAt === null)
    || (status === 'scheduled' && hasResolution)
    || (status !== 'scheduled' && !hasResolution)
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'makeupAttempt resolution state is invalid');
  }
  const creditCost = integer(item.creditCost, 'makeupAttempt.creditCost', 1);
  if (creditCost > 1_000_000) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'makeupAttempt.creditCost is invalid');
  }
  return {
    id: uuidString(item.id, 'makeupAttempt.id'),
    organizationId: uuidString(item.organizationId, 'makeupAttempt.organizationId'),
    sourceSessionId: uuidString(item.sourceSessionId, 'makeupAttempt.sourceSessionId'),
    sourceAttendanceId: uuidString(item.sourceAttendanceId, 'makeupAttempt.sourceAttendanceId'),
    targetSessionId: uuidString(item.targetSessionId, 'makeupAttempt.targetSessionId'),
    targetAttendanceId: uuidString(item.targetAttendanceId, 'makeupAttempt.targetAttendanceId'),
    studentId: uuidString(item.studentId, 'makeupAttempt.studentId'),
    studentPackageId: uuidString(item.studentPackageId, 'makeupAttempt.studentPackageId'),
    creditCost,
    status,
    reason: canonicalResponseString(item.reason, 'makeupAttempt.reason', 500),
    createdBy: teachingStaffActorSnapshot(item.createdBy, 'makeupAttempt.createdBy'),
    resolvedBy,
    resolutionReason,
    resolvedAt,
    createdAt: isoTimestamp(item.createdAt, 'makeupAttempt.createdAt'),
    updatedAt: isoTimestamp(item.updatedAt, 'makeupAttempt.updatedAt'),
  };
}

function learnerSessionTeacher(value: unknown) {
  const item = exactRecord(value, ['displayName', 'role'], 'learnerSession.teacher');
  return {
    displayName: canonicalResponseString(item.displayName, 'learnerSession.teacher.displayName', 160),
    role: enumValue(item.role, TEACHING_LEARNER_TEACHER_ROLES, 'learnerSession.teacher.role'),
  };
}

function makeupCandidateTeacher(value: unknown) {
  const item = exactRecord(value, ['userId', 'displayName', 'role'], 'makeupCandidate.teacher');
  return {
    userId: positiveBigIntString(item.userId, 'makeupCandidate.teacher.userId'),
    displayName: canonicalResponseString(item.displayName, 'makeupCandidate.teacher.displayName', 160),
    role: enumValue(item.role, TEACHING_LEARNER_TEACHER_ROLES, 'makeupCandidate.teacher.role'),
  };
}

function learnerSessionAttendance(value: unknown) {
  const item = exactRecord(
    value,
    ['id', 'status', 'creditCost', 'updatedAt'],
    'learnerSession.attendance',
  );
  const creditCost = integer(item.creditCost, 'learnerSession.attendance.creditCost');
  if (creditCost > 1_000_000) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learnerSession.attendance.creditCost is invalid');
  }
  return {
    id: uuidString(item.id, 'learnerSession.attendance.id'),
    status: enumValue(item.status, TEACHING_ATTENDANCE_STATUSES, 'learnerSession.attendance.status'),
    creditCost,
    updatedAt: isoTimestamp(item.updatedAt, 'learnerSession.attendance.updatedAt'),
  };
}

function learnerSessionSummary(value: unknown): TeachingLearnerSessionSummary {
  const item = exactRecord(value, [
    'id', 'title', 'startsAt', 'endsAt', 'timezone', 'status', 'teachers', 'attendance', 'activeLeaveRequest',
  ], 'learnerSession');
  if (!Array.isArray(item.teachers)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learnerSession.teachers is invalid');
  }
  const activeLeaveRequest = item.activeLeaveRequest === null ? null : leaveRequest(item.activeLeaveRequest);
  const id = uuidString(item.id, 'learnerSession.id');
  const attendanceItem = learnerSessionAttendance(item.attendance);
  const startsAt = isoTimestamp(item.startsAt, 'learnerSession.startsAt');
  const endsAt = isoTimestamp(item.endsAt, 'learnerSession.endsAt');
  if (
    new Date(endsAt).getTime() <= new Date(startsAt).getTime()
    || (
    activeLeaveRequest !== null
    && (
      activeLeaveRequest.sessionId !== id
      || activeLeaveRequest.attendanceId !== attendanceItem.id
      || (activeLeaveRequest.status !== 'pending' && activeLeaveRequest.status !== 'approved')
    )
    )
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learnerSession state is invalid');
  }
  return {
    id,
    title: canonicalResponseString(item.title, 'learnerSession.title', 160),
    startsAt,
    endsAt,
    timezone: canonicalResponseString(item.timezone, 'learnerSession.timezone', 64),
    status: enumValue(item.status, TEACHING_SESSION_STATUSES, 'learnerSession.status'),
    teachers: item.teachers.map(learnerSessionTeacher),
    attendance: attendanceItem,
    activeLeaveRequest,
  };
}

function makeupCandidate(value: unknown): TeachingMakeupCandidate {
  const item = exactRecord(value, [
    'sessionId', 'title', 'startsAt', 'endsAt', 'timezone', 'teachers', 'attendanceId',
  ], 'makeupCandidate');
  if (!Array.isArray(item.teachers)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'makeupCandidate.teachers is invalid');
  }
  const startsAt = isoTimestamp(item.startsAt, 'makeupCandidate.startsAt');
  const endsAt = isoTimestamp(item.endsAt, 'makeupCandidate.endsAt');
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'makeupCandidate time range is invalid');
  }
  return {
    sessionId: uuidString(item.sessionId, 'makeupCandidate.sessionId'),
    title: canonicalResponseString(item.title, 'makeupCandidate.title', 160),
    startsAt,
    endsAt,
    timezone: canonicalResponseString(item.timezone, 'makeupCandidate.timezone', 64),
    teachers: item.teachers.map(makeupCandidateTeacher),
    attendanceId: item.attendanceId === null ? null : uuidString(item.attendanceId, 'makeupCandidate.attendanceId'),
  };
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

function parseLeaveMutation(
  value: unknown,
  sessionId: string,
  attendanceId: string,
  expectedStatus?: 'approved' | 'rejected' | 'cancelled',
): TeachingLeaveRequestMutationResult {
  const envelope = exactRecord(value, ['leaveRequest', 'attendance'], 'leave request mutation');
  const leave = leaveRequest(envelope.leaveRequest);
  const attendanceItem = attendance(envelope.attendance);
  if (
    leave.sessionId !== sessionId
    || leave.attendanceId !== attendanceId
    || attendanceItem.id !== attendanceId
    || attendanceItem.studentId !== leave.studentId
    || (expectedStatus !== undefined && leave.status !== expectedStatus)
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'leave request mutation response is invalid');
  }
  return { leaveRequest: leave, attendance: attendanceItem };
}

export async function listTeachingLeaveRequests(
  orgSlug: string,
  sessionId: string,
  pageNumber = 1,
  pageSize = 100,
): Promise<TeachingPage<TeachingLeaveRequest>> {
  const result = exactPage(
    await request(orgPath(
      orgSlug,
      `/sessions/${encodeURIComponent(sessionId)}/leave-requests${pageQuery(pageNumber, pageSize)}`,
    )),
    'leaveRequests',
    leaveRequest,
  );
  if (result.items.some((item) => item.sessionId !== sessionId)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'leave request page response is invalid');
  }
  return result;
}

export async function createTeachingLeaveRequest(
  orgSlug: string,
  sessionId: string,
  attendanceId: string,
  input: { reason: string },
  idempotencyKey: string,
): Promise<TeachingLeaveRequestMutationResult> {
  return parseLeaveMutation(
    await post(orgPath(
      orgSlug,
      `/sessions/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(attendanceId)}/leave-requests`,
    ), { reason: input.reason }, idempotencyKey),
    sessionId,
    attendanceId,
  );
}

export async function decideTeachingLeaveRequest(
  orgSlug: string,
  sessionId: string,
  attendanceId: string,
  leaveRequestId: string,
  input: { decision: 'approved' | 'rejected'; reason: string },
  idempotencyKey: string,
): Promise<TeachingLeaveRequestMutationResult> {
  const result = parseLeaveMutation(
    await post(orgPath(
      orgSlug,
      `/sessions/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(attendanceId)}/leave-requests/${encodeURIComponent(leaveRequestId)}/decision`,
    ), { decision: input.decision, reason: input.reason }, idempotencyKey),
    sessionId,
    attendanceId,
    input.decision,
  );
  if (result.leaveRequest.id !== leaveRequestId) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'leave request decision response is invalid');
  }
  return result;
}

export async function cancelTeachingLeaveRequest(
  orgSlug: string,
  sessionId: string,
  attendanceId: string,
  leaveRequestId: string,
  input: { reason: string },
  idempotencyKey: string,
): Promise<TeachingLeaveRequestMutationResult> {
  const result = parseLeaveMutation(
    await post(orgPath(
      orgSlug,
      `/sessions/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(attendanceId)}/leave-requests/${encodeURIComponent(leaveRequestId)}/cancel`,
    ), { reason: input.reason }, idempotencyKey),
    sessionId,
    attendanceId,
    'cancelled',
  );
  if (result.leaveRequest.id !== leaveRequestId) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'leave request cancellation response is invalid');
  }
  return result;
}

export async function listTeachingMakeupAttempts(
  orgSlug: string,
  sessionId: string,
  attendanceId: string,
  pageNumber = 1,
  pageSize = 100,
): Promise<TeachingPage<TeachingMakeupAttempt>> {
  const result = exactPage(
    await request(orgPath(
      orgSlug,
      `/sessions/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(attendanceId)}/makeups${pageQuery(pageNumber, pageSize)}`,
    )),
    'makeupAttempts',
    makeupAttempt,
  );
  if (result.items.some((item) => item.sourceSessionId !== sessionId || item.sourceAttendanceId !== attendanceId)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'makeup attempt page response is invalid');
  }
  return result;
}

export async function listTeachingMakeupCandidates(
  orgSlug: string,
  sessionId: string,
  attendanceId: string,
  pageNumber = 1,
  pageSize = 100,
): Promise<TeachingPage<TeachingMakeupCandidate>> {
  return exactPage(
    await request(orgPath(
      orgSlug,
      `/sessions/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(attendanceId)}/makeups/candidates${pageQuery(pageNumber, pageSize)}`,
    )),
    'candidates',
    makeupCandidate,
  );
}

export async function createTeachingMakeupAttempt(
  orgSlug: string,
  sessionId: string,
  attendanceId: string,
  input: { targetSessionId: string; reason: string },
  idempotencyKey: string,
): Promise<TeachingMakeupMutationResult> {
  const envelope = exactRecord(
    await post(orgPath(
      orgSlug,
      `/sessions/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(attendanceId)}/makeups`,
    ), { targetSessionId: input.targetSessionId, reason: input.reason }, idempotencyKey),
    ['makeupAttempt', 'attendance'],
    'makeup attempt mutation',
  );
  const attempt = makeupAttempt(envelope.makeupAttempt);
  const attendanceItem = attendance(envelope.attendance);
  if (
    attempt.sourceSessionId !== sessionId
    || attempt.sourceAttendanceId !== attendanceId
    || attempt.targetSessionId !== input.targetSessionId
    || attempt.targetAttendanceId !== attendanceItem.id
    || attempt.studentId !== attendanceItem.studentId
    || attempt.status !== 'scheduled'
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'makeup attempt mutation response is invalid');
  }
  return { makeupAttempt: attempt, attendance: attendanceItem };
}

export async function cancelTeachingSession(
  orgSlug: string,
  sessionId: string,
  input: { reason: string },
  idempotencyKey: string,
): Promise<TeachingSessionCancellationResult> {
  const envelope = exactRecord(
    await post(orgPath(orgSlug, `/sessions/${encodeURIComponent(sessionId)}/cancel`), { reason: input.reason }, idempotencyKey),
    ['session', 'makeupAttempts'],
    'session cancellation',
  );
  if (!Array.isArray(envelope.makeupAttempts)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'session cancellation.makeupAttempts is invalid');
  }
  const sessionItem = sessionDetail(envelope.session);
  const makeupAttempts = envelope.makeupAttempts.map(makeupAttempt);
  if (
    sessionItem.id !== sessionId
    || sessionItem.status !== 'cancelled'
    || makeupAttempts.some((item) => (
      (item.sourceSessionId !== sessionId && item.targetSessionId !== sessionId)
      || item.status !== 'cancelled'
    ))
  ) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'session cancellation response is invalid');
  }
  return { session: sessionItem, makeupAttempts };
}

export async function saveTeachingAttendanceBatch(
  orgSlug: string,
  sessionId: string,
  records: Array<{ attendanceId: string; status: Exclude<TeachingAttendanceStatus, 'expected' | 'excused'> }>,
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

function learnerSessionPath(orgSlug: string, studentId: string, suffix = ''): string {
  return orgPath(orgSlug, `/me/students/${encodeURIComponent(studentId)}/sessions${suffix}`);
}

export async function listLearnerTeachingSessions(
  orgSlug: string,
  studentId: string,
  pageNumber = 1,
  pageSize = 25,
): Promise<TeachingPage<TeachingLearnerSessionSummary>> {
  const result = exactPage(
    await request(learnerSessionPath(orgSlug, studentId, pageQuery(pageNumber, pageSize))),
    'sessions',
    learnerSessionSummary,
  );
  if (result.items.some((item) => item.activeLeaveRequest !== null && item.activeLeaveRequest.studentId !== studentId)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learner session page response is invalid');
  }
  return result;
}

export async function listLearnerTeachingLeaveRequests(
  orgSlug: string,
  studentId: string,
  sessionId: string,
  pageNumber = 1,
  pageSize = 100,
): Promise<TeachingPage<TeachingLeaveRequest>> {
  const result = exactPage(
    await request(learnerSessionPath(
      orgSlug,
      studentId,
      `/${encodeURIComponent(sessionId)}/leave-requests${pageQuery(pageNumber, pageSize)}`,
    )),
    'leaveRequests',
    leaveRequest,
  );
  if (result.items.some((item) => item.studentId !== studentId || item.sessionId !== sessionId)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learner leave request page response is invalid');
  }
  return result;
}

export async function createLearnerTeachingLeaveRequest(
  orgSlug: string,
  studentId: string,
  sessionId: string,
  attendanceId: string,
  input: { reason: string },
  idempotencyKey: string,
): Promise<TeachingLeaveRequestMutationResult> {
  const result = parseLeaveMutation(
    await post(learnerSessionPath(
      orgSlug,
      studentId,
      `/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(attendanceId)}/leave-requests`,
    ), { reason: input.reason }, idempotencyKey),
    sessionId,
    attendanceId,
  );
  if (result.leaveRequest.studentId !== studentId) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learner leave request mutation response is invalid');
  }
  return result;
}

export async function cancelLearnerTeachingLeaveRequest(
  orgSlug: string,
  studentId: string,
  sessionId: string,
  attendanceId: string,
  leaveRequestId: string,
  input: { reason: string },
  idempotencyKey: string,
): Promise<TeachingLeaveRequestMutationResult> {
  const result = parseLeaveMutation(
    await post(learnerSessionPath(
      orgSlug,
      studentId,
      `/${encodeURIComponent(sessionId)}/attendance/${encodeURIComponent(attendanceId)}/leave-requests/${encodeURIComponent(leaveRequestId)}/cancel`,
    ), { reason: input.reason }, idempotencyKey),
    sessionId,
    attendanceId,
    'cancelled',
  );
  if (result.leaveRequest.id !== leaveRequestId || result.leaveRequest.studentId !== studentId) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, 'learner leave request cancellation response is invalid');
  }
  return result;
}
