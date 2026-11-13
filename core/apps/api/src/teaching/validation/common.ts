import { type JsonObject } from '../types.js';
import { TeachingApiException } from '../errors.js';

export function assertOnlyKeys(body: JsonObject, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(body).find((key) => !allowedSet.has(key));
  if (unexpected) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${unexpected} is not accepted in ${label}`);
  }
}

export function requiredString(body: JsonObject, key: string, maxLength: number): string {
  const value = body[key];
  if (typeof value !== 'string') {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be 1 to ${maxLength} characters`);
  }
  return trimmed;
}

export function optionalString(body: JsonObject, key: string, maxLength: number): string | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a string or null`);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be 1 to ${maxLength} characters or null`);
  }
  return trimmed;
}

export function requiredInteger(body: JsonObject, key: string, min: number, max: number): number {
  const value = body[key];
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be an integer from ${min} to ${max}`);
  }
  return value as number;
}

export function requiredUuid(body: JsonObject, key: string): string {
  const value = requiredString(body, key, 36).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a UUID`);
  }
  return value;
}

export function optionalUuid(body: JsonObject, key: string): string | null {
  if (body[key] === undefined || body[key] === null) return null;
  return requiredUuid(body, key);
}

export function uuidParam(value: string, key: string): string {
  return requiredUuid({ [key]: value }, key);
}

const PG_BIGINT_MAX = 9_223_372_036_854_775_807n;

export function bigintParam(value: string, key: string): string {
  if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > PG_BIGINT_MAX) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a positive PostgreSQL BIGINT decimal`);
  }
  return value;
}

export function requiredTimestamp(body: JsonObject, key: string): string {
  const value = requiredString(body, key, 40);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:(Z)|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be an ISO 8601 timestamp with an offset`);
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zulu, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = zulu ? 0 : Number(offsetHourText);
  const offsetMinute = zulu ? 0 : Number(offsetMinuteText);
  const daysInMonth = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;
  if (
    year < 1 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59 ||
    offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)
  ) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a valid timestamp`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a valid timestamp`);
  }
  return date.toISOString();
}

export function validTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
  } catch {
    throw new TeachingApiException('INVALID_INPUT', 400, 'timezone must be a valid IANA time zone');
  }
  return value;
}

export function optionalNormalizedCode(body: JsonObject): string | null {
  const code = optionalString(body, 'code', 64)?.toLowerCase() ?? null;
  if (code !== null && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(code)) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'code must use lowercase letters, numbers, underscores, or hyphens');
  }
  return code;
}

export function parseEffectiveRange(body: JsonObject): { effectiveFrom: string; effectiveTo: string | null } {
  const effectiveFrom = body.effectiveFrom === undefined
    ? new Date().toISOString()
    : requiredTimestamp(body, 'effectiveFrom');
  const effectiveTo = body.effectiveTo === undefined || body.effectiveTo === null
    ? null
    : requiredTimestamp(body, 'effectiveTo');
  if (effectiveTo !== null && new Date(effectiveTo).getTime() <= new Date(effectiveFrom).getTime()) {
    throw new TeachingApiException('INVALID_INPUT', 400, 'effectiveTo must be after effectiveFrom');
  }
  return { effectiveFrom, effectiveTo };
}

export function requiredMonday(body: JsonObject, key: string): string {
  const value = requiredString(body, key, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be an ISO date`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || date.getUTCDay() !== 1) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be a valid Monday`);
  }
  return value;
}

export function requiredUuidArray(body: JsonObject, key: string): string[] {
  const value = body[key];
  if (!Array.isArray(value) || value.length > 100) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must be an array containing at most 100 UUIDs`);
  }
  const result = value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new TeachingApiException('INVALID_INPUT', 400, `${key}[${index}] must be a UUID`);
    }
    return uuidParam(entry, `${key}[${index}]`);
  });
  if (new Set(result).size !== result.length) {
    throw new TeachingApiException('INVALID_INPUT', 400, `${key} must not contain duplicates`);
  }
  return result.sort();
}
