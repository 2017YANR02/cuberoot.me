import {
  TEACHING_CAMPUS_STATUSES,
  TEACHING_GROUP_STATUSES,
  TEACHING_ORGANIZATION_ROLES,
  TEACHING_ORGANIZATION_STATUSES,
  TEACHING_STUDENT_STATUSES,
  type TeachingCampus,
  type TeachingGroup,
  type TeachingOrganizationRole,
  type TeachingOrganizationStatus,
  type TeachingStudentStatus,
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
