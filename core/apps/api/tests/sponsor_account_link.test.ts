import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), run: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({
  query: mocks.query,
  sql: {},
  withTransaction: (work: (run: typeof mocks.run) => Promise<unknown>) => work(mocks.run),
}));
vi.mock('../src/utils/recon_helpers.js', () => ({
  checkRateLimit: vi.fn(),
  requireAdminOrApiKey: (c: { req: { header: (key: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'Bearer admin') throw new HTTPException(403);
    return { wcaId: '__api_key__', name: 'Admin' };
  },
}));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: vi.fn() }));
vi.mock('../src/utils/notify.js', () => ({ adminRecipients: vi.fn(), notify: vi.fn() }));
import { sponsorsRoutes } from '../src/routes/sponsors.js';

const app = new Hono().route('/v1', sponsorsRoutes);
const row = { id: 13, name: '卢政宇', amount: 20, currency: 'CNY', wca_id: null, avatar_url: null, message: null, claimed_by_user_id: 442 };
const put = (body: unknown, admin = true) => app.request('/v1/sponsors/13', {
  method: 'PUT', headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer admin' } : {}) },
  body: JSON.stringify(body),
});
const fields = { name: row.name, amount: 20 };

beforeEach(() => { vi.clearAllMocks(); mocks.query.mockResolvedValue([row]); });

describe('direct sponsor account association', () => {
  it('keeps account IDs private and the authenticated list uncached', async () => {
    const publicResponse = await app.request('/v1/sponsors');
    expect(await publicResponse.json()).toEqual([{ id: 13, name: row.name, amount: 20, currency: 'CNY', claimed: true }]);
    const denied = await app.request('/v1/sponsors?admin=1');
    expect(denied.status).toBe(403);
    expect(denied.headers.get('Cache-Control')).toBe('no-store');
    const adminResponse = await app.request('/v1/sponsors?admin=1', { headers: { Authorization: 'Bearer admin' } });
    expect(adminResponse.headers.get('Cache-Control')).toBe('no-store');
    expect((await adminResponse.json() as { userId: number }[])[0].userId).toBe(442);
  });

  it('links a registered account without a WCA ID and closes pending history in the same transaction', async () => {
    mocks.run.mockResolvedValueOnce([row]).mockResolvedValueOnce([{ id: 442 }]).mockResolvedValueOnce([row]).mockResolvedValue([]);
    const response = await put({ ...fields, userId: 442 });
    expect(response.status).toBe(200);
    expect((await response.json() as { userId: number }).userId).toBe(442);
    expect(mocks.run.mock.calls[2][1].slice(6)).toEqual([true, 442, true, 442, 13]);
    const historyCalls = mocks.run.mock.calls.slice(3);
    expect(historyCalls).toHaveLength(3);
    expect(historyCalls[0][0]).toContain("status = 'revoked'");
    expect(historyCalls[1][0]).toContain("status = 'cancelled'");
    expect(historyCalls[2][0]).toContain("status = 'approved'");
    for (const call of historyCalls) expect(call[1]).toEqual([13, 442]);
  });

  it('does not let unauthorized or nonexistent accounts change ownership', async () => {
    expect((await put({ ...fields, userId: 442 }, false)).status).toBe(403);
    expect(mocks.run).not.toHaveBeenCalled();
    mocks.run.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
    expect((await put({ ...fields, userId: 999999 })).status).toBe(400);
    expect(mocks.run).toHaveBeenCalledTimes(2);
    for (const userId of [0, -1, 1.5, '442']) expect((await put({ ...fields, userId })).status).toBe(400);
  });

  it('preserves association for legacy edits and supports explicit unlinking', async () => {
    mocks.run.mockResolvedValueOnce([row]).mockResolvedValueOnce([row]);
    expect((await put(fields)).status).toBe(200);
    expect(mocks.run.mock.calls[1][1].slice(6)).toEqual([false, null, false, null, 13]);
    expect(mocks.run).toHaveBeenCalledTimes(2);
    mocks.run.mockClear().mockResolvedValueOnce([row]).mockResolvedValueOnce([{ ...row, claimed_by_user_id: null }]).mockResolvedValue([]);
    const response = await put({ ...fields, userId: null });
    expect(response.status).toBe(200);
    expect((await response.json() as { userId: null }).userId).toBeNull();
    expect(mocks.run.mock.calls[1][1].slice(6)).toEqual([true, null, true, null, 13]);
  });
});
