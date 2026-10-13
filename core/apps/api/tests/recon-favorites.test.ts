import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), requireAuth: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', async original => ({
  ...await original<typeof import('../src/utils/recon_helpers.js')>(), requireAuth: mocks.requireAuth,
}));
import { reconRoutes } from '../src/routes/recon.js';
const app = new Hono().route('/v1', reconRoutes);
const save = (active: unknown, id = '2795') => app.request(`/v1/recon/${id}/favorite`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active, userId: 999 }),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue({ uid: 7, wcaId: 'u7', isAdmin: false });
  mocks.query.mockResolvedValue([]);
});
it('requires login for both read and write', async () => {
  mocks.requireAuth.mockRejectedValue(new HTTPException(401));
  expect((await save(true)).status).toBe(401);
  expect((await app.request('/v1/recon/favorites')).status).toBe(401);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('accepts ordinary accounts and scopes writes to the authenticated account', async () => {
  mocks.query.mockResolvedValue([{ recon_id: 2795 }]);
  expect((await save(true)).status).toBe(200);
  expect(mocks.query.mock.lastCall?.[1]).toEqual([7, 2795, 'u7', false]);
  expect(mocks.query.mock.lastCall?.[0]).toContain("visibility IS DISTINCT FROM 'private' OR added_by_id = ? OR ?");
  expect(mocks.query.mock.lastCall?.[0]).toContain('ON CONFLICT (user_id, recon_id)');
  expect((await save(false)).status).toBe(200);
  expect(mocks.query.mock.lastCall).toEqual(['DELETE FROM recon_favorites WHERE user_id = ? AND recon_id = ?', [7, 2795]]);
});
it('rejects invalid input and inaccessible records', async () => {
  for (const value of ['yes', 1, null]) expect((await save(value)).status).toBe(400);
  expect((await save(true, '-1')).status).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
  expect((await save(true)).status).toBe(404);
});
it('keeps saved lists private and filters records that became private', async () => {
  const response = await app.request('/v1/recon/favorites');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([]);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(mocks.query.mock.calls[0][1]).toEqual([7, 'u7', false, 7]);
  expect(mocks.query.mock.calls[0][0]).toContain("visibility IS DISTINCT FROM 'private' OR added_by_id = ? OR ?");
});
