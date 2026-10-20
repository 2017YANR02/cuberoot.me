import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', async original => ({
  ...await original<typeof import('../src/utils/recon_helpers.js')>(),
  requireAdminOrApiKey: (c: { req: { header: (key: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'Bearer admin') throw new HTTPException(403);
    return { wcaId: '2017YANR02' };
  },
}));
import { reconGroundTruthRoutes } from '../src/routes/recon_ground_truth.js';
const app = new Hono().route('/v1', reconGroundTruthRoutes);
const run = { version: 1, id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', startedAt: '2026-10-15T10:00:00Z', finishedAt: '2026-10-15T10:01:00Z',
  status: 'failed', trigger: 'ci', commit: 'a'.repeat(40), dirty: false, fingerprint: 'b'.repeat(64), pid: 1,
  cases: [], passed: 0, failed: 1, total: 1, errors: ['Regression found'] };
const post = (body: unknown, admin = true) => app.request('/v1/recon-ground-truth/runs', { method: 'POST', headers: { Authorization: admin ? 'Bearer admin' : '', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { mocks.query.mockReset().mockResolvedValue([]); });
it('requires administrator access for both read and write before database access', async () => {
  expect((await app.request('/v1/recon-ground-truth/runs')).status).toBe(403);
  expect((await post(run, false)).status).toBe(403); expect(mocks.query).not.toHaveBeenCalled();
});
it('validates reports and writes immutable JSONB idempotently', async () => {
  expect((await post({ ...run, id: '../../bad' })).status).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
  expect((await post(run)).status).toBe(200);
  const [sql, params] = mocks.query.mock.calls[0];
  expect(sql).toContain('ON CONFLICT (id) DO NOTHING'); expect(params[2]).toEqual(run);
});
it('paginates with integer offsets, a continuation flag and private uncached responses', async () => {
  mocks.query.mockResolvedValue(Array.from({ length: 21 }, () => ({ payload: run })));
  const result = await app.request('/v1/recon-ground-truth/runs?offset=1.8', { headers: { Authorization: 'Bearer admin' } });
  expect(result.status).toBe(200); expect(result.headers.get('Cache-Control')).toBe('private, no-store');
  const body = await result.json(); expect(body.runs).toHaveLength(20); expect(body.hasMore).toBe(true);
  expect(mocks.query.mock.calls[0][1]).toEqual([1]);
});
