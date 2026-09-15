import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_CARD_IDS, ACCOUNT_CARD_GROUP_ID, SITE_DIRECTORY_GROUPS } from '@cuberoot/shared/site-directory';

const db = vi.hoisted(() => ({ query: vi.fn(), transactionQuery: vi.fn(), withTransaction: vi.fn() }));
vi.mock('../src/db/connection.js', () => db);
vi.mock('../src/utils/recon_helpers.js', () => ({
  checkRateLimit: vi.fn(),
  requireAdminOrApiKey: (c: { req: { header: (name: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'Bearer test-admin') throw new HTTPException(403);
  },
}));
import { navSitesRoutes } from '../src/routes/nav_sites.js';
const app = new Hono().route('/v1', navSitesRoutes);
const put = (body: unknown, admin = true) => app.request('/v1/nav/home-order', {
  method: 'PUT', headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer test-admin' } : {}) },
  body: JSON.stringify(body),
});

describe('shared account card order API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockResolvedValue([]);
    db.withTransaction.mockImplementation(work => work(db.transactionQuery));
  });
  it('requires admin access and a complete, unique known card set before any write', async () => {
    const body = { groupId: ACCOUNT_CARD_GROUP_ID, ids: [...ACCOUNT_CARD_IDS] };
    expect((await put(body, false)).status).toBe(403);
    for (const invalid of [null, {}, { ...body, groupId: 'unknown' }, { ...body, ids: [] },
      { ...body, ids: ACCOUNT_CARD_IDS.slice(1) }, { ...body, ids: [...ACCOUNT_CARD_IDS, 'pet'] },
      { ...body, ids: [...ACCOUNT_CARD_IDS.slice(1), 'unknown'] }, { ...body, ids: [1] }]) {
      expect((await put(invalid)).status).toBe(400);
    }
    expect(db.withTransaction).not.toHaveBeenCalled();
  });
  it('replaces only the account group in one transaction and publicly exposes its order', async () => {
    const ids = [...ACCOUNT_CARD_IDS].reverse();
    expect((await put({ groupId: ACCOUNT_CARD_GROUP_ID, ids })).status).toBe(200);
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(db.transactionQuery.mock.calls[0]).toEqual(['DELETE FROM home_card_positions WHERE group_id = ?', ['account']]);
    expect(db.transactionQuery.mock.calls[1][1]).toEqual(ids.flatMap((id, index) => ['account', id, index]));
    db.query.mockResolvedValue(ids.map(item_id => ({ group_id: 'account', item_id })));
    const response = await app.request('/v1/nav/home-order');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ orders: { account: ids } });
  });
  it('preserves homepage ordering and does not extend homepage locks to account cards', async () => {
    const group = SITE_DIRECTORY_GROUPS.find(group => group.placement !== 'footer')!;
    expect((await put({ groupId: group.id, ids: group.entries.map(entry => entry.id).reverse() })).status).toBe(200);
    const response = await app.request('/v1/nav/home-locks', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-admin' },
      body: JSON.stringify({ id: 'pet', locked: true }),
    });
    expect(response.status).toBe(400);
  });
});
