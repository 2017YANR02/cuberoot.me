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
  createTeachingConversation,
  createTeachingSession,
  createTeachingGroupMembership,
  createTeachingMember,
  createTeachingTeacherAssignment,
  generateTeachingWeeklyReport,
  getTeachingOperationsOverview,
  getLearnerTeachingWeeklyReport,
  getTeachingConversation,
  getTeachingWeeklyReport,
  listLearnerTeachingLessonFeedback,
  listLearnerTeachingWeeklyReports,
  listTeachingPackageProducts,
  listTeachingCreditAdjustments,
  listTeachingGroupMemberships,
  createTeachingStudent,
  listTeachingOrganizations,
  listTeachingConversationMessages,
  listTeachingConversations,
  listTeachingStudents,
  listTeachingStudentPackageLedger,
  listTeachingTeacherAssignments,
  listTeachingLearningContexts,
  listTeachingOrganizationLearningContexts,
  listTeachingWeeklyReports,
  markTeachingConversationRead,
  previewTeachingGuardianAccountBinding,
  consumeTeachingGuardianAccountBinding,
  publishTeachingWeeklyReport,
  replyTeachingConversation,
  refundTeachingStudentPackage,
  reverseTeachingCreditLedgerEntry,
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

function conversationSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: '018f3e56-31a5-7a88-9b45-337ccdbf7310',
    organization: { slug: organization().slug, name: organization().name },
    student: { id: student().id, displayName: student().displayName },
    subject: 'August learning plan',
    lastMessageSequence: 2,
    lastMessageAt: '2026-08-18T14:10:00.000Z',
    createdAt: '2026-08-18T14:00:00.000Z',
    createdBy: { displayName: 'Teacher One', role: 'teacher', relationship: null },
    lastReadSequence: 1,
    unreadCount: 1,
    ...overrides,
  };
}

function conversationMessage(sequence = 1, overrides: Record<string, unknown> = {}) {
  return {
    id: `018f3e56-31a5-7a88-9b45-337ccdbf73${sequence}`,
    conversationId: conversationSummary().id,
    sequence,
    body: sequence === 1 ? 'Please review this week\'s plan.' : 'Reviewed, thank you.',
    author: sequence === 1
      ? { displayName: 'Teacher One', role: 'teacher', relationship: null }
      : { displayName: 'Parent One', role: 'guardian', relationship: 'parent' },
    createdAt: `2026-08-18T14:${String(sequence).padStart(2, '0')}:00.000Z`,
    ...overrides,
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

function studentPackage(overrides: Record<string, unknown> = {}) {
  return {
    id: '018f3e56-31a5-7a88-9b45-337ccdbf7297',
    studentId: student().id,
    productId: packageProduct().id,
    productCode: packageProduct().code,
    productName: packageProduct().name,
    creditUnit: 'lesson',
    creditType: 'lesson',
    entitledCredits: 10,
    remainingCredits: 8,
    validityDays: 90,
    priceAmountMinor: 100000,
    currency: 'CNY',
    status: 'active',
    acquisitionType: 'purchase',
    validFrom: '2026-08-18T00:00:00.000Z',
    validUntil: '2026-11-16T00:00:00.000Z',
    sourceSystem: 'shop',
    sourceRef: 'ORDER-1',
    sourceLineRef: null,
    createdAt: '2026-08-18T00:00:00.000Z',
    ...overrides,
  };
}

function creditLedgerEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: '9007199254740993',
    studentId: student().id,
    entryType: 'refund',
    delta: -2,
    attendanceId: null,
    sessionId: null,
    sourceSystem: 'shop',
    sourceRef: 'REFUND-1',
    sourceLineRef: null,
    reversalOfLedgerId: null,
    reversedByLedgerId: null,
    reason: 'Customer refund',
    actorRole: 'finance',
    actorDisplayName: 'Finance One',
    metadata: { channel: 'manual' },
    createdAt: '2026-08-20T12:00:00.000Z',
    ...overrides,
  };
}

