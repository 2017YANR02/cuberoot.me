import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: db.query, withTransaction: db.transaction }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAdminOrApiKey: async (c: { req: { header: (name: string) => string | undefined } }) => {
  if (c.req.header('Authorization') !== 'Bearer admin') throw new HTTPException(403);
  return { wcaId: 'admin' };
} }));
import { reconIntakeRoutes } from '../src/routes/recon_intake.js';

const app = new Hono().route('/v1', reconIntakeRoutes);
const sourceHash = 'a'.repeat(32);
const input = { source: 'https://cuberoot.me/recon/123', sourceReconId: 123, sourceReconHash: sourceHash,
  recording: { scramble: 'R', moves: [{ m: "R'", ts: 0 }], timeMs: 1000, model: 'GAN' },
  observed: { inspection: '', lines: [{ key: 'cross', kind: 'cross', fromIdx: 0, toIdx: 0, moves: ["R'"], label: null }] },
  annotations: [], verdict: 'correct', language: 'zh', hadOverride: false };
const post = (value: unknown) => app.request('/v1/recon-intake', { method: 'POST', headers: {
  Authorization: 'Bearer admin', 'Content-Type': 'application/json',
}, body: JSON.stringify({ id: randomUUID(), input: value }) });
beforeEach(() => { db.query.mockReset(); db.transaction.mockReset(); });

it('requires administrator access and defaults to the requested solver and collector', async () => {
  expect((await app.request('/v1/recon-intake/sources')).status).toBe(403);
  db.query.mockResolvedValue([{ id: 123, scramble: 'R', solution: "R'", comp: 'Deqing Small & Special 2026',
    comp_wca_id: 'DeqingSmallSpecial2026', country: 'CN', date: null, value: '4.00',
    intake_status: null, intake_id: null, truth_status: null, source_changed: false, source_hash: sourceHash }]);
  const response = await app.request('/v1/recon-intake/sources?status=pending', { headers: { Authorization: 'Bearer admin' } });
  expect(response.status).toBe(200);
  expect((await response.json()).items[0]).toMatchObject({ id: 123, scramble: 'R', sourceHash,
    competition: 'Deqing Small & Special 2026', competitionId: 'DeqingSmallSpecial2026', country: 'CN' });
  expect(db.query.mock.calls[0][0]).toContain('r.person_id = ?');
  expect(db.query.mock.calls[0][0]).toContain('r.added_by_id = ?');
  expect(db.query.mock.calls[0][1]).toEqual(['2023GENG02', '2023GENG02', '2017YANR02', '2017YANR02', 'pending', 'pending', 'pending', 0]);
});

it('parameterizes alternative filters and permits clearing either selector', async () => {
  db.query.mockResolvedValue([]);
  const response = await app.request('/v1/recon-intake/sources?status=collected&personId=2009ZEMD01&collectorId=&offset=50', { headers: { Authorization: 'Bearer admin' } });
  expect(response.status).toBe(200);
  expect(db.query.mock.calls[0][1]).toEqual(['2009ZEMD01', '2009ZEMD01', '', '', 'collected', 'collected', 'collected', 50]);
});

it('lists actual source solvers and collectors behind administrator access', async () => {
  expect((await app.request('/v1/recon-intake/sources/filters')).status).toBe(403);
  db.query.mockResolvedValue([{ role: 'person', id: '2009ZEMD01', name: 'Feliks Zemdegs' }, { role: 'collector', id: '2017YANR02', name: 'Ruimin Yan' }]);
  const response = await app.request('/v1/recon-intake/sources/filters', { headers: { Authorization: 'Bearer admin' } });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ persons: [{ id: '2009ZEMD01' }], collectors: [{ id: '2017YANR02' }] });
});

it('rejects changed source data and mismatched scrambles before inserting', async () => {
  const run = vi.fn().mockResolvedValueOnce([{ scramble: 'R', solution: "R'", source_hash: 'b'.repeat(32) }]);
  db.transaction.mockImplementation(fn => fn(run));
  expect((await post(input)).status).toBe(400);
  expect(run).toHaveBeenCalledTimes(1);
  run.mockReset().mockResolvedValueOnce([{ scramble: 'U', solution: "U'", source_hash: sourceHash }]);
  expect((await post(input)).status).toBe(400);
  expect(run).toHaveBeenCalledTimes(1);
  expect((await post({ ...input, sourceReconHash: undefined })).status).toBe(400);
});

it('rejects a source already collected under a different recording', async () => {
  const run = vi.fn().mockResolvedValueOnce([{ scramble: 'R', solution: "R'", source_hash: sourceHash }])
    .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  db.transaction.mockImplementation(fn => fn(run));
  expect((await post(input)).status).toBe(409);
  expect(run.mock.calls[2][0]).toContain('ON CONFLICT DO NOTHING');
});

it('persists the validated source identity and immutable source snapshot', async () => {
  const snapshot = { id: 123, scramble: 'R', solution: "R'" };
  const row = { id: randomUUID(), revision: 1, recording_hash: 'recording', content_hash: 'content', input,
    expected: input.observed, status: 'pending-test', created_by: 'admin', approved_by: 'admin',
    created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01'), latest_run: null,
    claimed_by: null, lease_until: null, source_snapshot: snapshot };
  const run = vi.fn().mockResolvedValueOnce([{ scramble: 'R', solution: "R'", source_hash: sourceHash, added_by_id: 'author' }])
    .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
  db.transaction.mockImplementation(fn => fn(run));
  const response = await post(input);
  expect(response.status).toBe(200);
  expect((await response.json()).sourceSnapshot).toEqual(snapshot);
  expect(run.mock.calls[0][0]).not.toContain('person_id');
  expect(run.mock.calls[2][1].slice(1, 3)).toEqual([123, snapshot]);
});
