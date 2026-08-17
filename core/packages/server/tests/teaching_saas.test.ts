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
});
