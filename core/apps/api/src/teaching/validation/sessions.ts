import { type TeachingAttendanceStatus } from '@cuberoot/shared/teaching';
import { type JsonObject, type CreateSessionInput, type AttendanceBatchInput, type LeaveRequestInput, type LeaveDecisionInput, type MakeupScheduleInput, type SessionCancelInput } from '../types.js';
import { requiredTimestamp, requiredUuid, requiredInteger, requiredString, validTimezone, assertOnlyKeys } from './common.js';
import { TeachingApiException } from '../errors.js';

export function parseSessionInput(body: JsonObject): CreateSessionInput {
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

export function parseAttendanceBatchInput(body: JsonObject): AttendanceBatchInput {
  assertOnlyKeys(body, ['records'], 'attendance batch input');
  if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > 500) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'records must contain 1 to 500 attendance updates');
  }
  const records = body.records.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new TeachingApiException('INVALID_INPUT', 400, `records[${index}] must be an object`);
    }
    const item = raw as JsonObject;
    assertOnlyKeys(item, ['attendanceId', 'status'], `records[${index}]`);
    if (!['present', 'late', 'absent'].includes(String(item.status))) {
      throw new TeachingApiException(
        'INVALID_INPUT', 400,
        `records[${index}].status must be present, late, or absent; excused requires leave approval`,
      );
    }
    return {
      attendanceId: requiredUuid(item, 'attendanceId'),
      status: item.status as Extract<TeachingAttendanceStatus, 'present' | 'late' | 'absent'>,
    };
  });
  if (new Set(records.map((item) => item.attendanceId)).size !== records.length) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'records must not repeat an attendanceId');
  }
  return { records };
}

export function parseLeaveRequestInput(body: JsonObject): LeaveRequestInput {
  assertOnlyKeys(body, ['reason'], 'leave request input');
  return { reason: requiredString(body, 'reason', 500) };
}

export function parseLeaveDecisionInput(body: JsonObject): LeaveDecisionInput {
  assertOnlyKeys(body, ['decision', 'reason'], 'leave decision input');
  if (body.decision !== 'approved' && body.decision !== 'rejected') {
    throw new TeachingApiException('INVALID_INPUT', 400, 'decision must be approved or rejected');
  }
  return { decision: body.decision, reason: requiredString(body, 'reason', 500) };
}

export function parseMakeupScheduleInput(body: JsonObject): MakeupScheduleInput {
  assertOnlyKeys(body, ['targetSessionId', 'reason'], 'makeup schedule input');
  return {
    targetSessionId: requiredUuid(body, 'targetSessionId'),
    reason: requiredString(body, 'reason', 500),
  };
}

export function parseSessionCancelInput(body: JsonObject): SessionCancelInput {
  assertOnlyKeys(body, ['reason'], 'session cancellation input');
  return { reason: requiredString(body, 'reason', 500) };
}
