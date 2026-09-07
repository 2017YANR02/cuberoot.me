import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const state = vi.hoisted(() => ({ queries: [] as { statement: string; parameters: readonly unknown[] }[] }));
vi.mock('../src/db/connection.js', () => ({
  sql: { begin: async (run: (db: unknown) => Promise<unknown>) => run({
    unsafe: async (statement: string, parameters: readonly unknown[] = []) => {
      state.queries.push({ statement, parameters });
      if (statement.includes('INSERT INTO platform_idempotency_requests')) return [{ id: 'request' }];
      if (statement.includes('SELECT id::text AS id, encode(request_hash')) {
        return [{ id: 'request', request_hash_hex: state.queries[0]!.parameters[4], state: 'processing' }];
      }
      if (statement.includes('SELECT id::text FROM platform_courses')) return [{ id: parameters[0] }];
      if (statement.includes('INSERT INTO platform_invite_codes')) {
        expect(parameters[5]).toEqual({ courseId: '4ad6b1c8-9eb2-4801-bfd2-dfecd5d4aacc' });
        return [{ id: 'invite' }];
      }
      return [];
    },
  }) },
}));
vi.mock('../src/platform/auth.js', () => ({
  requirePlatformAdmin: async () => ({ userId: null, ownerKey: '__api_key__', wcaId: null, displayName: 'Test', isAdmin: true, viaApiKey: true }),
  requirePlatformActor: vi.fn(),
}));

import { enqueuePlatformEvent, withIdempotency } from '../src/platform/db.js';
import { platformLearningRoutes } from '../src/routes/platform_learning.js';

describe('Platform JSONB parameters', () => {
  it('creates a single-use course invite with an object benefit snapshot', async () => {
    state.queries = [];
    const response = await platformLearningRoutes.request('/admin/invites', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'invite-json-regression' },
      body: JSON.stringify({ maxRedemptions: 1, benefit: { courseId: '4ad6b1c8-9eb2-4801-bfd2-dfecd5d4aacc' } }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ maxRedemptions: 1, benefitSnapshot: { courseId: '4ad6b1c8-9eb2-4801-bfd2-dfecd5d4aacc' } });
  });
  it('passes objects to postgres without double-encoding events or idempotent responses', async () => {
    state.queries = [];
    const body = { courseId: 'course', nested: { enabled: true }, items: [] };
    const app = new Hono();
    app.post('/', async c => {
      const result = await withIdempotency(c, {
        userId: 66, ownerKey: 'test', wcaId: null, displayName: 'Test', isAdmin: true, viaApiKey: false,
      }, 'test.json', {}, async db => {
        await enqueuePlatformEvent(db, 'test.created', 'course', 'course', 'test:course', body);
        return { status: 201, body };
      });
      return c.json(result.body, result.status);
    });
    const response = await app.request('/', { method: 'POST', headers: { 'Idempotency-Key': 'json-regression-test' } });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(body);
    expect(state.queries.find(q => q.statement.includes('INSERT INTO platform_outbox_events'))!.parameters[4]).toEqual(body);
    expect(state.queries.find(q => q.statement.includes("SET state = 'completed'"))!.parameters[2]).toEqual(body);
  });
});
