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
  completeTeachingSession,
  createTeachingSession,
  createTeachingGroupMembership,
  createTeachingMember,
  createTeachingTeacherAssignment,
  listTeachingPackageProducts,
  listTeachingGroupMemberships,
  createTeachingStudent,
  listTeachingOrganizations,
  listTeachingStudents,
  listTeachingTeacherAssignments,
  saveTeachingAttendanceBatch,
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

function membership() {
  return {
    id: '018f3e56-31a5-7a88-9b45-337ccdbf7290',
    groupId: '018f3e56-31a5-7a88-9b45-337ccdbf7291',
    effectiveFrom: '2026-08-18T00:00:00.000Z',
    effectiveTo: null,
    createdAt: '2026-08-18T00:00:00.000Z',
    student: {
      id: student().id,
      externalRef: 'S-001',
      displayName: 'Student One',
      status: 'active',
    },
  };
}

function teacherAssignment() {
  return {
    id: '018f3e56-31a5-7a88-9b45-337ccdbf7292',
    teacherUserId: 42,
    teacherUserIdSnapshot: 42,
    groupId: membership().groupId,
    studentId: null,
    effectiveFrom: '2026-08-18T00:00:00.000Z',
    effectiveTo: null,
    createdAt: '2026-08-18T00:00:00.000Z',
    teacher: {
      userId: 42,
      displayName: 'Teacher One',
      role: 'teacher',
      status: 'active',
    },
  };
}

function packageProduct() {
  return {
    id: '018f3e56-31a5-7a88-9b45-337ccdbf7293',
    code: 'TEN-LESSONS',
    name: 'Ten lessons',
    status: 'active',
    creditUnit: 'lesson',
    creditType: 'lesson',
    totalCredits: 10,
    validityDays: 90,
    priceAmountMinor: 100000,
    currency: 'CNY',
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
  };
}

function attendance() {
  return {
    id: '018f3e56-31a5-7a88-9b45-337ccdbf7294',
    studentId: student().id,
    studentPackageId: null,
    status: 'present',
    creditCost: 1,
    notes: '',
    updatedAt: '2026-08-18T00:00:00.000Z',
  };
}

function session() {
  return {
    id: '018f3e56-31a5-7a88-9b45-337ccdbf7295',
    title: 'Tuesday class',
    startsAt: '2026-08-18T10:00:00.000Z',
    endsAt: '2026-08-18T11:00:00.000Z',
    timezone: 'Asia/Shanghai',
    status: 'scheduled',
    version: 1,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    teachers: [],
    attendanceCount: 1,
    createdAt: '2026-08-18T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
    attendance: [attendance()],
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

  it('uses the Core membership contract without inventing a client-side relationship shape', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({ membership: membership() }, 201);
      return jsonResponse({ memberships: [membership()], total: 1, page: 1, pageSize: 100 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(listTeachingGroupMemberships('cube-academy', membership().groupId, 1, 100)).resolves.toMatchObject({
      items: [membership()],
      total: 1,
    });
    await createTeachingGroupMembership('cube-academy', membership().groupId, {
      studentId: student().id,
      effectiveFrom: membership().effectiveFrom,
      effectiveTo: null,
    }, 'membership-key');

    const [url, initValue] = fetchMock.mock.calls[1]!;
    expect(url).toBe(`https://api.example.test/v1/teaching/organizations/cube-academy/groups/${membership().groupId}/students`);
    expect((initValue as RequestInit).headers).toMatchObject({ 'Idempotency-Key': 'membership-key' });
    expect(JSON.parse(String((initValue as RequestInit).body))).toEqual({
      studentId: student().id,
      effectiveFrom: membership().effectiveFrom,
      effectiveTo: null,
    });
  });

  it('keeps teacher assignment target XOR in the query and mutation body', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({ assignment: teacherAssignment() }, 201);
      return jsonResponse({ assignments: [teacherAssignment()], total: 1, page: 1, pageSize: 100 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await listTeachingTeacherAssignments('cube-academy', { groupId: membership().groupId }, 1, 100);
    await createTeachingTeacherAssignment('cube-academy', {
      teacherUserId: 42,
      groupId: membership().groupId,
      studentId: null,
      effectiveFrom: teacherAssignment().effectiveFrom,
      effectiveTo: null,
    }, 'assignment-key');

    expect(fetchMock.mock.calls[0]![0]).toBe(`https://api.example.test/v1/teaching/organizations/cube-academy/teacher-assignments?groupId=${membership().groupId}&page=1&pageSize=100`);
    const [, initValue] = fetchMock.mock.calls[1]!;
    expect(JSON.parse(String((initValue as RequestInit).body))).toEqual({
      teacherUserId: 42,
      groupId: membership().groupId,
      studentId: null,
      effectiveFrom: teacherAssignment().effectiveFrom,
      effectiveTo: null,
    });
  });

  it('parses package products from the canonical Core wire shape', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      packageProducts: [packageProduct()],
      total: 1,
      page: 1,
      pageSize: 100,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listTeachingPackageProducts('cube academy', 0, 999)).resolves.toMatchObject({
      items: [packageProduct()],
      total: 1,
      pageSize: 100,
    });
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.example.test/v1/teaching/organizations/cube%20academy/package-products?page=1&pageSize=100');
  });

  it('creates a session with the exact Core body and idempotency key', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ session: session() }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const input = {
      title: 'Tuesday class',
      startsAt: session().startsAt,
      endsAt: session().endsAt,
      timezone: 'Asia/Shanghai',
      teacherUserIds: [42],
      attendees: [{ studentId: student().id, studentPackageId: packageProduct().id, creditCost: 1 }],
    };

    await expect(createTeachingSession('cube-academy', input, 'session-key')).resolves.toMatchObject({
      id: session().id,
      attendance: [{ displayName: null, studentPackageId: null }],
    });
    const [, initValue] = fetchMock.mock.calls[0]!;
    const init = initValue as RequestInit;
    expect(init.headers).toMatchObject({ 'Idempotency-Key': 'session-key' });
    expect(JSON.parse(String(init.body))).toEqual(input);
  });

  it('saves only attendance ids and statuses and accepts the narrow batch response', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ attendance: [attendance()] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(saveTeachingAttendanceBatch('cube-academy', session().id, [
      { attendanceId: attendance().id, status: 'present' },
    ], 'attendance-key')).resolves.toEqual([{ ...attendance(), displayName: null }]);
    const [, initValue] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String((initValue as RequestInit).body))).toEqual({
      records: [{ attendanceId: attendance().id, status: 'present' }],
    });
  });

  it('completes a session with an empty mutation body', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      session: { id: session().id, status: 'completed', completedAt: '2026-08-18T11:00:00.000Z' },
      consumption: { attendanceCount: 1, totalCredits: 1 },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(completeTeachingSession('cube-academy', session().id, 'complete-key')).resolves.toMatchObject({
      session: { status: 'completed' },
      consumption: { attendanceCount: 1, totalCredits: 1 },
    });
    const [, initValue] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String((initValue as RequestInit).body))).toEqual({});
  });

  it('parses the narrow member-create response while preserving the organization role model', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      member: { userId: 42, displayName: 'Teacher One', role: 'teacher', status: 'active' },
    }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createTeachingMember('cube-academy', { userId: 42, role: 'teacher' }, 'member-key')).resolves.toEqual({
      userId: 42,
      displayName: 'Teacher One',
      avatarUrl: null,
      role: 'teacher',
      status: 'active',
      joinedAt: null,
      createdAt: null,
    });
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
