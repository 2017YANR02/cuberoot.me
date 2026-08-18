import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionTokenMock } = vi.hoisted(() => ({
  getSessionTokenMock: vi.fn<() => string | null>(() => 'session-token'),
}));

vi.mock('@/lib/auth-store', () => ({
  getSessionToken: getSessionTokenMock,
}));

vi.mock('@/lib/api-base', () => ({
  apiUrl: (path: string) => `https://api.example.test${path}`,
}));

import {
  createTeachingStudent,
  listTeachingOrganizations,
  listTeachingStudents,
} from '@/lib/teaching-saas-api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function organization(overrides: Record<string, unknown> = {}) {
  return {
    id: '018f3e56-31a5-7a88-9b45-337ccdbf7284',
    slug: 'cube-academy',
    name: 'Cube Academy',
    timezone: 'Asia/Shanghai',
    status: 'active',
    version: 1,
    role: 'owner',
    ...overrides,
  };
}

function student() {
  return {
    id: '018f3e56-31a5-7a88-9b45-337ccdbf7285',
    accountUserId: null,
    externalRef: 'S-001',
    displayName: 'Student One',
    status: 'active',
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
  };
}

describe('teaching SaaS client', () => {
  beforeEach(() => {
    getSessionTokenMock.mockReturnValue('session-token');
    vi.unstubAllGlobals();
  });

  it('uses the authenticated no-store API and validates organization enums', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => (
      jsonResponse({ organizations: [organization()] })
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listTeachingOrganizations()).resolves.toEqual([organization()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, initValue] = fetchMock.mock.calls[0]!;
    const init = initValue as RequestInit;
    expect(url).toBe('https://api.example.test/v1/teaching/organizations');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer session-token',
    });
  });

  it('rejects response enum drift instead of widening it with a type assertion', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ organizations: [organization({ role: 'super-owner' })] })));

    await expect(listTeachingOrganizations()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 502,
    });
  });

  it('sends mutation idempotency and keeps the body free of actor identity', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => (
      jsonResponse({ student: student() }, 201)
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createTeachingStudent('cube academy', {
      displayName: 'Student One',
      externalRef: 'S-001',
    }, 'operation-key')).resolves.toEqual(student());

    const [url, initValue] = fetchMock.mock.calls[0]!;
    const init = initValue as RequestInit;
    expect(url).toBe('https://api.example.test/v1/teaching/organizations/cube%20academy/students');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Idempotency-Key': 'operation-key',
    });
    expect(JSON.parse(String(init.body))).toEqual({ displayName: 'Student One', externalRef: 'S-001' });
  });

  it('normalizes pagination inputs before they reach the API', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      students: [student()],
      total: 1,
      page: 1,
      pageSize: 100,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await listTeachingStudents('cube-academy', 0, 999);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/v1/teaching/organizations/cube-academy/students?page=1&pageSize=100');
  });

  it('does not call fetch without a main-site session', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    getSessionTokenMock.mockReturnValue(null);

    await expect(listTeachingOrganizations()).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('preserves the structured Core error without exposing the raw response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'hidden', requestId: 'req-1' },
    }, 404)));

    await expect(listTeachingStudents('missing')).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      status: 404,
      requestId: 'req-1',
    });
  });
});
