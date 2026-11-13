import { type TeachingJsonValue } from '@cuberoot/shared/teaching';
import { TeachingApiError } from './errors';

export function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} response is invalid`);
  }
  return value as Record<string, unknown>;
}

export function exactRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
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

export function string(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return value;
}

export function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return string(value, label);
}

export function optionalNullableString(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  return string(value, label);
}

function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return value;
}

export function integer(value: unknown, label: string, minimum = 0): number {
  const parsed = number(value, label);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return parsed;
}

export function isoDate(value: unknown, label: string): string {
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

export function enumValue<const T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  const parsed = string(value, label);
  if (!(values as readonly string[]).includes(parsed)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return parsed as T[number];
}

const POSTGRES_BIGINT_MAX = '9223372036854775807';

export function positiveBigIntString(value: unknown, label: string): string {
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

export function unicodeCodePointLength(value: string): number {
  return Array.from(value).length;
}

export function isoTimestamp(value: unknown, label: string): string {
  const parsed = string(value, label);
  const timestamp = Date.parse(parsed);
  if (Number.isNaN(timestamp) || new Date(timestamp).toISOString() !== parsed) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return parsed;
}

export function jsonValue(value: unknown, label: string): TeachingJsonValue {
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

export function nullableNumber(value: unknown, label: string): number | null {
  if (value === null) return null;
  return number(value, label);
}

export function nullableInteger(value: unknown, label: string, minimum = 0): number | null {
  if (value === null) return null;
  return integer(value, label, minimum);
}

export function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return value;
}

export function uuidString(value: unknown, label: string): string {
  const parsed = string(value, label);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return parsed;
}

export function canonicalResponseString(value: unknown, label: string, maximum: number): string {
  const parsed = string(value, label);
  if (parsed.length < 1 || parsed.length > maximum || parsed.trim() !== parsed) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return parsed;
}

export function canonicalBoundedResponseString(value: unknown, label: string, maximum: number): string {
  const parsed = string(value, label);
  if (parsed.length > maximum || parsed.trim() !== parsed) {
    throw new TeachingApiError('INVALID_RESPONSE', 502, `${label} is invalid`);
  }
  return parsed;
}