function creditAdjustment(overrides: Record<string, unknown> = {}) {
  return {
    ledgerEntry: creditLedgerEntry(),
    student: { id: student().id, displayName: student().displayName },
    studentPackage: {
      id: studentPackage().id,
      productCode: packageProduct().code,
      productName: packageProduct().name,
      creditUnit: 'lesson',
      creditType: 'lesson',
    },
    ...overrides,
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

function operationsOverview(overrides: Record<string, unknown> = {}) {
  return {
    range: {
      fromDate: '2026-07-22',
      throughDate: '2026-08-20',
      timezone: 'Asia/Shanghai',
      days: 30,
    },
    sessions: {
      scheduled: 2,
      inProgress: 1,
      completed: 7,
      cancelled: 1,
      total: 11,
    },
    attendance: {
      expected: 2,
      present: 12,
      late: 1,
      absent: 1,
      excused: 1,
      total: 17,
    },
    creditConsumption: [{ creditUnit: 'lesson', creditType: 'standard', amount: '13' }],
    packages: { active: 10, lowBalance: 2, expiringSoon: 3 },
    training: { assignments: 4, studentTargets: 15, targetsWithEvidence: 9 },
    teacherLoad: [{ displayName: 'Teacher One', sessionCount: 6, completedSessionCount: 4 }],
    ...overrides,
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

function learningContext() {
  return {
    organization: { slug: 'cube-academy', name: 'Cube Academy' },
    student: { id: student().id, displayName: student().displayName },
    relationships: [
      { kind: 'student' },
      { kind: 'guardian', guardianLinkId: '018f3e56-31a5-7a88-9b45-337ccdbf7299', relationship: 'parent' },
    ],
  };
}

function learnerWeeklyReport(includeAggregate = true) {
  const staff = weeklyReport();
  return {
    id: staff.id,
    studentId: staff.studentId,
    studentDisplayNameSnapshot: staff.studentDisplayNameSnapshot,
    weekStart: staff.weekStart,
    weekEnd: staff.weekEnd,
    timezoneSnapshot: staff.timezoneSnapshot,
    revision: staff.revision,
    status: 'published',
    visibility: 'student_and_guardians',
    teacherSummary: 'Steady progress',
    nextWeekPlan: 'Build consistency',
    publishedByDisplayNameSnapshot: 'Teacher One',
    publishedByRoleSnapshot: 'teacher',
    publishedAt: '2026-08-18T13:00:00.000Z',
    ...(includeAggregate ? { aggregate: staff.aggregate } : {}),
  };
}

function learnerFeedback() {
  return {
    id: '018f3e56-31a5-7a88-9b45-337ccdbf7300',
    sessionId: session().id,
    studentId: student().id,
    revision: 1,
    visibility: 'student_and_guardians',
    summary: 'Steady progress',
    strengths: 'Recognition',
    challenges: null,
    nextGoals: 'Consistency',
    studentDisplayNameSnapshot: student().displayName,
    attendanceStatusSnapshot: 'present',
    authorDisplayNameSnapshot: 'Teacher One',
    authorRoleSnapshot: 'teacher',
    publishedAt: '2026-08-18T13:00:00.000Z',
    createdAt: '2026-08-18T12:00:00.000Z',
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

  it('parses the operations overview from the canonical no-store endpoint', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      operationsOverview: operationsOverview(),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getTeachingOperationsOverview('cube academy')).resolves.toEqual(operationsOverview());
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://api.example.test/v1/teaching/organizations/cube%20academy/operations/overview',
    );
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ cache: 'no-store' });
  });

  it.each([
    ['a non-30-day range', { ...operationsOverview(), range: { fromDate: '2026-07-22', throughDate: '2026-08-20', timezone: 'Asia/Shanghai', days: 29 } }],
    ['a mismatched session total', { ...operationsOverview(), sessions: { scheduled: 2, inProgress: 1, completed: 7, cancelled: 1, total: 12 } }],
    ['a fractional credit amount', { ...operationsOverview(), creditConsumption: [{ creditUnit: 'lesson', creditType: 'standard', amount: '1.5' }] }],
    ['an impossible teacher completion count', { ...operationsOverview(), teacherLoad: [{ displayName: 'Teacher One', sessionCount: 2, completedSessionCount: 3 }] }],
  ])('rejects operations overview responses with %s', async (_label, overview) => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ operationsOverview: overview })));

    await expect(getTeachingOperationsOverview('cube-academy')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 502,
    });
  });

  it('keeps ledger bigint ids as strings and rejects wire-shape drift', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      ledger: [creditLedgerEntry()], total: 1, page: 1, pageSize: 25,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listTeachingStudentPackageLedger('cube academy', studentPackage().id)).resolves.toMatchObject({
      items: [{ id: '9007199254740993', reversedByLedgerId: null }],
    });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `https://api.example.test/v1/teaching/organizations/cube%20academy/student-packages/${studentPackage().id}/ledger?page=1&pageSize=25`,
    );

    for (const invalid of [
      creditLedgerEntry({ id: 9007199254740992 }),
      creditLedgerEntry({ entryType: 'correction' }),
      creditLedgerEntry({ unexpected: true }),
      creditLedgerEntry({ reason: ' Customer refund' }),
      creditLedgerEntry({ reason: 'x'.repeat(501) }),
      creditLedgerEntry({ sourceSystem: 's'.repeat(65) }),
      creditLedgerEntry({ sourceRef: 'r'.repeat(161) }),
      creditLedgerEntry({ sourceLineRef: 'l'.repeat(161) }),
      creditLedgerEntry({
        entryType: 'reversal',
        delta: 2,
        reversalOfLedgerId: '9007199254740992',
        reason: 'Incorrect refund',
      }),
      creditLedgerEntry({
        entryType: 'reversal',
        delta: 2,
        sourceSystem: null,
        sourceRef: null,
        reversalOfLedgerId: '9007199254740992',
        reason: ' Incorrect refund',
      }),
      creditLedgerEntry({
        entryType: 'reversal',
        delta: 2,
        sourceSystem: null,
        sourceRef: null,
        reversalOfLedgerId: '9007199254740992',
        reason: 'x'.repeat(501),
      }),
    ]) {
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ledger: [invalid], total: 1, page: 1, pageSize: 25 })));
      await expect(listTeachingStudentPackageLedger('cube-academy', studentPackage().id)).rejects.toMatchObject({
        code: 'INVALID_RESPONSE', status: 502,
      });
    }
  });

  it('parses the strict finance adjustment feed from the operations endpoint', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({
      creditAdjustments: [creditAdjustment()], total: 1, page: 1, pageSize: 100,
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listTeachingCreditAdjustments('cube academy', 0, 999)).resolves.toMatchObject({
      items: [{ ledgerEntry: { id: '9007199254740993' }, student: { displayName: 'Student One' } }],
      page: 1,
      pageSize: 100,
    });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://api.example.test/v1/teaching/organizations/cube%20academy/operations/credit-adjustments?page=1&pageSize=100',
    );
  });

  it('rejects inconsistent finance feed and mutation relationships', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      creditAdjustments: [creditAdjustment({
        student: { id: '018f3e56-31a5-7a88-9b45-337ccdbf7000', displayName: 'Wrong student' },
      })],
      total: 1,
      page: 1,
      pageSize: 25,
    })));
    await expect(listTeachingCreditAdjustments('cube-academy')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE', status: 502,
    });

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      ledgerEntry: creditLedgerEntry({ delta: -1 }),
      studentPackage: studentPackage(),
    }, 201)));
    await expect(refundTeachingStudentPackage('cube-academy', studentPackage().id, {
      credits: 2,
      reason: 'Customer refund',
      sourceSystem: 'shop',
      sourceRef: 'REFUND-1',
      sourceLineRef: null,
    }, 'refund-key')).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      ledgerEntry: creditLedgerEntry({
        id: '9007199254740994', entryType: 'reversal', delta: 2,
        sourceSystem: null, sourceRef: null, reversalOfLedgerId: '9007199254740992',
        reason: 'Incorrect refund',
      }),
      studentPackage: studentPackage(),
    }, 201)));
    await expect(reverseTeachingCreditLedgerEntry(
      'cube-academy', studentPackage().id, '9007199254740993', { reason: 'Incorrect refund' }, 'reverse-key',
    )).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });

  it('posts refund and reversal mutations with exact paths, bodies, and idempotency keys', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      const isReversal = String(_input).endsWith('/reversal');
      return jsonResponse({
        ledgerEntry: isReversal
          ? creditLedgerEntry({
              id: '9007199254740994', entryType: 'reversal', delta: 2,
              sourceSystem: null, sourceRef: null, reversalOfLedgerId: '9007199254740993',
              reason: 'Incorrect refund',
            })
          : creditLedgerEntry(),
        studentPackage: studentPackage(),
      }, 201);
    });
    vi.stubGlobal('fetch', fetchMock);
    const refundInput = {
      credits: 2,
      reason: 'Customer refund',
      sourceSystem: 'shop',
      sourceRef: 'REFUND-1',
      sourceLineRef: null,
    };

    await refundTeachingStudentPackage('cube-academy', studentPackage().id, refundInput, 'refund-key');
    await reverseTeachingCreditLedgerEntry(
      'cube-academy', studentPackage().id, '9007199254740993', { reason: 'Incorrect refund' }, 'reverse-key',
    );

    expect(fetchMock.mock.calls[0]![0]).toBe(
      `https://api.example.test/v1/teaching/organizations/cube-academy/student-packages/${studentPackage().id}/refunds`,
    );
    expect(fetchMock.mock.calls[1]![0]).toBe(
      `https://api.example.test/v1/teaching/organizations/cube-academy/student-packages/${studentPackage().id}/ledger/9007199254740993/reversal`,
    );
    expect(JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body))).toEqual(refundInput);
    expect(JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body))).toEqual({ reason: 'Incorrect refund' });
    expect((fetchMock.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ 'Idempotency-Key': 'refund-key' });
    expect((fetchMock.mock.calls[1]![1] as RequestInit).headers).toMatchObject({ 'Idempotency-Key': 'reverse-key' });
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

  it('previews and consumes guardian binding with only the one-time token', async () => {
    const preview = {
      organizationName: 'Cube Academy',
      studentDisplayName: 'Student One',
      relationship: 'parent',
      expiresAt: '2026-08-20T00:00:00.000Z',
    };
    const consumed = {
      invite: {
        id: '018f3e56-31a5-7a88-9b45-337ccdbf7301',
        status: 'consumed',
        expiresAt: preview.expiresAt,
        consumedAt: '2026-08-18T14:00:00.000Z',
        createdAt: '2026-08-18T12:00:00.000Z',
      },
      guardian: {
        guardianLinkId: '018f3e56-31a5-7a88-9b45-337ccdbf7299',
        studentId: student().id,
        organizationName: preview.organizationName,
        studentDisplayName: preview.studentDisplayName,
        relationship: preview.relationship,
        accountLinkedAt: '2026-08-18T14:00:00.000Z',
      },
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => (
      jsonResponse(String(input).endsWith('/preview') ? preview : consumed)
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(previewTeachingGuardianAccountBinding('one-time-token')).resolves.toEqual(preview);
    await expect(consumeTeachingGuardianAccountBinding('one-time-token')).resolves.toEqual(consumed);
    for (const [index, suffix] of [[0, 'preview'], [1, 'consume']] as const) {
      const [url, initValue] = fetchMock.mock.calls[index]!;
      const init = initValue as RequestInit;
      expect(url).toBe(`https://api.example.test/v1/teaching/me/guardian-account-binding/${suffix}`);
      expect(init.cache).toBe('no-store');
      expect(init.headers).toMatchObject({ Authorization: 'Bearer session-token' });
      expect(JSON.parse(String(init.body))).toEqual({ token: 'one-time-token' });
      expect(init.headers).not.toHaveProperty('Idempotency-Key');
    }
  });

  it('parses global and organization-scoped learning contexts without identity input', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ learningContexts: [learningContext()] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listTeachingLearningContexts()).resolves.toEqual([learningContext()]);
    await expect(listTeachingOrganizationLearningContexts('cube academy')).resolves.toEqual([learningContext()]);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.example.test/v1/teaching/me/learning-contexts');
    expect(fetchMock.mock.calls[1]![0]).toBe('https://api.example.test/v1/teaching/organizations/cube%20academy/me/students');
    for (const [, initValue] of fetchMock.mock.calls) {
      const init = initValue as RequestInit;
      expect(init.cache).toBe('no-store');
      expect(init.method).toBeUndefined();
      expect(init.body).toBeUndefined();
      expect(init.headers).toMatchObject({ Authorization: 'Bearer session-token' });
    }

    const invalid = learningContext();
    invalid.relationships = [{ kind: 'owner' } as never];
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ learningContexts: [invalid] })));
    await expect(listTeachingLearningContexts()).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });

  it('uses the exact conversation GET paths, no-store cache, and cursor contract', async () => {
    const summary = conversationSummary();
    const messages = [conversationMessage(1), conversationMessage(2)];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ conversations: [summary], total: 1, page: 1, pageSize: 100 }))
      .mockResolvedValueOnce(jsonResponse({ conversation: summary }))
      .mockResolvedValueOnce(jsonResponse({ messages, afterSequence: 0, nextAfterSequence: 2, hasMore: false }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listTeachingConversations('cube-academy', student().id, 0, 999)).resolves.toEqual({
      conversations: [summary], total: 1, page: 1, pageSize: 100,
    });
    await expect(getTeachingConversation('cube-academy', student().id, summary.id)).resolves.toEqual({ conversation: summary });
    await expect(listTeachingConversationMessages('cube-academy', student().id, summary.id, -10, 999)).resolves.toEqual({
      messages, afterSequence: 0, nextAfterSequence: 2, hasMore: false,
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `https://api.example.test/v1/teaching/organizations/cube-academy/students/${student().id}/conversations?page=1&pageSize=100`,
      `https://api.example.test/v1/teaching/organizations/cube-academy/students/${student().id}/conversations/${summary.id}`,
      `https://api.example.test/v1/teaching/organizations/cube-academy/students/${student().id}/conversations/${summary.id}/messages?afterSequence=0&limit=100`,
    ]);
    for (const [, initValue] of fetchMock.mock.calls) {
      const init = initValue as RequestInit;
      expect(init.cache).toBe('no-store');
      expect(init.method).toBeUndefined();
      expect(init.body).toBeUndefined();
    }
  });

  it('sends strict conversation mutation bodies with independent idempotency keys', async () => {
    const created = conversationSummary({ lastMessageSequence: 1, lastReadSequence: 1, unreadCount: 0 });
    const firstMessage = conversationMessage(1);
    const secondMessage = conversationMessage(2);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ conversation: created, message: firstMessage }, 201))
      .mockResolvedValueOnce(jsonResponse({
        message: secondMessage,
        conversation: {
          id: created.id,
          lastMessageSequence: 2,
          lastMessageAt: secondMessage.createdAt,
          lastReadSequence: 2,
          unreadCount: 0,
        },
      }, 201))
      .mockResolvedValueOnce(jsonResponse({ read: { conversationId: created.id, lastReadSequence: 2 } }));
    vi.stubGlobal('fetch', fetchMock);
    const createInput = { subject: created.subject, body: firstMessage.body, ignored: true };
    const replyInput = { body: secondMessage.body, ignored: true };
    const readInput = { lastReadSequence: 2, ignored: true };

    await createTeachingConversation('cube-academy', student().id, createInput, 'create-key');
    await replyTeachingConversation('cube-academy', student().id, created.id, replyInput, 'reply-key');
    await markTeachingConversationRead('cube-academy', student().id, created.id, readInput, 'read-key');

    const expectedBodies = [
      { subject: createInput.subject, body: createInput.body },
      { body: replyInput.body },
      { lastReadSequence: readInput.lastReadSequence },
    ];
    const expectedKeys = ['create-key', 'reply-key', 'read-key'];
    fetchMock.mock.calls.forEach(([, initValue], index) => {
      const init = initValue as RequestInit;
      expect(init.method).toBe('POST');
      expect(init.cache).toBe('no-store');
      expect(init.headers).toMatchObject({ 'Idempotency-Key': expectedKeys[index] });
      expect(JSON.parse(String(init.body))).toEqual(expectedBodies[index]);
    });
  });

  it('rejects conversation role, scope, ordering, and cursor drift', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      conversations: [conversationSummary({
        createdBy: { displayName: 'Unknown', role: 'finance', relationship: null },
      })],
      total: 1,
      page: 1,
      pageSize: 25,
    })));
    await expect(listTeachingConversations('cube-academy', student().id)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE', status: 502,
    });

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      conversation: conversationSummary({ student: { id: 'another-student', displayName: 'Other' } }),
    })));
    await expect(getTeachingConversation('cube-academy', student().id, conversationSummary().id)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE', status: 502,
    });

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      messages: [conversationMessage(2), conversationMessage(1)],
      afterSequence: 0,
      nextAfterSequence: 1,
      hasMore: false,
    })));
    await expect(listTeachingConversationMessages(
      'cube-academy', student().id, conversationSummary().id,
    )).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });

  it('uses learner weekly report list and detail paths with narrow published responses', async () => {
    const listItem = learnerWeeklyReport(false);
    const detail = learnerWeeklyReport(true);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => (
      String(input).includes(`/weekly-reports/${detail.id}`)
        ? jsonResponse({ weeklyReport: detail })
        : jsonResponse({ weeklyReports: [listItem], total: 1, page: 1, pageSize: 25 })
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listLearnerTeachingWeeklyReports('cube academy', student().id, 0, 999)).resolves.toMatchObject({
      items: [listItem], total: 1, page: 1, pageSize: 25,
    });
    await expect(getLearnerTeachingWeeklyReport('cube academy', student().id, detail.id)).resolves.toEqual(detail);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `https://api.example.test/v1/teaching/organizations/cube%20academy/me/students/${student().id}/weekly-reports?page=1&pageSize=100`,
    );
    expect(fetchMock.mock.calls[1]![0]).toBe(
      `https://api.example.test/v1/teaching/organizations/cube%20academy/me/students/${student().id}/weekly-reports/${detail.id}`,
    );
    for (const [, initValue] of fetchMock.mock.calls) {
      expect((initValue as RequestInit).cache).toBe('no-store');
    }
  });

  it('rejects learner report visibility drift and requires aggregate on detail', async () => {
    const staffOnly = { ...learnerWeeklyReport(false), visibility: 'staff_only' };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ weeklyReports: [staffOnly], total: 1, page: 1, pageSize: 25 })));
    await expect(listLearnerTeachingWeeklyReports('cube-academy', student().id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ weeklyReport: learnerWeeklyReport(false) })));
    await expect(getLearnerTeachingWeeklyReport('cube-academy', student().id, weeklyReport().id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
  });

  it('parses learner feedback and strips staff-only fields', async () => {
    const wire = { ...learnerFeedback(), internalNotes: 'staff secret' };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ feedback: [wire], total: 1, page: 1, pageSize: 25 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await listLearnerTeachingLessonFeedback('cube academy', student().id, 1, 25);
    expect(result.items[0]).toEqual(learnerFeedback());
    expect(result.items[0]).not.toHaveProperty('internalNotes');
    expect(fetchMock.mock.calls[0]![0]).toBe(
      `https://api.example.test/v1/teaching/organizations/cube%20academy/me/students/${student().id}/lesson-feedback?page=1&pageSize=25`,
    );
    expect((fetchMock.mock.calls[0]![1] as RequestInit).cache).toBe('no-store');

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      feedback: [{ ...learnerFeedback(), visibility: 'staff_only' }], total: 1, page: 1, pageSize: 25,
    })));
    await expect(listLearnerTeachingLessonFeedback('cube-academy', student().id)).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 502 });
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
