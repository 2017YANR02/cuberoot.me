import { beforeEach, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';
const mocks = vi.hoisted(() => ({ query: vi.fn(), auth: vi.fn(), ids: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: mocks.auth, checkRateLimit: vi.fn() }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: () => '127.0.0.1' }));
vi.mock('../src/utils/account.js', () => ({ publicUserIdsForOwnerKeys: mocks.ids }));
import { smartCubeMacRoutes } from '../src/routes/smart_cube_macs';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ wcaId: 'u12' });
  mocks.ids.mockResolvedValue(new Map([['u12', 12]]));
  mocks.query.mockResolvedValue([]);
});

it('requires authentication before reading private addresses', async () => {
  mocks.auth.mockRejectedValue(new HTTPException(401));
  const response = await smartCubeMacRoutes.request('/smart-cube/macs');
  expect(response.status).toBe(401);
  expect(mocks.query).not.toHaveBeenCalled();
});

it('derives the account from the session and merges only the supplied devices', async () => {
  const response = await smartCubeMacRoutes.request('/smart-cube/macs', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 99, items: { GAN: 'aa:bb:cc:dd:ee:ff', Old: null } }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.query.mock.calls[0][1]).toEqual([
    12, { GAN: 'AA:BB:CC:DD:EE:FF', Old: null }, { GAN: 'AA:BB:CC:DD:EE:FF', Old: null },
  ]);
  expect(mocks.query.mock.calls[0][0]).toContain('smart_cube_macs.items ||');
});

it('rejects malformed addresses before writing', async () => {
  const response = await smartCubeMacRoutes.request('/smart-cube/macs', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: { GAN: 'invalid' } }),
  });
  expect(response.status).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
});
