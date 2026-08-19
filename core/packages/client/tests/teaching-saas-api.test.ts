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
  generateTeachingWeeklyReport,
  getTeachingWeeklyReport,
  listTeachingPackageProducts,
  listTeachingGroupMemberships,
  createTeachingStudent,
  listTeachingOrganizations,
  listTeachingStudents,
  listTeachingTeacherAssignments,
  listTeachingWeeklyReports,
  publishTeachingWeeklyReport,
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

function weeklyReport() {
  return {
    id: '018f3e56-31a5-7a88-9b45-337ccdbf7296',
    organizationId: organization().id,
    studentId: student().id,
    studentDisplayNameSnapshot: student().displayName,
    studentExternalRefSnapshot: student().externalRef,
    weekStart: '2026-08-17',
    weekEnd: '2026-08-23',
    timezoneSnapshot: 'Asia/Shanghai',
    revision: 1,
    status: 'draft',
    visibility: 'staff_only',
    teacherSummary: '',
    nextWeekPlan: '',
    generatedByUserId: 42,
    generatedByUserIdSnapshot: 42,
    generatedByDisplayNameSnapshot: 'Teacher One',
    generatedByRoleSnapshot: 'teacher',
    generatedAt: '2026-08-18T12:00:00.000Z',
    publishedByUserId: null,
    publishedByUserIdSnapshot: null,
    publishedByDisplayNameSnapshot: null,
    publishedByRoleSnapshot: null,
    publishedAt: null,
    createdAt: '2026-08-18T12:00:00.000Z',
    updatedAt: '2026-08-18T12:00:00.000Z',
    aggregate: {
      attendance: {
        sessionCount: 2,
        completedSessionCount: 1,
        presentCount: 1,
        lateCount: 0,
        absentCount: 0,
        excusedCount: 0,
      },
      credits: {
        ledgerEntryCount: 1,
        consumedCredits: '1',
        creditedCredits: '0',
        netCreditDelta: '-1',
      },
      training: {
        activeDayCount: 2,
        evidenceCount: '12',
        durationMs: '600000',
        successCount: '9',
        dimensions: [{
          source: 'timer',
          activity: 'solve',
          trustLevel: 'server_recomputed',
          evidenceCount: '12',
          durationMs: '600000',
          successCount: '9',
        }],
      },
      assignments: {
        assignmentCount: 1,
        assignments: [{
          assignmentId: '018f3e56-31a5-7a88-9b45-337ccdbf7297',
          title: 'Daily solves',
          status: 'published',
          scheduleKind: 'daily',
          expectedCount: 10,
          evidenceCount: '12',
          latestReviewRevision: 1,
          latestReviewStatus: 'accepted',
          startsAt: '2026-08-17T00:00:00.000Z',
          endsAt: null,
        }],
      },
      lessonFeedback: {
        feedbackCount: 1,
        feedback: [{
          feedbackId: '018f3e56-31a5-7a88-9b45-337ccdbf7298',
          sessionId: session().id,
          revision: 1,
          visibility: 'student',
          summary: 'Steady progress',
          strengths: 'Recognition',
          challenges: null,
          nextGoals: 'Consistency',
          publishedAt: '2026-08-18T11:30:00.000Z',
          createdAt: '2026-08-18T11:30:00.000Z',
        }],
      },
    },
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

  it('lists weekly report summaries with the exact optional student filter', async () => {
    const report = weeklyReport();
    const { aggregate: _aggregate, ...summary } = report;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      weeklyReports: [summary],
      total: 1,
      page: 1,
      pageSize: 25,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listTeachingWeeklyReports('cube academy', 1, 25, student().id)).resolves.toMatchObject({
      items: [summary],
      total: 1,
    });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `https://api.example.test/v1/teaching/organizations/cube%20academy/weekly-reports?page=1&pageSize=25&studentId=${student().id}`,
    );
  });

  it('generates a weekly report with a strict body and idempotency key', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => (
      jsonResponse({ weeklyReport: weeklyReport() }, 201)
    ));
    vi.stubGlobal('fetch', fetchMock);
    const input = { studentId: student().id, weekStart: '2026-08-17', ignored: true };

    await expect(generateTeachingWeeklyReport('cube-academy', input, 'weekly-key')).resolves.toEqual(weeklyReport());
    const [url, initValue] = fetchMock.mock.calls[0]!;
    const init = initValue as RequestInit;
    expect(url).toBe('https://api.example.test/v1/teaching/organizations/cube-academy/weekly-reports/generate');
    expect(init.headers).toMatchObject({ 'Idempotency-Key': 'weekly-key' });
    expect(JSON.parse(String(init.body))).toEqual({ studentId: input.studentId, weekStart: input.weekStart });
  });

  it('rejects weekly report aggregate drift at a nested dimension boundary', async () => {
    const report = weeklyReport();
    report.aggregate.training.dimensions[0]!.durationMs = 1 as never;
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ weeklyReport: report })));

    await expect(getTeachingWeeklyReport('cube-academy', 'report/id')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 502,
    });
  });

  it('rejects weekly report enum drift and strips non-contract feedback fields', async () => {
    const invalid = weeklyReport();
    invalid.visibility = 'public' as never;
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ weeklyReport: invalid })));
    await expect(getTeachingWeeklyReport('cube-academy', invalid.id)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 502,
    });

    const report = weeklyReport();
    Object.assign(report.aggregate.lessonFeedback.feedback[0]!, { internalNotes: 'staff secret' });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ weeklyReport: report })));
    const parsed = await getTeachingWeeklyReport('cube-academy', report.id);
    expect(parsed.aggregate.lessonFeedback.feedback[0]).not.toHaveProperty('internalNotes');
  });

  it('publishes a weekly report with only the frozen body and idempotency key', async () => {
    const published = {
      ...weeklyReport(),
      status: 'published',
      visibility: 'student_and_guardians',
      teacherSummary: 'Steady progress',
      nextWeekPlan: 'Build consistency',
      publishedByUserId: 42,
      publishedByUserIdSnapshot: 42,
      publishedByDisplayNameSnapshot: 'Teacher One',
      publishedByRoleSnapshot: 'teacher',
      publishedAt: '2026-08-18T13:00:00.000Z',
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => (
      jsonResponse({ weeklyReport: published })
    ));
    vi.stubGlobal('fetch', fetchMock);
    const input = {
      teacherSummary: 'Steady progress',
      nextWeekPlan: 'Build consistency',
      visibility: 'student_and_guardians' as const,
      ignored: true,
    };

    await expect(publishTeachingWeeklyReport('cube-academy', 'report/id', input, 'publish-key'))
      .resolves.toEqual(published);
    const [url, initValue] = fetchMock.mock.calls[0]!;
    const init = initValue as RequestInit;
    expect(url).toBe('https://api.example.test/v1/teaching/organizations/cube-academy/weekly-reports/report%2Fid/publish');
    expect(init.headers).toMatchObject({ 'Idempotency-Key': 'publish-key' });
    expect(JSON.parse(String(init.body))).toEqual({
      teacherSummary: input.teacherSummary,
      nextWeekPlan: input.nextWeekPlan,
      visibility: input.visibility,
    });
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
