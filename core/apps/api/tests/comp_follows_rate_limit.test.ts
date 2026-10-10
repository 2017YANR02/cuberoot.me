import { afterEach, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { checkRateLimit, RateLimitError } from '../src/utils/rate_limit.js';

const mocks = vi.hoisted(() => ({ query: vi.fn(async () => []), requireAuth: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: () => 'follow-network' }));
vi.mock('../src/utils/recon_helpers.js', async () => ({
  checkRateLimit: (await import('../src/utils/rate_limit.js')).checkRateLimit,
  requireAuth: mocks.requireAuth,
}));
import { compFollowsRoutes } from '../src/routes/comp_follows.js';
afterEach(() => vi.useRealTimers());

it('isolates homepage reads from writes and other accounts on the same network', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const app = new Hono().route('/', compFollowsRoutes).onError((e, c) => c.json({}, e instanceof RateLimitError ? 429 : 500));
  for (let i = 0; i < 30; i++) checkRateLimit('follow-network');
  mocks.requireAuth.mockResolvedValue({ wcaId: 'u1' });
  for (let i = 0; i < 120; i++) expect((await app.request('/comp/follows')).status).toBe(200);
  expect((await app.request('/comp/follows')).status).toBe(429);
  mocks.requireAuth.mockResolvedValue({ wcaId: 'u2' });
  expect((await app.request('/comp/follows')).status).toBe(200);
  expect(mocks.query).toHaveBeenLastCalledWith(expect.any(String), ['u2']);
  expect((await app.request('/comp/follows/Test2026', { method: 'PUT' })).status).toBe(429);
  expect(mocks.query).toHaveBeenCalledTimes(121);
});
