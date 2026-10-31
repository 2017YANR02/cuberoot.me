import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), requireAppUserId: vi.fn(), getAccountBasicProfile: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query, sql: {} }));
vi.mock('../src/utils/account.js', () => ({ getAccountBasicProfile: mocks.getAccountBasicProfile }));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: mocks.requireAppUserId }));
vi.mock('../src/utils/recon_helpers.js', () => ({ checkRateLimit: vi.fn() }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'fixture-only' }));
import { accountAuthRoutes } from '../src/routes/account_auth.js';
const app = new Hono().route('/v1', accountAuthRoutes);
const save = (body: unknown) => app.request('/v1/auth/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAppUserId.mockResolvedValue(42);
  mocks.getAccountBasicProfile.mockResolvedValue({ fullName: 'Fixture' });
  mocks.query.mockImplementation(async (sql: string) => sql.startsWith('UPDATE') ? [{id:42}] : sql.includes('deskpet_catalog') ? [{entries:[]}] : [{deskpet_selection:'clawd'}]);
});
it('returns the private selection through the existing authenticated profile endpoint', async () => {
  const response = await app.request('/v1/auth/profile?v=3');
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toMatchObject({deskPetSelection:'clawd'});
  expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ?'), [42]);
});
it('writes only the authenticated account and refuses a switched session', async () => {
  expect((await save({deskPetSelection:'clawd',expectedUid:43})).status).toBe(409);
  expect(mocks.query).not.toHaveBeenCalled();
  expect((await save({deskPetSelection:'clawd',expectedUid:42})).status).toBe(200);
  expect(mocks.query).toHaveBeenLastCalledWith(expect.stringContaining('merged_into_user_id IS NULL'), ['clawd',42]);
});
it('rejects missing proof, invalid IDs and mixing profile mutations', async () => {
  expect((await save({deskPetSelection:'clawd'})).status).toBe(409);
  expect((await save({deskPetSelection:null,expectedUid:42})).status).toBe(400);
  expect((await save({deskPetSelection:'../clawd',expectedUid:42})).status).toBe(400);
  expect((await save({deskPetSelection:'clawd',expectedUid:42,name:'Other'})).status).toBe(400);
  expect(mocks.query.mock.calls.some(([sql])=>sql.startsWith('UPDATE'))).toBe(false);
});
it('requires authentication for reads and writes, and rejects a merged account at write time', async () => {
  mocks.requireAppUserId.mockRejectedValue(new HTTPException(401));
  expect((await app.request('/v1/auth/profile?v=3')).status).toBe(401);
  expect((await save({deskPetSelection:'clawd',expectedUid:42})).status).toBe(401);
  mocks.requireAppUserId.mockResolvedValue(42);
  mocks.query.mockResolvedValue([]);
  expect((await save({deskPetSelection:'clawd',expectedUid:42})).status).toBe(409);
});
