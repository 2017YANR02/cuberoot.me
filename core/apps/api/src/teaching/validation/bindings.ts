import { type JsonObject, type CreateStudentAccountBindingInviteInput, type CreateGuardianAccountBindingInviteInput } from '../types.js';
import { assertOnlyKeys, requiredInteger, requiredString } from './common.js';
import { TeachingApiException } from '../errors.js';

const STUDENT_ACCOUNT_BINDING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function parseStudentAccountBindingInviteInput(body: JsonObject): CreateStudentAccountBindingInviteInput {
  assertOnlyKeys(body, ['expiresInMinutes'], 'student account binding invite input');
  const expiresInMinutes = body.expiresInMinutes === undefined
    ? 60
    : requiredInteger(body, 'expiresInMinutes', 5, 1_440);
  return { expiresInMinutes };
}

export function parseStudentAccountBindingConsumeInput(body: JsonObject): { token: string } {
  assertOnlyKeys(body, ['token'], 'student account binding consume input');
  const token = requiredString(body, 'token', 43);
  if (!STUDENT_ACCOUNT_BINDING_TOKEN_PATTERN.test(token)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'token must be a 32-byte base64url value');
  }
  return { token };
}

export function parseGuardianAccountBindingInviteInput(body: JsonObject): CreateGuardianAccountBindingInviteInput {
  assertOnlyKeys(body, ['expiresInMinutes'], 'guardian account binding invite input');
  const expiresInMinutes = body.expiresInMinutes === undefined
    ? 60
    : requiredInteger(body, 'expiresInMinutes', 5, 1_440);
  return { expiresInMinutes };
}

export function parseGuardianAccountBindingConsumeInput(body: JsonObject): { token: string } {
  assertOnlyKeys(body, ['token'], 'guardian account binding consume input');
  const token = requiredString(body, 'token', 43);
  if (!STUDENT_ACCOUNT_BINDING_TOKEN_PATTERN.test(token)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'token must be a 32-byte base64url value');
  }
  return { token };
}
