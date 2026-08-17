import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeachingActor } from '../src/utils/teaching_platform_assertion.js';
import {
  createTeachingSaasRoutes,
  TeachingApiException,
  type TeachingSaasRepository,
} from '../src/routes/teaching_saas.js';

const ACTOR: TeachingActor = {
  userId: 42,
  displayName: '测试老师',
  source: 'platform',
  platformSubject: 'platform-user-42',
};

function repository(): TeachingSaasRepository {
  return {
    listOrganizations: vi.fn().mockResolvedValue([]),
    getOrganization: vi.fn().mockResolvedValue({ id: 'org-1', slug: 'demo' }),
    getOrganizationSummary: vi.fn().mockResolvedValue({
      organization: { id: 'org-1', slug: 'demo' },
      memberCount: 1,
      studentCount: 0,
    }),
    createOrganization: vi.fn().mockResolvedValue({
      status: 201,
      body: { organization: { id: 'org-1', slug: 'demo' } },
    }),
    listMembers: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createMember: vi.fn().mockResolvedValue({ status: 201, body: { member: { userId: 7 } } }),
    listStudents: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createStudent: vi.fn().mockResolvedValue({ status: 201, body: { student: { id: 'student-1' } } }),
    listPackageProducts: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createPackageProduct: vi.fn().mockResolvedValue({ status: 201, body: { packageProduct: { id: 'product-1' } } }),
    listStudentPackages: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createStudentPackage: vi.fn().mockResolvedValue({ status: 201, body: { studentPackage: { id: 'package-1' } } }),
    listStudentPackageLedger: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    listSessions: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    getSession: vi.fn().mockResolvedValue({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    createSession: vi.fn().mockResolvedValue({ status: 201, body: { session: { id: 'session-1' } } }),
    saveAttendanceBatch: vi.fn().mockResolvedValue({ status: 200, body: { attendance: [] } }),
    completeSession: vi.fn().mockResolvedValue({ status: 200, body: { session: { status: 'completed' } } }),
  };
}

describe('teaching SaaS routes', () => {
  let repo: TeachingSaasRepository;

  beforeEach(() => {
    repo = repository();
  });

  it('returns structured unauthenticated errors without cacheable responses', async () => {
    const app = createTeachingSaasRoutes({
      authenticate: async () => { throw new Error('Authentication required'); },
      repository: repo,
    });

    const response = await app.request('/teaching/organizations');
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    expect(repo.listOrganizations).not.toHaveBeenCalled();
  });

  it('derives the actor from authentication and passes only validated organization input', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const raw = JSON.stringify({
      slug: 'Demo-School',
      name: '示例机构',
      actorUserId: 999,
    });

    const response = await app.request('/teaching/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'create-demo-1' },
      body: raw,
    });

    expect(response.status).toBe(201);
    expect(repo.createOrganization).toHaveBeenCalledWith(
      ACTOR,
      { slug: 'demo-school', name: '示例机构', timezone: 'Asia/Shanghai' },
      'create-demo-1',
      createHash('sha256').update(raw).digest('hex'),
      expect.any(String),
    );
  });

  it('requires an idempotency key before running mutations', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const response = await app.request('/teaching/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'demo', name: '示例机构' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
    expect(repo.createOrganization).not.toHaveBeenCalled();
  });

  it('keeps inaccessible organizations indistinguishable from missing ones', async () => {
    repo.getOrganization = vi.fn().mockRejectedValue(
      new TeachingApiException('ORGANIZATION_NOT_FOUND', 404, 'Organization not found'),
    );
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });

    const response = await app.request('/teaching/organizations/outside');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'ORGANIZATION_NOT_FOUND' } });
  });

  it('routes member and student reads through the tenant slug', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });

    await expect(app.request('/teaching/organizations/demo/summary')).resolves.toMatchObject({ status: 200 });
    await expect(app.request('/teaching/organizations/demo/members')).resolves.toMatchObject({ status: 200 });
    await expect(app.request('/teaching/organizations/demo/students')).resolves.toMatchObject({ status: 200 });
    expect(repo.getOrganizationSummary).toHaveBeenCalledWith(ACTOR, 'demo', expect.any(String));
    expect(repo.listMembers).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      { page: 1, pageSize: 30, offset: 0 },
      expect.any(String),
    );
    expect(repo.listStudents).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      { page: 1, pageSize: 30, offset: 0 },
      expect.any(String),
    );
  });

  it('validates and forwards bounded pagination', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });

    const response = await app.request('/teaching/organizations/demo/members?page=3&pageSize=20');
    expect(response.status).toBe(200);
    expect(repo.listMembers).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      { page: 3, pageSize: 20, offset: 40 },
      expect.any(String),
    );

    const invalid = await app.request('/teaching/organizations/demo/students?page=0&pageSize=101');
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: 'INVALID_INPUT' } });
    expect(repo.listStudents).not.toHaveBeenCalled();
  });

  it('normalizes and bounds package product input', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const raw = JSON.stringify({
      code: ' BEGINNER_10 ', name: '入门十课时', creditUnit: 'lesson', creditType: 'group',
      totalCredits: 10, validityDays: 180, priceAmountMinor: 120000, currency: 'cny',
    });
    const response = await app.request('/teaching/organizations/demo/package-products', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'product-1' }, body: raw,
    });
    expect(response.status).toBe(201);
    expect(repo.createPackageProduct).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      {
        code: 'beginner_10', name: '入门十课时', creditUnit: 'lesson', creditType: 'group',
        totalCredits: 10, validityDays: 180, priceAmountMinor: 120000, currency: 'CNY',
      },
      'product-1',
      createHash('sha256').update(raw).digest('hex'),
      expect.any(String),
    );
  });

  it('creates a session with immutable attendee ownership and updates attendance by id', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const packageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const attendanceId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const create = await app.request('/teaching/organizations/demo/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'session-1' },
      body: JSON.stringify({
        title: '周一训练', startsAt: '2026-08-18T09:00:00+08:00', endsAt: '2026-08-18T10:00:00+08:00',
        teacherUserIds: [7], attendees: [{ studentId, studentPackageId: packageId, creditCost: 1 }],
      }),
    });
    expect(create.status).toBe(201);
    expect(repo.createSession).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      expect.objectContaining({
        startsAt: '2026-08-18T01:00:00.000Z', endsAt: '2026-08-18T02:00:00.000Z',
        timezone: null, teacherUserIds: [7], attendees: [{ studentId, studentPackageId: packageId, creditCost: 1 }],
      }),
      'session-1', expect.any(String), expect.any(String),
    );

    const batch = await app.request(`/teaching/organizations/demo/sessions/${sessionId}/attendance/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'attendance-1' },
      body: JSON.stringify({ records: [{ attendanceId, status: 'present' }] }),
    });
    expect(batch.status).toBe(200);
    expect(repo.saveAttendanceBatch).toHaveBeenCalledWith(
      ACTOR, 'demo', sessionId, { records: [{ attendanceId, status: 'present' }] },
      'attendance-1', expect.any(String), expect.any(String),
    );
  });

  it('rejects calendar dates that JavaScript would otherwise normalize', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const response = await app.request('/teaching/organizations/demo/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'invalid-calendar-date' },
      body: JSON.stringify({
        title: '非法日期', startsAt: '2026-02-30T09:00:00+08:00', endsAt: '2026-03-01T10:00:00+08:00',
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_INPUT' } });
    expect(repo.createSession).not.toHaveBeenCalled();
  });

  it('discards caller-supplied attendance ownership and exposes session detail by UUID', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const attendanceId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const sanitized = await app.request(`/teaching/organizations/demo/sessions/${sessionId}/attendance/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'attendance-invalid' },
      body: JSON.stringify({
        records: [{
          attendanceId,
          status: 'present',
          studentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          studentPackageId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          creditCost: 999,
        }],
      }),
    });
    expect(sanitized.status).toBe(200);
    expect(repo.saveAttendanceBatch).toHaveBeenCalledWith(
      ACTOR, 'demo', sessionId, { records: [{ attendanceId, status: 'present' }] },
      'attendance-invalid', expect.any(String), expect.any(String),
    );

    const detail = await app.request(`/teaching/organizations/demo/sessions/${sessionId}`);
    expect(detail.status).toBe(200);
    expect(repo.getSession).toHaveBeenCalledWith(ACTOR, 'demo', sessionId, expect.any(String));
  });
});
