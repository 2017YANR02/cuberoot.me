import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), requireAppUserId: vi.fn(), getUserById: vi.fn(), deleteAccount: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: vi.fn(), sql: {} }));
vi.mock('../src/utils/account.js', () => ({ getUserById: mocks.getUserById, ownerKey: (id: number, wca: string | null) => wca || `u${id}` }));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: mocks.requireAppUserId }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAdmin: mocks.requireAdmin, checkRateLimit: vi.fn() }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'fixture-only' }));
vi.mock('../src/utils/account_delete.js', async importOriginal => ({ ...await importOriginal<typeof import('../src/utils/account_delete.js')>(), deleteAccount: mocks.deleteAccount }));
import { AccountOwnsOrganizationError, AccountHasMembershipContractError } from '../src/utils/account_delete.js';
import { accountAuthRoutes } from '../src/routes/account_auth.js';

const app = new Hono().route('/v1', accountAuthRoutes);
const remove = (id = '1293', confirmUserId: unknown = id) => app.request(`/v1/auth/admin/users/${id}/delete`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmUserId }),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({ wcaId: '2017YANR02', isAdmin: true });
  mocks.requireAppUserId.mockResolvedValue(66);
  mocks.getUserById.mockResolvedValue({ id: 1293, wca_id: null });
  mocks.deleteAccount.mockResolvedValue(undefined);
});
it('denies unauthenticated, non-admin and ordinary admin requests before accessing the target', async () => {
  for (const status of [401, 403] as const) {
    mocks.requireAdmin.mockRejectedValueOnce(new HTTPException(status));
    expect((await remove()).status).toBe(status);
  }
  mocks.requireAdmin.mockResolvedValue({ wcaId: '2000TEST01', isAdmin: true });
  expect((await remove()).status).toBe(403);
  expect(mocks.getUserById).not.toHaveBeenCalled();
  expect(mocks.deleteAccount).not.toHaveBeenCalled();
});
it('rejects invalid IDs and missing, numeric or mismatched confirmations', async () => {
  for (const id of ['0', '-1', 'abc', '1.5', '9007199254740992']) expect((await remove(id)).status).toBe(400);
  for (const confirmation of [null, 1293, '', '1294']) expect((await remove('1293', confirmation)).status).toBe(400);
  expect(mocks.deleteAccount).not.toHaveBeenCalled();
});
it('protects the actor and root accounts and reports missing targets', async () => {
  expect((await remove('66')).status).toBe(409);
  mocks.getUserById.mockResolvedValueOnce({ id: 1293, wca_id: '2017YANR02' });
  expect((await remove()).status).toBe(409);
  mocks.getUserById.mockResolvedValueOnce(null);
  expect((await remove()).status).toBe(404);
  expect(mocks.deleteAccount).not.toHaveBeenCalled();
});
it('delegates ordinary users and administrators to the complete deletion flow with the original owner key', async () => {
  for (const wcaId of [null, '2000TEST01']) {
    mocks.getUserById.mockResolvedValue({ id: 1293, wca_id: wcaId, is_admin: true });
    const response = await remove();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.deleteAccount).toHaveBeenLastCalledWith(1293, wcaId || 'u1293');
  }
});
it('preserves organization and membership blockers and does not claim success after failure', async () => {
  for (const error of [new AccountOwnsOrganizationError(), new AccountHasMembershipContractError()]) {
    mocks.deleteAccount.mockRejectedValueOnce(error);
    const response = await remove();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: error.message });
  }
});
