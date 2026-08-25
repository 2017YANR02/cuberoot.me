import { createHash } from 'node:crypto';
import type { Context } from 'hono';
import { badRequest, PlatformApiError } from './errors.js';

export type JsonObject = Record<string, unknown>;

export async function readJsonObject(c: Context): Promise<JsonObject> {
  let value: unknown;
  try {
    value = await c.req.json();
  } catch {
    badRequest('Request body must be valid JSON');
  }
  if (!isObject(value)) badRequest('Request body must be a JSON object');
  return value;
}

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function objectField(
  body: JsonObject,
  key: string,
  options: { required?: boolean } = {},
): JsonObject | undefined {
  const raw = body[key];
  if (raw == null) {
    if (options.required) badRequest(`${key} is required`);
    return undefined;
  }
  if (!isObject(raw)) badRequest(`${key} must be an object`);
  return raw;
}

export function arrayField(
  body: JsonObject,
  key: string,
  options: { required?: boolean; maxItems?: number } = {},
): unknown[] | undefined {
  const raw = body[key];
  if (raw == null) {
    if (options.required) badRequest(`${key} is required`);
    return undefined;
  }
  if (!Array.isArray(raw) || raw.length > (options.maxItems ?? 1000)) {
    badRequest(`${key} must be an array`);
  }
  return raw;
}

export function stringField(
  body: JsonObject,
  key: string,
  options: { required?: boolean; min?: number; max?: number; pattern?: RegExp; trim?: boolean } = {},
): string | undefined {
  const raw = body[key];
  if (raw == null) {
    if (options.required) badRequest(`${key} is required`);
    return undefined;
  }
  if (typeof raw !== 'string') badRequest(`${key} must be a string`);
  const value = options.trim === false ? raw : raw.trim();
  const min = options.min ?? (options.required ? 1 : 0);
  if (value.length < min || value.length > (options.max ?? 10_000)) {
    badRequest(`${key} has an invalid length`);
  }
  if (options.pattern && !options.pattern.test(value)) badRequest(`${key} has an invalid format`);
  return value;
}

export function nullableStringField(
  body: JsonObject,
  key: string,
  options: { max?: number; trim?: boolean } = {},
): string | null | undefined {
  if (!(key in body)) return undefined;
  if (body[key] === null || body[key] === '') return null;
  return stringField(body, key, options);
}

export function booleanField(body: JsonObject, key: string): boolean | undefined {
  if (!(key in body)) return undefined;
  if (typeof body[key] !== 'boolean') badRequest(`${key} must be a boolean`);
  return body[key];
}

export function integerField(
  body: JsonObject,
  key: string,
  options: { required?: boolean; min?: number; max?: number } = {},
): number | undefined {
  const raw = body[key];
  if (raw == null) {
    if (options.required) badRequest(`${key} is required`);
    return undefined;
  }
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw)) badRequest(`${key} must be an integer`);
  if (raw < (options.min ?? Number.MIN_SAFE_INTEGER) || raw > (options.max ?? Number.MAX_SAFE_INTEGER)) {
    badRequest(`${key} is out of range`);
  }
  return raw;
}

export function enumField<T extends string>(
  body: JsonObject,
  key: string,
  allowed: readonly T[],
  options: { required?: boolean } = {},
): T | undefined {
  const value = stringField(body, key, { required: options.required, max: 80 });
  if (value == null) return undefined;
  if (!allowed.includes(value as T)) badRequest(`${key} has an unsupported value`);
  return value as T;
}

export function stringArrayField(
  body: JsonObject,
  key: string,
  options: { maxItems?: number; maxLength?: number } = {},
): string[] | undefined {
  if (!(key in body)) return undefined;
  const raw = body[key];
  if (!Array.isArray(raw) || raw.length > (options.maxItems ?? 100)) badRequest(`${key} must be an array`);
  return raw.map((item, index) => {
    if (typeof item !== 'string') badRequest(`${key}[${index}] must be a string`);
    const value = item.trim();
    if (!value || value.length > (options.maxLength ?? 200)) badRequest(`${key}[${index}] has an invalid length`);
    return value;
  });
}

export function resourceId(value: string, label = 'id'): string {
  const id = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)) badRequest(`${label} has an invalid format`);
  return id;
}

export function positiveIntegerParam(value: string, label = 'id'): number {
  if (!/^[1-9]\d*$/.test(value)) badRequest(`${label} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) badRequest(`${label} is out of range`);
  return parsed;
}

export function pagination(c: Context, maxPageSize = 100): { page: number; pageSize: number; offset: number } {
  const pageRaw = c.req.query('page') ?? '1';
  const sizeRaw = c.req.query('pageSize') ?? '20';
  if (!/^[1-9]\d*$/.test(pageRaw) || !/^[1-9]\d*$/.test(sizeRaw)) badRequest('Invalid pagination');
  const page = Number(pageRaw);
  const pageSize = Number(sizeRaw);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(pageSize) || pageSize > maxPageSize) {
    badRequest('Invalid pagination');
  }
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function approvedQrTarget(raw: string): string {
  const value = raw.trim();
  if (!value || value.length > 4000 || /[\u0000-\u001f\u007f]/.test(value)) {
    badRequest('targetUrl has an invalid length or contains control characters');
  }
  if (/^\/[A-Za-z0-9/_?&=.#%+~-]*$/.test(value) && !value.startsWith('//')) return value;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    badRequest('targetUrl must be a site path or an http/https URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    badRequest('targetUrl must be a site path or an http/https URL');
  }
  return url.toString();
}

export function idempotencyKey(c: Context): string {
  const key = c.req.header('Idempotency-Key')?.trim() ?? '';
  if (!/^[\x21-\x7E]{8,128}$/.test(key)) {
    throw new PlatformApiError(
      'BAD_REQUEST',
      400,
      'Idempotency-Key must contain 8-128 visible ASCII characters',
    );
  }
  return key;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

export function requestHash(scope: string, actorId: number | null, body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify({ scope, actorId, body: stableValue(body) }), 'utf8')
    .digest('hex');
}

export function isoTimestampField(body: JsonObject, key: string): string | null | undefined {
  const value = nullableStringField(body, key, { max: 40 });
  if (value == null) return value;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) badRequest(`${key} must be an ISO timestamp`);
  return new Date(time).toISOString();
}
