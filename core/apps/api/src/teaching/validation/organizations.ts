import { isTeachingOrganizationRole } from '@cuberoot/shared/teaching';
import { type Context } from 'hono';
import { type JsonObject, type CreateOrganizationInput, type CreateMemberInput, type CreateStudentInput, type CreateCampusInput, type CreateGroupInput, type CreateStudentGroupMembershipInput, type CreateTeacherAssignmentInput, type TeacherAssignmentTarget } from '../types.js';
import { requiredString, optionalString, optionalNormalizedCode, validTimezone, optionalUuid, requiredUuid, parseEffectiveRange, uuidParam } from './common.js';
import { TeachingApiException } from '../errors.js';

export function parseOrganizationInput(body: JsonObject): CreateOrganizationInput {
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

export function parseMemberInput(body: JsonObject): CreateMemberInput {
  if (!Number.isSafeInteger(body.userId) || (body.userId as number) <= 0) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'userId must be a positive integer');
  }
  if (!isTeachingOrganizationRole(body.role) || body.role === 'owner') {
    throw new TeachingApiException('INVALID_INPUT', 400, 'role must be admin, teacher, assistant, finance, or viewer');
  }
  return { userId: body.userId as number, role: body.role };
}

export function parseStudentInput(body: JsonObject): CreateStudentInput {
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

export function parseCampusInput(body: JsonObject): CreateCampusInput {
  const timezone = optionalString(body, 'timezone', 64);
  return {
    code: optionalNormalizedCode(body),
    name: requiredString(body, 'name', 160),
    timezone: timezone === null ? null : validTimezone(timezone),
  };
}

export function parseGroupInput(body: JsonObject): CreateGroupInput {
  return {
    campusId: optionalUuid(body, 'campusId'),
    code: optionalNormalizedCode(body),
    name: requiredString(body, 'name', 160),
  };
}

export function parseStudentGroupMembershipInput(body: JsonObject): CreateStudentGroupMembershipInput {
  return {
    studentId: requiredUuid(body, 'studentId'),
    ...parseEffectiveRange(body),
  };
}

export function parseTeacherAssignmentInput(body: JsonObject): CreateTeacherAssignmentInput {
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

export function teacherAssignmentTargetOf(c: Context): TeacherAssignmentTarget {
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
