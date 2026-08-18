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
    getStudent: vi.fn().mockResolvedValue({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
    createStudent: vi.fn().mockResolvedValue({ status: 201, body: { student: { id: 'student-1' } } }),
    listCampuses: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    getCampus: vi.fn().mockResolvedValue({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    createCampus: vi.fn().mockResolvedValue({ status: 201, body: { campus: { id: 'campus-1' } } }),
    archiveCampus: vi.fn().mockResolvedValue({ status: 200, body: { campus: { status: 'archived' } } }),
    listGroups: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    getGroup: vi.fn().mockResolvedValue({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    createGroup: vi.fn().mockResolvedValue({ status: 201, body: { group: { id: 'group-1' } } }),
    archiveGroup: vi.fn().mockResolvedValue({ status: 200, body: { group: { status: 'archived' } } }),
    listGroupStudents: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createStudentGroupMembership: vi.fn().mockResolvedValue({ status: 201, body: { membership: { id: 'membership-1' } } }),
    revokeStudentGroupMembership: vi.fn().mockResolvedValue({ status: 200, body: { membership: { id: 'membership-1' } } }),
    listTeacherAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createTeacherAssignment: vi.fn().mockResolvedValue({ status: 201, body: { assignment: { id: 'assignment-1' } } }),
    revokeTeacherAssignment: vi.fn().mockResolvedValue({ status: 200, body: { assignment: { id: 'assignment-1' } } }),
    listPackageProducts: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createPackageProduct: vi.fn().mockResolvedValue({ status: 201, body: { packageProduct: { id: 'product-1' } } }),
    listStudentPackages: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createStudentPackage: vi.fn().mockResolvedValue({ status: 201, body: { studentPackage: { id: 'package-1' } } }),
    listStudentPackageLedger: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    listSessions: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    getSession: vi.fn().mockResolvedValue({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    createSession: vi.fn().mockResolvedValue({ status: 201, body: { session: { id: 'session-1' } } }),
    createStudentAccountBindingInvite: vi.fn().mockResolvedValue({
      status: 201,
      body: { invite: { id: 'invite-1', status: 'pending' }, token: 'a'.repeat(43) },
    }),
    getCurrentStudentAccountBindingInvite: vi.fn().mockResolvedValue({
      invite: { id: 'invite-1', status: 'pending' },
    }),
    revokeStudentAccountBindingInvite: vi.fn().mockResolvedValue({
      status: 200,
      body: { invite: { id: 'invite-1', status: 'revoked' } },
    }),
    previewStudentAccountBindingInvite: vi.fn().mockResolvedValue({
      organizationName: 'Demo', studentDisplayName: 'Student', expiresAt: '2026-08-18T02:00:00.000Z',
    }),
    consumeStudentAccountBindingInvite: vi.fn().mockResolvedValue({
      status: 200,
      body: { invite: { id: 'invite-1', status: 'consumed' }, student: { id: 'student-1' } },
    }),
    listSelfTrainingAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createSelfTrainingEvidence: vi.fn().mockResolvedValue({
      status: 201,
      body: { evidence: { id: 'evidence-1' }, assignmentIds: [], replayed: false },
    }),
    listTrainingTemplates: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    getTrainingTemplate: vi.fn().mockResolvedValue({ template: { id: 'template-1' } }),
    createTrainingTemplate: vi.fn().mockResolvedValue({
      status: 201, body: { template: { id: 'template-1' } },
    }),
    listTrainingTemplateVersions: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createTrainingTemplateVersion: vi.fn().mockResolvedValue({
      status: 201, body: { templateVersion: { id: 'version-1' } },
    }),
    archiveTrainingTemplate: vi.fn().mockResolvedValue({
      status: 200, body: { template: { id: 'template-1', status: 'archived' } },
    }),
    listTrainingAssignments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    getTrainingAssignment: vi.fn().mockResolvedValue({
      assignment: { id: 'assignment-1' }, templateVersion: { id: 'version-1' }, goals: [],
    }),
    createTrainingAssignment: vi.fn().mockResolvedValue({
      status: 201,
      body: { assignment: { id: 'assignment-1' }, templateVersion: { id: 'version-1' }, goals: [] },
    }),
    reviseTrainingAssignment: vi.fn().mockResolvedValue({
      status: 200,
      body: { assignment: { id: 'assignment-1' }, templateVersion: { id: 'version-1' }, goals: [] },
    }),
    publishTrainingAssignment: vi.fn().mockResolvedValue({
      status: 200,
      body: { assignment: { id: 'assignment-1', status: 'published' }, templateVersion: { id: 'version-1' }, goals: [] },
    }),
    closeTrainingAssignment: vi.fn().mockResolvedValue({
      status: 200,
      body: { assignment: { id: 'assignment-1', status: 'closed' }, templateVersion: { id: 'version-1' }, goals: [] },
    }),
    listTrainingAssignmentTargets: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    listTrainingTargetEvidence: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    listTrainingTargetReviews: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createTrainingTargetReview: vi.fn().mockResolvedValue({
      status: 201, body: { review: { id: 'review-1', revision: 1 } },
    }),
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

  it('keeps an unassigned session indistinguishable from a missing session at the route boundary', async () => {
    repo.getSession = vi.fn().mockRejectedValue(
      new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Session not found'),
    );
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });

    const response = await app.request(
      '/teaching/organizations/demo/sessions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Session not found' },
    });
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

  it('normalizes Stage 1 CRM input and binds assignment reads to exactly one target', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const groupId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    const campusBody = JSON.stringify({ code: ' North_1 ', name: ' 北校区 ', timezone: 'Asia/Shanghai' });
    const campus = await app.request('/teaching/organizations/demo/campuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'campus-1' },
      body: campusBody,
    });
    expect(campus.status).toBe(201);
    expect(repo.createCampus).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      { code: 'north_1', name: '北校区', timezone: 'Asia/Shanghai' },
      'campus-1',
      createHash('sha256').update(campusBody).digest('hex'),
      expect.any(String),
    );

    const assignmentBody = JSON.stringify({
      teacherUserId: 7,
      groupId,
      effectiveFrom: '2026-08-18T09:00:00+08:00',
      effectiveTo: '2026-12-18T09:00:00+08:00',
    });
    const assignment = await app.request('/teaching/organizations/demo/teacher-assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'assignment-1' },
      body: assignmentBody,
    });
    expect(assignment.status).toBe(201);
    expect(repo.createTeacherAssignment).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      {
        teacherUserId: 7,
        groupId,
        studentId: null,
        effectiveFrom: '2026-08-18T01:00:00.000Z',
        effectiveTo: '2026-12-18T01:00:00.000Z',
      },
      'assignment-1',
      createHash('sha256').update(assignmentBody).digest('hex'),
      expect.any(String),
    );

    const list = await app.request(`/teaching/organizations/demo/teacher-assignments?studentId=${studentId}`);
    expect(list.status).toBe(200);
    expect(repo.listTeacherAssignments).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      { groupId: null, studentId },
      { page: 1, pageSize: 30, offset: 0 },
      expect.any(String),
    );

    const ambiguous = await app.request(
      `/teaching/organizations/demo/teacher-assignments?groupId=${groupId}&studentId=${studentId}`,
    );
    expect(ambiguous.status).toBe(400);
    expect(await ambiguous.json()).toMatchObject({ error: { code: 'INVALID_INPUT' } });
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

  it('creates a one-time binding invite without requiring or forwarding generic idempotency', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const response = await app.request(
      `/teaching/organizations/demo/students/${studentId}/account-binding-invites`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'must-not-cache-token' },
        body: JSON.stringify({ expiresInMinutes: 90 }),
      },
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(repo.createStudentAccountBindingInvite).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      studentId,
      { expiresInMinutes: 90 },
      expect.any(String),
    );
    expect(vi.mocked(repo.createStudentAccountBindingInvite).mock.calls[0]).not.toContain('must-not-cache-token');
  });

  it('hashes an account-binding token before passing it to the repository', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const token = 'A'.repeat(43);
    const response = await app.request('/teaching/me/student-account-binding/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    expect(response.status).toBe(200);
    expect(repo.consumeStudentAccountBindingInvite).toHaveBeenCalledWith(
      ACTOR,
      { tokenHash: createHash('sha256').update(token).digest('hex') },
      expect.any(String),
    );
    expect(JSON.stringify(vi.mocked(repo.consumeStudentAccountBindingInvite).mock.calls)).not.toContain(token);
  });

  it('reads and idempotently revokes the current staff-managed binding invite', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const inviteId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

    const current = await app.request(
      `/teaching/organizations/demo/students/${studentId}/account-binding-invite`,
    );
    expect(current.status).toBe(200);
    expect(current.headers.get('cache-control')).toBe('no-store');
    expect(repo.getCurrentStudentAccountBindingInvite).toHaveBeenCalledWith(
      ACTOR, 'demo', studentId, expect.any(String),
    );

    const raw = '{}';
    const revoked = await app.request(
      `/teaching/organizations/demo/students/${studentId}/account-binding-invites/${inviteId}/revoke`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'revoke-invite-1' },
        body: raw,
      },
    );
    expect(revoked.status).toBe(200);
    expect(revoked.headers.get('cache-control')).toBe('no-store');
    expect(repo.revokeStudentAccountBindingInvite).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      studentId,
      inviteId,
      'revoke-invite-1',
      createHash('sha256').update(raw).digest('hex'),
      expect.any(String),
    );
  });

  it('previews an invite by hash only and keeps unavailable tokens indistinguishable', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const token = 'P'.repeat(43);
    const preview = await app.request('/teaching/me/student-account-binding/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    expect(preview.status).toBe(200);
    expect(preview.headers.get('cache-control')).toBe('no-store');
    expect(repo.previewStudentAccountBindingInvite).toHaveBeenCalledWith(
      ACTOR,
      { tokenHash: createHash('sha256').update(token).digest('hex') },
      expect.any(String),
    );
    expect(JSON.stringify(vi.mocked(repo.previewStudentAccountBindingInvite).mock.calls)).not.toContain(token);

    repo.previewStudentAccountBindingInvite = vi.fn().mockRejectedValue(
      new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Student account binding invite not found'),
    );
    const unavailableApp = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const unavailable = await unavailableApp.request('/teaching/me/student-account-binding/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'U'.repeat(43) }),
    });
    expect(unavailable.status).toBe(404);
    expect(unavailable.headers.get('cache-control')).toBe('no-store');
    expect(await unavailable.json()).toMatchObject({ error: { code: 'RESOURCE_NOT_FOUND' } });
  });

  it('lists only the authenticated student binding under the requested organization slug', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const response = await app.request('/teaching/organizations/demo/me/training/assignments?page=2&pageSize=10');

    expect(response.status).toBe(200);
    expect(repo.listSelfTrainingAssignments).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      { page: 2, pageSize: 10, offset: 10 },
      expect.any(String),
    );
  });

  it('canonicalizes self evidence and never accepts caller-supplied identity or trust', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const occurredAt = new Date(Date.now() - 60_000).toISOString();
    const assignmentA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const assignmentB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const response = await app.request('/teaching/organizations/demo/me/training/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1,
        source: 'timer',
        sourceEventId: ' timer-event-1 ',
        occurredAt,
        activity: 'solve',
        durationMs: 12_345,
        metrics: { success: true, resultMs: 12_345 },
        payloadVersion: 1,
        assignmentIds: [assignmentB.toUpperCase(), assignmentA, assignmentB],
      }),
    });

    expect(response.status).toBe(201);
    expect(repo.createSelfTrainingEvidence).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      {
        schemaVersion: 1,
        source: 'timer',
        sourceEventId: 'timer-event-1',
        occurredAt,
        activity: 'solve',
        durationMs: 12_345,
        metrics: { success: true, resultMs: 12_345 },
        payloadVersion: 1,
        payload: undefined,
        assignmentIds: [assignmentA, assignmentB],
      },
      expect.any(String),
    );

    for (const forbidden of ['organizationId', 'studentId', 'actorUserId', 'trustLevel']) {
      const rejected = await app.request('/teaching/organizations/demo/me/training/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 1,
          source: 'timer',
          sourceEventId: `event-${forbidden}`,
          occurredAt,
          activity: 'solve',
          metrics: { success: true, resultMs: 123 },
          payloadVersion: 1,
          [forbidden]: 'spoofed',
        }),
      });
      expect(rejected.status).toBe(400);
      expect(await rejected.json()).toMatchObject({ error: { code: 'EVIDENCE_INVALID' } });
    }
    expect(repo.createSelfTrainingEvidence).toHaveBeenCalledTimes(1);
  });

  it('leaves database-clock future validation to the repository but rejects oversized evidence', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const future = new Date(Date.now() + 6 * 60_000).toISOString();
    const futureResponse = await app.request('/teaching/organizations/demo/me/training/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1,
        source: 'timer',
        sourceEventId: 'future-event',
        occurredAt: future,
        activity: 'solve',
        metrics: { success: true, resultMs: 123 },
        payloadVersion: 1,
      }),
    });
    expect(futureResponse.status).toBe(201);
    expect(repo.createSelfTrainingEvidence).toHaveBeenCalledTimes(1);
    expect(repo.createSelfTrainingEvidence).toHaveBeenLastCalledWith(
      ACTOR,
      'demo',
      expect.objectContaining({ occurredAt: future }),
      expect.any(String),
    );

    const oversizedResponse = await app.request('/teaching/organizations/demo/me/training/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: 'x'.repeat(65_536) }),
    });
    expect(oversizedResponse.status).toBe(400);
    expect(await oversizedResponse.json()).toMatchObject({ error: { code: 'INVALID_INPUT' } });
    expect(repo.createSelfTrainingEvidence).toHaveBeenCalledTimes(1);
  });

  it('keeps concealed self-evidence denials as a no-store 404 without database details', async () => {
    repo.createSelfTrainingEvidence = vi.fn().mockRejectedValue(
      new TeachingApiException('RESOURCE_NOT_FOUND', 404, 'Training assignment not found'),
    );
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const response = await app.request('/teaching/organizations/demo/me/training/evidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1,
        source: 'timer',
        sourceEventId: 'concealed-target',
        occurredAt: '2026-08-17T01:00:00.000Z',
        activity: 'solve',
        metrics: { success: true, resultMs: 123 },
        payloadVersion: 1,
        assignmentIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Training assignment not found' },
    });
    expect(JSON.stringify(body)).not.toMatch(/23514|teaching_audit_events|metadata_check/i);
  });

  it('validates Stage 3C templates from the shared tool registry and bounds tool configuration', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const templateId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const raw = JSON.stringify({
      title: '  计时训练  ', instructions: '', source: 'timer', activity: 'solve',
      toolConfig: { schemaVersion: 1 },
    });
    const created = await app.request(
      `/teaching/organizations/demo/training/templates/${templateId}/versions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'template-version-1' },
        body: raw,
      },
    );
    expect(created.status).toBe(201);
    expect(repo.createTrainingTemplateVersion).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      templateId,
      {
        title: '计时训练', instructions: '', source: 'timer', activity: 'solve',
        toolConfig: { schemaVersion: 1 },
      },
      'template-version-1',
      createHash('sha256').update(raw).digest('hex'),
      expect.any(String),
    );

    for (const [index, invalidBody] of [
      {
        title: '错配', instructions: '', source: 'predict', activity: 'solve',
        toolConfig: { schemaVersion: 1 },
      },
      {
        title: '身份注入', instructions: '', source: 'timer', activity: 'solve',
        toolConfig: { schemaVersion: 1, studentId: 'forged' },
      },
      {
        title: '链接注入', instructions: '', source: 'timer', activity: 'solve',
        toolConfig: { schemaVersion: 1, url: 'https://example.invalid/trainer' },
      },
      {
        title: '缺少版本', instructions: '', source: 'timer', activity: 'solve', toolConfig: {},
      },
    ].entries()) {
      const rejected = await app.request(
        `/teaching/organizations/demo/training/templates/${templateId}/versions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `bad-version-${index + 1}` },
          body: JSON.stringify(invalidBody),
        },
      );
      expect(rejected.status).toBe(400);
    }
    expect(repo.createTrainingTemplateVersion).toHaveBeenCalledTimes(1);
  });

  it('normalizes complete Stage 3C assignment writes and keeps targets on a separate paginated route', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const versionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const groupA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const groupB = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const studentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const assignmentId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const raw = JSON.stringify({
      templateVersionId: versionId,
      title: '  每日训练  ',
      instructions: '完成后提交证据',
      scheduleKind: 'daily',
      expectedCount: 5,
      startsAt: '2026-08-18T09:00:00+08:00',
      endsAt: null,
      groupIds: [groupB, groupA],
      studentIds: [studentId],
      goals: [
        { metricKey: 'duration_ms', operator: 'gte', targetValue: 60_000 },
        { metricKey: 'evidence_count', operator: 'gte', targetValue: 5 },
      ],
    });
    const created = await app.request('/teaching/organizations/demo/training/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'assignment-create-1' },
      body: raw,
    });
    expect(created.status).toBe(201);
    expect(repo.createTrainingAssignment).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      {
        templateVersionId: versionId,
        title: '每日训练',
        instructions: '完成后提交证据',
        scheduleKind: 'daily',
        expectedCount: 5,
        startsAt: '2026-08-18T01:00:00.000Z',
        endsAt: null,
        groupIds: [groupA, groupB],
        studentIds: [studentId],
        goals: [
          { metricKey: 'duration_ms', operator: 'gte', targetValue: 60_000 },
          { metricKey: 'evidence_count', operator: 'gte', targetValue: 5 },
        ],
      },
      'assignment-create-1',
      createHash('sha256').update(raw).digest('hex'),
      expect.any(String),
    );

    const targets = await app.request(
      `/teaching/organizations/demo/training/assignments/${assignmentId}/targets?targetKind=student&page=2&pageSize=10`,
    );
    expect(targets.status).toBe(200);
    expect(repo.listTrainingAssignmentTargets).toHaveBeenCalledWith(
      ACTOR, 'demo', assignmentId, { targetKind: 'student' },
      { page: 2, pageSize: 10, offset: 10 }, expect.any(String),
    );

    const duplicate = await app.request('/teaching/organizations/demo/training/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'assignment-duplicate' },
      body: JSON.stringify({ ...JSON.parse(raw), groupIds: [groupA, groupA] }),
    });
    expect(duplicate.status).toBe(400);
    expect(repo.createTrainingAssignment).toHaveBeenCalledTimes(1);
  });

  it('requires idempotency for Stage 3C review writes and forwards only the strict review body', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const assignmentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const raw = JSON.stringify({ status: 'accepted', rating: 5, feedback: '完成质量稳定' });
    const response = await app.request(
      `/teaching/organizations/demo/training/assignments/${assignmentId}/targets/${studentId}/reviews`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'review-1' },
        body: raw,
      },
    );
    expect(response.status).toBe(201);
    expect(repo.createTrainingTargetReview).toHaveBeenCalledWith(
      ACTOR, 'demo', assignmentId, studentId,
      { status: 'accepted', rating: 5, feedback: '完成质量稳定' },
      'review-1', createHash('sha256')
        .update(JSON.stringify([assignmentId, studentId, raw]))
        .digest('hex'), expect.any(String),
    );

    const missingKey = await app.request(
      `/teaching/organizations/demo/training/assignments/${assignmentId}/targets/${studentId}/reviews`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw },
    );
    expect(missingKey.status).toBe(400);
    expect(repo.createTrainingTargetReview).toHaveBeenCalledTimes(1);
  });
});
