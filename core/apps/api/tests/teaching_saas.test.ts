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
    getOperationsOverview: vi.fn().mockResolvedValue({
      range: {
        fromDate: '2026-07-22',
        throughDate: '2026-08-20',
        timezone: 'Asia/Shanghai',
        days: 30,
      },
      sessions: { scheduled: 0, inProgress: 0, completed: 0, cancelled: 0, total: 0 },
      attendance: { expected: 0, present: 0, late: 0, absent: 0, excused: 0, total: 0 },
      creditConsumption: [],
      packages: { active: 0, lowBalance: 0, expiringSoon: 0 },
      training: { assignments: 0, studentTargets: 0, targetsWithEvidence: 0 },
      teacherLoad: [],
    }),
    listAuditEvents: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
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
    listCreditAdjustments: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    refundStudentPackageCredits: vi.fn().mockResolvedValue({ status: 201, body: { ledgerEntry: { id: '1' }, studentPackage: { id: 'package-1' } } }),
    reverseStudentPackageLedgerEntry: vi.fn().mockResolvedValue({ status: 201, body: { ledgerEntry: { id: '2' }, studentPackage: { id: 'package-1' } } }),
    listSessions: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    getSession: vi.fn().mockResolvedValue({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    createSession: vi.fn().mockResolvedValue({ status: 201, body: { session: { id: 'session-1' } } }),
    cancelSession: vi.fn().mockResolvedValue({
      status: 200, body: { session: { id: 'session-1', status: 'cancelled' }, makeupAttempts: [] },
    }),
    listLeaveRequests: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createLeaveRequest: vi.fn().mockResolvedValue({
      status: 201, body: { leaveRequest: { id: 'leave-1' }, attendance: { status: 'expected' } },
    }),
    decideLeaveRequest: vi.fn().mockResolvedValue({
      status: 200, body: { leaveRequest: { id: 'leave-1', status: 'approved' }, attendance: { status: 'excused' } },
    }),
    cancelLeaveRequest: vi.fn().mockResolvedValue({
      status: 200, body: { leaveRequest: { id: 'leave-1', status: 'cancelled' }, attendance: { status: 'expected' } },
    }),
    listMakeupAttempts: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    listMakeupCandidates: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    scheduleMakeup: vi.fn().mockResolvedValue({
      status: 201, body: { makeupAttempt: { id: 'makeup-1' }, attendance: { status: 'expected' } },
    }),
    listLearnerSessions: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    listLearnerLeaveRequests: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createLearnerLeaveRequest: vi.fn().mockResolvedValue({
      status: 201, body: { leaveRequest: { id: 'leave-1' }, attendance: { status: 'expected' } },
    }),
    cancelLearnerLeaveRequest: vi.fn().mockResolvedValue({
      status: 200, body: { leaveRequest: { id: 'leave-1', status: 'cancelled' }, attendance: { status: 'expected' } },
    }),
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
    createGuardianAccountBindingInvite: vi.fn().mockResolvedValue({
      status: 201,
      body: { invite: { id: 'guardian-invite-1', status: 'pending' }, token: 'b'.repeat(43) },
    }),
    getCurrentGuardianAccountBindingInvite: vi.fn().mockResolvedValue({
      invite: { id: 'guardian-invite-1', status: 'pending' },
    }),
    revokeGuardianAccountBindingInvite: vi.fn().mockResolvedValue({
      status: 200,
      body: { invite: { id: 'guardian-invite-1', status: 'revoked' } },
    }),
    previewGuardianAccountBindingInvite: vi.fn().mockResolvedValue({
      organizationName: 'Demo', studentDisplayName: 'Student', relationship: 'parent',
      expiresAt: '2026-08-18T02:00:00.000Z',
    }),
    consumeGuardianAccountBindingInvite: vi.fn().mockResolvedValue({
      status: 200,
      body: { invite: { id: 'guardian-invite-1', status: 'consumed' }, guardian: { guardianLinkId: 'link-1' } },
    }),
    listLearningContexts: vi.fn().mockResolvedValue([]),
    listLearnerWeeklyReports: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    getLearnerWeeklyReport: vi.fn().mockResolvedValue({ id: 'weekly-report-1', status: 'published' }),
    listLearnerLessonFeedback: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
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
    listLessonFeedback: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    createLessonFeedback: vi.fn().mockResolvedValue({
      status: 201, body: { feedback: { id: 'feedback-1', revision: 1 } },
    }),
    listWeeklyReports: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 }),
    getWeeklyReport: vi.fn().mockResolvedValue({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    generateWeeklyReport: vi.fn().mockResolvedValue({
      status: 201, body: { weeklyReport: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
    }),
    publishWeeklyReport: vi.fn().mockResolvedValue({
      status: 200, body: { weeklyReport: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
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

  it('registers the frozen staff and learner leave/makeup routes with strict bodies', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const attendanceId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const leaveRequestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const targetSessionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const studentId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const staffBase = `/teaching/organizations/demo/sessions/${sessionId}`;
    const attendanceBase = `${staffBase}/attendance/${attendanceId}`;
    const learnerBase = `/teaching/organizations/demo/me/students/${studentId}/sessions/${sessionId}`;
    const post = (path: string, body: Record<string, unknown>, key: string) => app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(body),
    });

    const responses = [
      await app.request(`${staffBase}/leave-requests?page=1&pageSize=10`),
      await post(`${attendanceBase}/leave-requests`, { reason: 'Family leave' }, 'staff-leave'),
      await post(
        `${attendanceBase}/leave-requests/${leaveRequestId}/decision`,
        { decision: 'approved', reason: 'Approved' },
        'staff-decision',
      ),
      await post(
        `${attendanceBase}/leave-requests/${leaveRequestId}/cancel`,
        { reason: 'Cancelled' },
        'staff-leave-cancel',
      ),
      await app.request(`${attendanceBase}/makeups?page=1&pageSize=10`),
      await app.request(`${attendanceBase}/makeups/candidates?page=1&pageSize=10`),
      await post(
        `${attendanceBase}/makeups`,
        { targetSessionId, reason: 'Makeup class' },
        'staff-makeup',
      ),
      await post(`${staffBase}/cancel`, { reason: 'Weather' }, 'session-cancel'),
      await app.request(`/teaching/organizations/demo/me/students/${studentId}/sessions?page=1&pageSize=10`),
      await app.request(`${learnerBase}/leave-requests?page=1&pageSize=10`),
      await post(`${learnerBase}/attendance/${attendanceId}/leave-requests`, { reason: 'Sick' }, 'learner-leave'),
      await post(
        `${learnerBase}/attendance/${attendanceId}/leave-requests/${leaveRequestId}/cancel`,
        { reason: 'Recovered' },
        'learner-leave-cancel',
      ),
    ];
    expect(responses.map((response) => response.status)).toEqual([
      200, 201, 200, 200, 200, 200, 201, 200, 200, 200, 201, 200,
    ]);
    for (const method of [
      'listLeaveRequests', 'createLeaveRequest', 'decideLeaveRequest', 'cancelLeaveRequest',
      'listMakeupAttempts', 'listMakeupCandidates', 'scheduleMakeup', 'cancelSession',
      'listLearnerSessions', 'listLearnerLeaveRequests', 'createLearnerLeaveRequest',
      'cancelLearnerLeaveRequest',
    ] as const) {
      expect(repo[method]).toHaveBeenCalledTimes(1);
    }

    const rejected = await post(
      `${attendanceBase}/makeups`,
      { targetSessionId, reason: 'Makeup class', studentId },
      'staff-makeup-extra',
    );
    expect(rejected.status).toBe(400);
    expect(repo.scheduleMakeup).toHaveBeenCalledTimes(1);
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
    const operations = await app.request('/teaching/organizations/demo/operations/overview');
    expect(operations.status).toBe(200);
    expect(operations.headers.get('cache-control')).toBe('no-store');
    expect(await operations.json()).toMatchObject({ operationsOverview: { range: { days: 30 } } });
    const audit = await app.request(
      '/teaching/organizations/demo/audit-events?q=denied%20review&outcome=denied&page=2&pageSize=10',
    );
    expect(audit.status).toBe(200);
    expect(audit.headers.get('cache-control')).toBe('no-store');
    expect(await audit.json()).toEqual({ auditEvents: [], total: 0, page: 1, pageSize: 30 });
    expect(repo.getOrganizationSummary).toHaveBeenCalledWith(ACTOR, 'demo', expect.any(String));
    expect(repo.getOperationsOverview).toHaveBeenCalledWith(ACTOR, 'demo', expect.any(String));
    expect(repo.listAuditEvents).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      { q: 'denied review', outcome: 'denied' },
      { page: 2, pageSize: 10, offset: 10 },
      expect.any(String),
    );
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

  it('rejects unknown audit outcomes before repository access', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });

    const response = await app.request('/teaching/organizations/demo/audit-events?outcome=unknown');

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(repo.listAuditEvents).not.toHaveBeenCalled();
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

  it('binds refund and reversal idempotency hashes to their path resources', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const packageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const refundRaw = JSON.stringify({
      credits: 2,
      reason: ' Duplicate charge ',
      sourceSystem: 'stripe',
      sourceRef: 'refund-42',
      sourceLineRef: null,
    });
    const refund = await app.request(
      `/teaching/organizations/demo/student-packages/${packageId}/refunds`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'refund-key' },
        body: refundRaw,
      },
    );
    expect(refund.status).toBe(201);
    expect(await refund.json()).toEqual({ ledgerEntry: { id: '1' }, studentPackage: { id: 'package-1' } });
    expect(repo.refundStudentPackageCredits).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      packageId,
      {
        credits: 2,
        reason: 'Duplicate charge',
        sourceSystem: 'stripe',
        sourceRef: 'refund-42',
        sourceLineRef: null,
      },
      'refund-key',
      createHash('sha256').update(JSON.stringify([packageId, refundRaw])).digest('hex'),
      expect.any(String),
    );

    const ledgerId = '9223372036854775807';
    const reversalRaw = JSON.stringify({ reason: 'Wrong package' });
    const reversal = await app.request(
      `/teaching/organizations/demo/student-packages/${packageId}/ledger/${ledgerId}/reversal`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'reversal-key' },
        body: reversalRaw,
      },
    );
    expect(reversal.status).toBe(201);
    expect(await reversal.json()).toEqual({ ledgerEntry: { id: '2' }, studentPackage: { id: 'package-1' } });
    expect(repo.reverseStudentPackageLedgerEntry).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      packageId,
      ledgerId,
      { reason: 'Wrong package' },
      'reversal-key',
      createHash('sha256').update(JSON.stringify([packageId, ledgerId, reversalRaw])).digest('hex'),
      expect.any(String),
    );
  });

  it('rejects unknown refund fields and out-of-range ledger bigint ids', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const packageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const invalidRefund = await app.request(
      `/teaching/organizations/demo/student-packages/${packageId}/refunds`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'refund-key' },
        body: JSON.stringify({
          credits: 1, reason: 'reason', sourceSystem: 'manual', sourceRef: '1', extra: true,
        }),
      },
    );
    expect(invalidRefund.status).toBe(400);
    expect(repo.refundStudentPackageCredits).not.toHaveBeenCalled();

    const invalidReversal = await app.request(
      `/teaching/organizations/demo/student-packages/${packageId}/ledger/9223372036854775808/reversal`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'reversal-key' },
        body: JSON.stringify({ reason: 'reason' }),
      },
    );
    expect(invalidReversal.status).toBe(400);
    expect(repo.reverseStudentPackageLedgerEntry).not.toHaveBeenCalled();
  });

  it('returns the frozen credit-adjustment feed envelope', async () => {
    repo.listCreditAdjustments = vi.fn().mockResolvedValue({
      items: [{ ledgerEntry: { id: '9007199254740993' } }], total: 1, page: 2, pageSize: 10,
    });
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const response = await app.request(
      '/teaching/organizations/demo/operations/credit-adjustments?page=2&pageSize=10',
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      creditAdjustments: [{ ledgerEntry: { id: '9007199254740993' } }],
      total: 1,
      page: 2,
      pageSize: 10,
    });
    expect(repo.listCreditAdjustments).toHaveBeenCalledWith(
      ACTOR, 'demo', { page: 2, pageSize: 10, offset: 10 }, expect.any(String),
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

  it('rejects caller-supplied attendance ownership and exposes session detail by UUID', async () => {
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
    expect(sanitized.status).toBe(400);
    expect(repo.saveAttendanceBatch).not.toHaveBeenCalled();

    const detail = await app.request(`/teaching/organizations/demo/sessions/${sessionId}`);
    expect(detail.status).toBe(200);
    expect(repo.getSession).toHaveBeenCalledWith(ACTOR, 'demo', sessionId, expect.any(String));
  });

  it('lists and appends strict lesson-feedback revisions with target-bound idempotency', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const sessionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    const listed = await app.request(
      `/teaching/organizations/demo/sessions/${sessionId}/feedback?page=2&pageSize=10`,
    );
    expect(listed.status).toBe(200);
    expect(listed.headers.get('cache-control')).toBe('no-store');
    expect(repo.listLessonFeedback).toHaveBeenCalledWith(
      ACTOR, 'demo', sessionId, { page: 2, pageSize: 10, offset: 10 }, expect.any(String),
    );

    const raw = JSON.stringify({
      visibility: 'student',
      summary: '  课堂状态稳定  ',
      strengths: '  观察准确  ',
      challenges: null,
      nextGoals: '  下周完成三次训练  ',
      internalNotes: null,
    });
    const created = await app.request(
      `/teaching/organizations/demo/sessions/${sessionId}/students/${studentId}/feedback`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'lesson-feedback-1' },
        body: raw,
      },
    );
    expect(created.status).toBe(201);
    expect(repo.createLessonFeedback).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      sessionId,
      studentId,
      {
        visibility: 'student',
        summary: '课堂状态稳定',
        strengths: '观察准确',
        challenges: null,
        nextGoals: '下周完成三次训练',
        internalNotes: null,
      },
      'lesson-feedback-1',
      createHash('sha256').update(JSON.stringify([sessionId, studentId, raw])).digest('hex'),
      expect.any(String),
    );
  });

  it('rejects unknown lesson-feedback fields before repository access', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const response = await app.request(
      '/teaching/organizations/demo/sessions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/students/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/feedback',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'lesson-feedback-invalid' },
        body: JSON.stringify({ visibility: 'staff_only', summary: '有效摘要', actorUserId: 99 }),
      },
    );
    expect(response.status).toBe(400);
    expect(repo.createLessonFeedback).not.toHaveBeenCalled();
  });

  it('lists and reads weekly reports without cacheable responses', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const reportId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const list = await app.request(
      `/teaching/organizations/demo/weekly-reports?studentId=${studentId}&page=2&pageSize=10`,
    );
    expect(list.status).toBe(200);
    expect(list.headers.get('cache-control')).toBe('no-store');
    expect(repo.listWeeklyReports).toHaveBeenCalledWith(
      ACTOR, 'demo', { studentId }, { page: 2, pageSize: 10, offset: 10 }, expect.any(String),
    );

    const detail = await app.request(`/teaching/organizations/demo/weekly-reports/${reportId}`);
    expect(detail.status).toBe(200);
    expect(detail.headers.get('cache-control')).toBe('no-store');
    expect(repo.getWeeklyReport).toHaveBeenCalledWith(ACTOR, 'demo', reportId, expect.any(String));
  });

  it('validates Monday generation and strict publication bodies with idempotency', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const reportId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const generateRaw = JSON.stringify({ studentId, weekStart: '2026-08-17' });
    const generated = await app.request('/teaching/organizations/demo/weekly-reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'weekly-generate-1' },
      body: generateRaw,
    });
    expect(generated.status).toBe(201);
    expect(repo.generateWeeklyReport).toHaveBeenCalledWith(
      ACTOR, 'demo', { studentId, weekStart: '2026-08-17' }, 'weekly-generate-1',
      createHash('sha256').update(generateRaw).digest('hex'), expect.any(String),
    );

    const publishRaw = JSON.stringify({
      teacherSummary: '  本周训练稳定  ',
      nextWeekPlan: '  下周加强观察  ',
      visibility: 'student_and_guardians',
    });
    const published = await app.request(
      `/teaching/organizations/demo/weekly-reports/${reportId}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'weekly-publish-1' },
        body: publishRaw,
      },
    );
    expect(published.status).toBe(200);
    expect(repo.publishWeeklyReport).toHaveBeenCalledWith(
      ACTOR,
      'demo',
      reportId,
      { teacherSummary: '本周训练稳定', nextWeekPlan: '下周加强观察', visibility: 'student_and_guardians' },
      'weekly-publish-1',
      createHash('sha256').update(publishRaw).digest('hex'),
      expect.any(String),
    );

    for (const body of [
      { studentId, weekStart: '2026-08-18' },
      { studentId, weekStart: '2026-08-17', actorUserId: 99 },
    ]) {
      const invalid = await app.request('/teaching/organizations/demo/weekly-reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'weekly-invalid' },
        body: JSON.stringify(body),
      });
      expect(invalid.status).toBe(400);
    }
    const invalidPublish = await app.request(
      `/teaching/organizations/demo/weekly-reports/${reportId}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'weekly-publish-invalid' },
        body: JSON.stringify({ teacherSummary: '', nextWeekPlan: 'ok', visibility: 'student' }),
      },
    );
    expect(invalidPublish.status).toBe(400);
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

  it('manages a strict guardian binding invite without caching the raw token', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const guardianLinkId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const inviteId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const base = `/teaching/organizations/demo/students/${studentId}/guardian-links/${guardianLinkId}`;

    const created = await app.request(`${base}/account-binding-invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'must-not-cache-token' },
      body: '{}',
    });
    expect(created.status).toBe(201);
    expect(created.headers.get('cache-control')).toBe('no-store');
    expect(repo.createGuardianAccountBindingInvite).toHaveBeenCalledWith(
      ACTOR, 'demo', studentId, guardianLinkId, { expiresInMinutes: 60 }, expect.any(String),
    );
    expect(vi.mocked(repo.createGuardianAccountBindingInvite).mock.calls[0])
      .not.toContain('must-not-cache-token');

    const current = await app.request(`${base}/account-binding-invite`);
    expect(current.status).toBe(200);
    expect(current.headers.get('cache-control')).toBe('no-store');
    expect(await current.json()).toEqual({ invite: { id: 'guardian-invite-1', status: 'pending' } });
    expect(repo.getCurrentGuardianAccountBindingInvite).toHaveBeenCalledWith(
      ACTOR, 'demo', studentId, guardianLinkId, expect.any(String),
    );

    const raw = '{}';
    const revoked = await app.request(`${base}/account-binding-invites/${inviteId}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'guardian-revoke-1' },
      body: raw,
    });
    expect(revoked.status).toBe(200);
    expect(revoked.headers.get('cache-control')).toBe('no-store');
    expect(repo.revokeGuardianAccountBindingInvite).toHaveBeenCalledWith(
      ACTOR, 'demo', studentId, guardianLinkId, inviteId, 'guardian-revoke-1',
      createHash('sha256').update(raw).digest('hex'), expect.any(String),
    );

    const invalid = await app.request(`${base}/account-binding-invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresInMinutes: 60, guardianUserId: 99 }),
    });
    expect(invalid.status).toBe(400);
    expect(repo.createGuardianAccountBindingInvite).toHaveBeenCalledTimes(1);
  });

  it('previews and consumes a guardian invite by hash only', async () => {
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });
    const token = 'G'.repeat(43);

    const preview = await app.request('/teaching/me/guardian-account-binding/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    expect(preview.status).toBe(200);
    expect(preview.headers.get('cache-control')).toBe('no-store');
    expect(await preview.json()).toEqual({
      organizationName: 'Demo',
      studentDisplayName: 'Student',
      relationship: 'parent',
      expiresAt: '2026-08-18T02:00:00.000Z',
    });
    const tokenHash = createHash('sha256').update(token).digest('hex');
    expect(repo.previewGuardianAccountBindingInvite).toHaveBeenCalledWith(
      ACTOR, { tokenHash }, expect.any(String),
    );

    const consumed = await app.request('/teaching/me/guardian-account-binding/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    expect(consumed.status).toBe(200);
    expect(consumed.headers.get('cache-control')).toBe('no-store');
    expect(repo.consumeGuardianAccountBindingInvite).toHaveBeenCalledWith(
      ACTOR, { tokenHash }, expect.any(String),
    );
    expect(JSON.stringify([
      ...vi.mocked(repo.previewGuardianAccountBindingInvite).mock.calls,
      ...vi.mocked(repo.consumeGuardianAccountBindingInvite).mock.calls,
    ])).not.toContain(token);

    const invalid = await app.request('/teaching/me/guardian-account-binding/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, studentId: 'spoofed' }),
    });
    expect(invalid.status).toBe(400);
    expect(repo.consumeGuardianAccountBindingInvite).toHaveBeenCalledTimes(1);
  });

  it('discovers stable global and organization-scoped learning contexts', async () => {
    const context = {
      organization: { slug: 'demo', name: 'Demo' },
      student: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', displayName: 'Student' },
      relationships: [
        { kind: 'student' },
        { kind: 'guardian', guardianLinkId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', relationship: 'parent' },
      ],
    };
    repo.listLearningContexts = vi.fn().mockResolvedValue([context]);
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });

    const global = await app.request('/teaching/me/learning-contexts');
    expect(global.status).toBe(200);
    expect(global.headers.get('cache-control')).toBe('no-store');
    expect(await global.json()).toEqual({ learningContexts: [context] });
    expect(repo.listLearningContexts).toHaveBeenNthCalledWith(1, ACTOR, null, expect.any(String));

    const scoped = await app.request('/teaching/organizations/demo/me/students');
    expect(scoped.status).toBe(200);
    expect(scoped.headers.get('cache-control')).toBe('no-store');
    expect(await scoped.json()).toEqual({ learningContexts: [context] });
    expect(repo.listLearningContexts).toHaveBeenNthCalledWith(2, ACTOR, 'demo', expect.any(String));
    expect(JSON.stringify(context).toLowerCase()).not.toContain('userid');
  });

  it('returns learner report and feedback envelopes with bounded pagination', async () => {
    const studentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const reportId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    repo.listLearnerWeeklyReports = vi.fn().mockResolvedValue({
      items: [{ id: reportId, status: 'published' }], total: 3, page: 2, pageSize: 10,
    });
    repo.getLearnerWeeklyReport = vi.fn().mockResolvedValue({ id: reportId, status: 'published' });
    repo.listLearnerLessonFeedback = vi.fn().mockResolvedValue({
      items: [{ id: 'feedback-1', visibility: 'student' }], total: 1, page: 1, pageSize: 5,
    });
    const app = createTeachingSaasRoutes({ authenticate: async () => ACTOR, repository: repo });

    const reports = await app.request(
      `/teaching/organizations/demo/me/students/${studentId}/weekly-reports?page=2&pageSize=10`,
    );
    expect(reports.status).toBe(200);
    expect(reports.headers.get('cache-control')).toBe('no-store');
    expect(await reports.json()).toEqual({
      weeklyReports: [{ id: reportId, status: 'published' }], total: 3, page: 2, pageSize: 10,
    });
    expect(repo.listLearnerWeeklyReports).toHaveBeenCalledWith(
      ACTOR, 'demo', studentId, { page: 2, pageSize: 10, offset: 10 }, expect.any(String),
    );

    const detail = await app.request(
      `/teaching/organizations/demo/me/students/${studentId}/weekly-reports/${reportId}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.headers.get('cache-control')).toBe('no-store');
    expect(await detail.json()).toEqual({ weeklyReport: { id: reportId, status: 'published' } });
    expect(repo.getLearnerWeeklyReport).toHaveBeenCalledWith(
      ACTOR, 'demo', studentId, reportId, expect.any(String),
    );

    const feedback = await app.request(
      `/teaching/organizations/demo/me/students/${studentId}/lesson-feedback?page=1&pageSize=5`,
    );
    expect(feedback.status).toBe(200);
    expect(feedback.headers.get('cache-control')).toBe('no-store');
    expect(await feedback.json()).toEqual({
      feedback: [{ id: 'feedback-1', visibility: 'student' }], total: 1, page: 1, pageSize: 5,
    });
    expect(repo.listLearnerLessonFeedback).toHaveBeenCalledWith(
      ACTOR, 'demo', studentId, { page: 1, pageSize: 5, offset: 0 }, expect.any(String),
    );

    const oversized = await app.request(
      `/teaching/organizations/demo/me/students/${studentId}/lesson-feedback?pageSize=101`,
    );
    expect(oversized.status).toBe(400);
    expect(repo.listLearnerLessonFeedback).toHaveBeenCalledTimes(1);
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
