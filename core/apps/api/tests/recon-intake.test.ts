import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAdminOrApiKey: async (c: { req: { header: (key: string) => string | undefined } }) => {
    if (c.req.header('Authorization') === 'Bearer admin') return { wcaId: 'reviewer' };
    if (c.req.header('X-Admin-Key') === 'test-key') return { wcaId: '__api_key__' };
    throw new HTTPException(403);
  },
}));
import { reconIntakeRoutes } from '../src/routes/recon_intake.js';
import { query, sql } from '../src/db/connection.js';
const app = new Hono().route('/v1', reconIntakeRoutes);
const snapshot = { inspection: '', lines: [{ key: 'cross', kind: 'cross', fromIdx: 0, toIdx: 0, moves: ["R'"], label: 'W cross' }] };
const input = { source: '', recording: { scramble: 'R', moves: [{ m: "R'", ts: 0 }], timeMs: 1000, model: 'GAN' },
  observed: snapshot, annotations: [], verdict: 'correct', language: 'en', hadOverride: false };
function request(path: string, body?: unknown, ai = false) {
  return app.request('/v1/recon-intake' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(ai ? { 'X-Admin-Key': 'test-key' } : { Authorization: 'Bearer admin' }) },
    body: body ? JSON.stringify(body) : undefined,
  });
}
it('protects the root collection and nested routes before database access', async () => {
  for (const path of ['', '/' + randomUUID()]) expect((await app.request('/v1/recon-intake' + path)).status).toBe(403);
  expect((await request('', { id: randomUUID(), input }, true)).status).toBe(403);
  expect((await request('/' + randomUUID() + '/review', { action: 'approve', revision: 1 }, true)).status).toBe(403);
});
it('rejects malformed recording ranges before database access', async () => {
  expect((await request('', { id: randomUUID(), input: { ...input, observed: { ...snapshot,
    lines: [{ ...snapshot.lines[0], toIdx: 2 }] } } })).status).toBe(400);
});
afterAll(() => sql.end({ timeout: 1 }));

describe.skipIf(process.env.RECON_INTAKE_PG_TEST !== '1')('intake transactions on isolated PostgreSQL', () => {
  beforeEach(async () => {
    if (process.env.DB_NAME !== 'recon_intake_test' || process.env.DB_HOST !== '127.0.0.1')
      throw new Error('Use the isolated local recon_intake_test database');
    await query('TRUNCATE recon_intake_runs, recon_intake_revisions, recon_intake');
  });
  async function create(needsFix = false) {
    const response = await request('', { id: randomUUID(), input: needsFix ? { ...input,
      verdict: 'needs-fix', annotations: [{ id: randomUUID(), range: null, observed: '', problem: 'Inspect notation', expectedAlgorithm: '', expectedEffect: 'Preserve gesture order' }] } : input });
    expect(response.status).toBe(200);
    return response.json();
  }
  async function claim(id: string) {
    const response = await request('/' + id + '/claim', {}, true);
    expect(response.status).toBe(200); return response.json();
  }
  const result = (claimed: any) => ({
    leaseToken: claimed.leaseToken, revision: claimed.item.revision, contentHash: claimed.item.contentHash,
    run: { id: randomUUID(), status: 'passed', actual: snapshot, errors: [], fingerprint: 'a'.repeat(64),
      libraryHash: 'b'.repeat(64), commit: 'c'.repeat(40), regressionPassed: true },
  });
  it('preserves device timestamps extending beyond the independent stopwatch', async () => {
    const recording = { ...input.recording, moves: [{ m: "R'", ts: 1225 }] };
    const response = await request('', { id: randomUUID(), input: { ...input, recording } });
    expect(response.status).toBe(200);
    expect((await response.json()).input.recording).toEqual(recording);
  });
  it('deduplicates submissions and grants exactly one concurrent claim', async () => {
    const one = await create(), two = await create();
    expect(two.id).toBe(one.id);
    const claims = await Promise.all([request('/' + one.id + '/claim', {}, true), request('/' + one.id + '/claim', {}, true)]);
    expect(claims.map(r => r.status).sort()).toEqual([200, 409]);
  });
  it('activates approved expectations across JSONB key ordering and retries immutable reports', async () => {
    const one = await create(), claimed = await claim(one.id), body = result(claimed);
    const response = await request('/' + one.id + '/results', body, true);
    expect(response.status).toBe(200); expect((await response.json()).status).toBe('active');
    expect((await request('/' + one.id + '/results', body, true)).status).toBe(200);
    expect((await request('/' + one.id + '/results', { ...body, run: { ...body.run, commit: 'd'.repeat(40) } }, true)).status).toBe(409);
    expect(await query('SELECT id FROM recon_intake_runs')).toHaveLength(1);
  });
  it('keeps proposals separate from approval, rejects old revisions, and retains revision history', async () => {
    const one = await create(true), claimed = await claim(one.id), body = result(claimed);
    const response = await request('/' + one.id + '/results', body, true);
    expect((await response.json()).status).toBe('needs-review');
    const approved = await request('/' + one.id + '/review', { revision: 1, action: 'approve' });
    expect(approved.status).toBe(200);
    const next = await approved.json();
    expect(next.revision).toBe(2); expect(next.status).toBe('pending-test');
    expect((await request('/' + one.id + '/results', { ...body, run: { ...body.run, id: randomUUID() } }, true)).status).toBe(409);
    const detail = await (await request('/' + one.id)).json();
    expect(detail.revisions).toHaveLength(2); expect(detail.runs).toHaveLength(1);
    expect(detail.revisions[1].expected).toBeNull();
  });
  it('rejects expired leases and mismatched passing answers', async () => {
    const one = await create(), claimed = await claim(one.id), body = result(claimed);
    expect((await request('/' + one.id + '/results', { ...body, run: { ...body.run, actual: { ...snapshot, inspection: 'x' } } }, true)).status).toBe(400);
    await query("UPDATE recon_intake SET lease_until = NOW() - INTERVAL '1 second' WHERE id = ?", [one.id]);
    expect((await request('/' + one.id + '/results', body, true)).status).toBe(409);
  });
});
