import { HTTPException } from 'hono/http-exception';
import { beforeEach, expect, it, vi } from 'vitest';
import { ADMIN_WCA_IDS } from '@cuberoot/shared/admin';

const mocks = vi.hoisted(() => ({ query: vi.fn(), requireAdmin: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query, sql: {} }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAdmin: mocks.requireAdmin, checkRateLimit: vi.fn() }));
vi.mock('../src/utils/session.js', () => ({ JWT_SECRET: 'fixture-only' }));
import { accountAuthRoutes } from '../src/routes/account_auth.js';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({ wcaId: ADMIN_WCA_IDS[0] });
  mocks.query.mockImplementation(async (sql: string) => sql.includes('SELECT id, display_name, wca_id, is_admin FROM app_users') ? [
    { id: '1', display_name: 'Root', wca_id: ADMIN_WCA_IDS[0], is_admin: false },
    { id: '42', display_name: 'Admin', wca_id: null, is_admin: true },
  ] : []);
});

it('returns all administrator identities independently of user search and pagination', async () => {
  const response = await accountAuthRoutes.request('/auth/admin/users?v=2&q=unrelated&provider=email&page=2&pageSize=1');
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ users: [], administrators: [
    { id: 1, displayName: 'Root', wcaId: ADMIN_WCA_IDS[0], isAdmin: true, isRootAdmin: true },
    { id: 42, displayName: 'Admin', wcaId: null, isAdmin: true, isRootAdmin: false },
  ] });
  const [sql, params] = mocks.query.mock.calls.find(([sql]) => sql.includes('SELECT id, display_name, wca_id, is_admin FROM app_users'))!;
  expect(sql).toContain('merged_into_user_id IS NULL');
  expect(sql).toContain('is_admin = TRUE OR wca_id = ANY(?::text[])');
  expect(sql).not.toMatch(/LIMIT|OFFSET|ILIKE/);
  expect(params).toEqual([ADMIN_WCA_IDS, ADMIN_WCA_IDS]);
});

it('does not query users before administrator authorization', async () => {
  mocks.requireAdmin.mockRejectedValue(new HTTPException(403));
  expect((await accountAuthRoutes.request('/auth/admin/users?v=2')).status).toBe(403);
  expect(mocks.query).not.toHaveBeenCalled();
});
