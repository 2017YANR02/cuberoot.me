import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  queries: [] as { statement: string; parameters: readonly unknown[] }[],
  benefit: {} as Record<string, unknown>,
  missingLesson: false, publicLesson: false, allowed: false,
}));
vi.mock('../src/db/connection.js', () => {
  const unsafe = async (statement: string, parameters: readonly unknown[] = []) => {
    state.queries.push({ statement, parameters });
    if (statement.includes('INSERT INTO platform_idempotency_requests')) return [{ id: 'request' }];
    if (statement.includes('SELECT id::text AS id, encode(request_hash')) {
      return [{ id: 'request', request_hash_hex: state.queries[0]!.parameters[4], state: 'processing' }];
    }
    if (statement.includes('SELECT id FROM platform_lessons')) return state.missingLesson ? [] : (parameters[1] as string[]).map(id => ({ id }));
    if (statement.includes('SELECT id::text FROM platform_courses')) return [{ id: parameters[0] }];
    if (statement.includes('FROM platform_invite_codes') && statement.includes('FOR UPDATE')) {
      return [{ id: 'invite', status: 'active', expires_at: null, max_redemptions: null, benefit_snapshot: state.benefit }];
    }
    if (statement.includes('INSERT INTO')) return [{ id: 'created' }];
    if (statement.includes('FROM platform_lessons lesson JOIN platform_courses')) {
      return [{ course_id: COURSE, current_revision: 1, access_scope: state.publicLesson ? 'public' : 'entitled' }];
    }
    if (statement.includes('AS allowed')) return [{ allowed: state.allowed }];
    if (statement.includes('SELECT media.id::text')) return [{ id: TRIAL, storage_key: 'test.mp4', mime_type: 'video/mp4', size_bytes: 10 }];
    return [];
  };
  return { sql: { unsafe, begin: async (run: (db: unknown) => Promise<unknown>) => run({ unsafe }) } };
});
vi.mock('../src/platform/auth.js', () => ({
  requirePlatformAdmin: async () => ({ userId: null, ownerKey: '__api_key__', isAdmin: true }),
  requirePlatformActor: vi.fn(async () => ({ userId: 7, ownerKey: 'test', isAdmin: false })),
}));

import { requirePlatformActor } from '../src/platform/auth.js';
import { platformLearningRoutes } from '../src/routes/platform_learning.js';
const COURSE = '4ad6b1c8-9eb2-4801-bfd2-dfecd5d4aacc';
const TRIAL = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FORMAL = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const post = (path: string, body: unknown) => platformLearningRoutes.request(path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'lesson-grants-test' }, body: JSON.stringify(body),
});

beforeEach(() => {
  state.queries = []; state.benefit = { courseId: COURSE, lessonIds: [TRIAL] };
  state.missingLesson = false; state.publicLesson = false; state.allowed = false;
  vi.mocked(requirePlatformActor).mockClear();
  vi.stubEnv('PLATFORM_MEDIA_SIGNING_SECRET', 'lesson-grants-regression-test-secret');
});

describe('Scoped course invitations', () => {
  it('preserves lesson scope, unlimited redemptions and editable expiration', async () => {
    const response = await post('/admin/invites', { benefit: state.benefit, expiresAt: '2030-01-01T00:00:00Z' });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ benefitSnapshot: state.benefit, maxRedemptions: null });
    expect(state.queries.find(q => q.statement.includes('INSERT INTO platform_invite_codes'))!.parameters[5]).toEqual(state.benefit);
  });
  it.each([[], [TRIAL, TRIAL], [null], ['invalid'], TRIAL, Array(1001).fill(TRIAL)].map(lessonIds => ({ lessonIds })))('rejects invalid lesson scope %j', async ({ lessonIds }) => {
    const response = await post('/admin/invites', { benefit: { courseId: COURSE, lessonIds } });
    expect(response.status).toBe(400);
    expect(state.queries.some(q => q.statement.includes('INSERT INTO platform_invite_codes'))).toBe(false);
  });
  it('rejects lessons outside the course', async () => {
    state.missingLesson = true;
    expect((await post('/admin/invites', { benefit: state.benefit })).status).toBe(400);
  });
  it('does not accept lesson scopes on membership grants', async () => {
    expect((await post('/admin/invites', { benefit: { membershipPlanId: COURSE, lessonIds: [TRIAL] } })).status).toBe(400);
  });
  it.each([{ lessonIds: [TRIAL] }, { lessonIds: undefined }])('snapshots scope on the immutable redemption grant: %j', async ({ lessonIds }) => {
    state.benefit = { courseId: COURSE, ...(lessonIds ? { lessonIds } : {}) };
    const response = await post('/invites/redeem', { code: 'TEST-CODE' });
    expect(response.status).toBe(201);
    const grant = state.queries.find(q => q.statement.includes('INSERT INTO platform_entitlement_ledger'))!;
    expect(grant.statement).toContain('lesson_ids');
    expect(grant.parameters[2]).toEqual(lessonIds ?? null);
  });
  it('allows anonymous public media without calling account authentication', async () => {
    state.publicLesson = true;
    const response = await platformLearningRoutes.request(`/lessons/${TRIAL}/media`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mimeType: 'video/mp4', accessUrl: expect.stringContaining('token=') });
    expect(requirePlatformActor).not.toHaveBeenCalled();
  });
  it('checks the exact protected lesson before issuing a playback token', async () => {
    expect((await platformLearningRoutes.request(`/lessons/${FORMAL}/media`)).status).toBe(403);
    const query = state.queries.find(q => q.statement.includes('AS allowed'))!;
    expect(query.parameters).toEqual([7, COURSE, FORMAL]);
    expect(state.queries.some(q => q.statement.includes('SELECT media.id::text'))).toBe(false);
    state.allowed = true;
    expect((await platformLearningRoutes.request(`/lessons/${TRIAL}/media`)).status).toBe(200);
  });
});
