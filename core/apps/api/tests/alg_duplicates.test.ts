import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({ query: vi.fn(), user: { wcaId: 'test-user', name: 'Test', isAdmin: false } }));
vi.mock('../src/db/connection.js', () => ({
  query: mocks.query,
  withTransaction: (run: (q: typeof mocks.query) => unknown) => run(mocks.query),
}));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: () => '127.0.0.1' }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: async () => mocks.user, requireAdmin: vi.fn(), requireAdminOrApiKey: vi.fn(), checkRateLimit: vi.fn(),
}));
vi.mock('../src/utils/account.js', () => ({ publicUserIdsForOwnerKeys: async () => new Map() }));
vi.mock('../src/utils/alg_mirror.js', () => ({ syncMirrorAndLog: vi.fn(), syncMirrorForCase: vi.fn() }));
vi.mock('../src/utils/alg_case_setup.js', () => ({ validateRequiredAlgCaseSetup: async () => null }));

import { algRoutes } from '../src/routes/alg';
import { algSetsRoutes } from '../src/routes/alg_sets';
import { assertUniqueCaseAlgs } from '../src/utils/alg_duplicates';

const app = new Hono();
// Prove route-specific 409s survive mounting beneath the production-style fallback.
app.onError((error, c) => c.json({ error: error.message }, 500));
app.route('/v1', algRoutes);
app.route('/v1', algSetsRoutes);
const existing = { id: 7, puzzle: '3x3', set_slug: 'oll', case_name: 'L', alg: 'R U', notes: null, tags: ['oh'], author_id: 'test-user', author_name: 'Test', created_at: new Date(0) };
const send = (path: string, method: string, body: unknown) => app.request(`/v1/alg/${path}`, {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('standard and community formula duplicate enforcement', () => {
  beforeEach(() => { mocks.query.mockReset(); mocks.user.isAdmin = false; });

  it('rejects the L screenshot duplicate against the standard library with 409', async () => {
    mocks.query.mockImplementation(async (sql: string) => sql.startsWith('SELECT algs FROM')
      ? [{ algs: [[{ alg: "(F R' F' r) (U R U' r')" }]] }] : []);
    const r = await send('3x3/oll/L/submit', 'POST', { alg: "F R' F' r U R U' r'" });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: 'duplicate_alg' });
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
    expect(mocks.query.mock.calls[0]).toEqual([
      'SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', ['["alg","3x3","oll"]'],
    ]);
  });

  it('rejects a duplicate from another community author', async () => {
    mocks.query.mockImplementation(async (sql: string) => sql.startsWith('SELECT id, alg') ? [{ id: 9, alg: '(R U)' }] : []);
    expect((await send('3x3/oll/L/submit', 'POST', { alg: 'R U' })).status).toBe(409);
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
  });

  it('allows editing the same submission without counting itself as a duplicate', async () => {
    mocks.query.mockImplementation(async (sql: string) => sql.startsWith('SELECT * FROM alg_submissions') || sql.startsWith('SELECT id, alg') ? [existing] : []);
    const r = await send('submissions/7', 'PUT', { alg: '(R U)', notes: 'Updated note', tags: ['beginner', 'beginner'] });
    expect(r.status).toBe(200);
    expect(mocks.query.mock.calls).toContainEqual([
      'UPDATE alg_submissions SET alg = ?, notes = ?, tags = ? WHERE id = ?',
      ['(R U)', 'Updated note', ['beginner'], 7],
    ]);
  });

  it('rejects unknown community tags before querying the database', async () => {
    const r = await send('3x3/pll/Ga/submit', 'POST', { alg: 'R U', tags: ['oh', 'other'] });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'invalid_tags' });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('checks the target case when an administrator moves a submission', async () => {
    mocks.user.isAdmin = true;
    mocks.query.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('SELECT * FROM alg_submissions')) return [existing];
      if (sql.startsWith('SELECT algs FROM') && params[2] === 'T') return [{ algs: [[{ alg: '(R U)' }]] }];
      return [];
    });
    expect((await send('submissions/7', 'PUT', { alg: 'R U', caseName: 'T' })).status).toBe(409);
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });

  it.each(['POST', 'PUT'])('rejects duplicate standard rows on %s', async method => {
    mocks.query.mockResolvedValue([]);
    const path = 'sets/3x3/oll/cases' + (method === 'PUT' ? '/3930' : '');
    const r = await send(path, method, { caseName: 'L', sticker: {}, algs: [[{ alg: '(R U)' }, { alg: 'R U' }]] });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: 'duplicate_alg' });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each([
    ['POST', 'sets/3x3/pll/cases', "(R U R'"],
    ['PUT', 'sets/3x3/pll/cases/4309', "R U R')"],
  ])('rejects unbalanced standard rows on %s', async (method, path, alg) => {
    mocks.query.mockResolvedValue([]);
    const r = await send(path, method, { caseName: 'Ga', sticker: {}, algs: [[{ alg }]] });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'unbalanced_grouping_parentheses' });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('rejects unbalanced community submissions before querying the database', async () => {
    const r = await send('3x3/pll/Ga/submit', 'POST', { alg: "R U (R'" });
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'unbalanced_grouping_parentheses' });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each([
    ['community alg', '3x3/f2l/A-/submit', { alg: "U' r' D' rU r' Dr" }],
    ['standard alg', 'sets/3x3/f2l/cases', { caseName: 'A-', sticker: {}, algs: [[{ alg: "U' r' D' rU r' Dr" }]] }],
    ['standard setup', 'sets/3x3/f2l/cases', { caseName: 'A-', sticker: {}, setup: 'rU', algs: [] }],
  ])('rejects glued nonparallel moves in a %s before querying the database', async (_kind, path, body) => {
    const r = await send(path, 'POST', body);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: 'moves_must_be_space_separated' });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('prevents a standard edit from duplicating an existing community submission', async () => {
    mocks.query.mockImplementation(async (sql: string) => sql.startsWith('SELECT id, alg') ? [existing] : []);
    const r = await send('sets/3x3/oll/cases/3930', 'PUT', { caseName: 'L', sticker: {}, algs: [[{ alg: '(R U)' }]] });
    expect(r.status).toBe(409);
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });

  it('keeps independent orientations and rejects malformed row arrays', () => {
    expect(() => assertUniqueCaseAlgs([[{ alg: 'R U' }], [{ alg: '(R U)' }]])).not.toThrow();
    expect(() => assertUniqueCaseAlgs([{}])).toThrow('invalid algs');
  });
});
