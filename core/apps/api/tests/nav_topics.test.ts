import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_CARD_GROUP_ID, ACCOUNT_CARD_IDS, SITE_DIRECTORY_GROUPS } from '@cuberoot/shared/site-directory';

const db = vi.hoisted(() => ({ query: vi.fn(), transactionQuery: vi.fn(), withTransaction: vi.fn() }));
const invalidate = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../src/utils/recon_revalidate.js', () => ({ revalidateContentPages: invalidate }));
vi.mock('../src/db/connection.js', () => db);
vi.mock('../src/utils/recon_helpers.js', () => ({
  checkRateLimit: vi.fn(),
  requireAdminOrApiKey: (c: { req: { header: (name: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'Bearer test-admin') throw new HTTPException(403);
  },
}));
import { navSitesRoutes } from '../src/routes/nav_sites.js';
const app = new Hono().route('/v1', navSitesRoutes);
const mutate = (method: string, body: unknown, admin = true) => app.request('/v1/nav/topics', {
  method, headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer test-admin' } : {}) },
  body: JSON.stringify(body),
});

describe('directory topic administration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockResolvedValue([{ tag: 'Tutorial 教程' }]);
    db.transactionQuery.mockImplementation((sql: string) => Promise.resolve(sql.startsWith('SELECT')
      ? [{ tag: 'Tutorial 教程' }, { tag: 'Timer 计时器' }] : []));
    db.withTransaction.mockImplementation(work => work(db.transactionQuery));
  });
  it('invalidates homepage snapshots only after successful visibility and homepage ordering writes', async () => {
    const write = (path: string, body: unknown, admin = true) => app.request(`/v1/nav/${path}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer test-admin' } : {}) },
      body: JSON.stringify(body),
    });
    expect((await write('home-locks', { id: 'timer', locked: true }, false)).status).toBe(403);
    expect((await write('home-locks', { id: 'unknown', locked: true })).status).toBe(400);
    expect(invalidate).not.toHaveBeenCalled();
    expect((await write('home-locks', { id: 'timer', locked: true })).status).toBe(200);
    expect(db.query.mock.invocationCallOrder.at(-1)!).toBeLessThan(invalidate.mock.invocationCallOrder[0]);
    const group = SITE_DIRECTORY_GROUPS.find(group => group.id === 'main')!;
    expect((await write('home-order', { groupId: group.id, ids: group.entries.map(entry => entry.id) })).status).toBe(200);
    expect(invalidate.mock.calls).toEqual([['home'], ['home']]);
    expect((await write('home-order', { groupId: ACCOUNT_CARD_GROUP_ID, ids: ACCOUNT_CARD_IDS })).status).toBe(200);
    expect(invalidate).toHaveBeenCalledTimes(2);
    db.query.mockRejectedValueOnce(new Error('write failed'));
    expect((await write('home-locks', { id: 'timer', locked: false })).status).toBe(500);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });
  it('allows public reads but requires admin authorization for every mutation', async () => {
    const read = await app.request('/v1/nav/topics');
    expect(await read.json()).toEqual(['Tutorial 教程']);
    expect(read.headers.get('Cache-Control')).toBe('no-store');
    for (const method of ['POST', 'PUT', 'DELETE']) {
      expect((await mutate(method, { tag: 'Tutorial 教程', replacement: 'Guide 指南' }, false)).status).toBe(403);
    }
    expect(db.withTransaction).not.toHaveBeenCalled();
  });
  it('rejects empty, malformed and oversized names before opening a transaction', async () => {
    for (const tag of ['', ' ', ' topic', 'a,b', 'a，b', 'a\nb', 'x'.repeat(161), null, [], 123]) {
      expect((await mutate('POST', { tag })).status).toBe(400);
    }
    expect((await mutate('PUT', { tag: 'Tutorial 教程', replacement: '' })).status).toBe(400);
    expect(db.withTransaction).not.toHaveBeenCalled();
  });
  it('rejects missing sources and conflicting names without updating sites', async () => {
    expect((await mutate('DELETE', { tag: 'missing' })).status).toBe(404);
    expect((await mutate('POST', { tag: 'Tutorial 教程' })).status).toBe(409);
    expect((await mutate('PUT', { tag: 'Tutorial 教程', replacement: 'Timer 计时器' })).status).toBe(409);
    expect(db.transactionQuery.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });
  it('creates unused topics and renames or removes existing site associations atomically', async () => {
    expect((await mutate('POST', { tag: 'Guide 指南' })).status).toBe(200);
    expect((await mutate('PUT', { tag: 'Tutorial 教程', replacement: 'Guide 指南' })).status).toBe(200);
    expect((await mutate('DELETE', { tag: 'Tutorial 教程' })).status).toBe(200);
    expect(db.withTransaction).toHaveBeenCalledTimes(3);
    const updates = db.transactionQuery.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'));
    expect(updates.map(([, params]) => params)).toEqual([
      ['Tutorial 教程', 'Guide 指南', 'Tutorial 教程'], ['Tutorial 教程', 'Tutorial 教程'],
    ]);
  });
});
