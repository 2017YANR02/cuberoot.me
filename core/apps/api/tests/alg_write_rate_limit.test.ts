import { afterEach, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { checkRateLimit, RateLimitError } from '../src/utils/rate_limit.js';

const mocks = vi.hoisted(() => ({ query: vi.fn(), auth: vi.fn(), ip: 'alg-editor-network' }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query, withTransaction: vi.fn() }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: () => mocks.ip }));
vi.mock('../src/utils/recon_helpers.js', async () => ({
  requireAdminOrApiKey: mocks.auth,
  checkRateLimit: (await import('../src/utils/rate_limit.js')).checkRateLimit,
}));
vi.mock('../src/utils/alg_mirror.js', () => ({ syncMirrorAndLog: vi.fn(), syncMirrorForCase: vi.fn() }));
vi.mock('../src/utils/recon_revalidate.js', () => ({ revalidateContentPages: vi.fn() }));
import { algSetsRoutes } from '../src/routes/alg_sets.js';

afterEach(() => vi.useRealTimers());
function server() {
  return new Hono().route('/', algSetsRoutes).onError((error, c) =>
    c.json({ error: error.message }, error instanceof RateLimitError ? 429 : 500));
}
// An invalid id stops before DB work, after the real route's auth/quota checks.
const write = (app: ReturnType<typeof server>) => app.request('/alg/sets/3x3/pll/cases/invalid', { method: 'PUT' });

it('isolates authenticated formula maintenance from general writes and other editors', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  mocks.ip = 'alg-editor-network';
  const app = server();
  for (let i = 0; i < 30; i++) checkRateLimit(mocks.ip);
  mocks.auth.mockResolvedValue({ wcaId: 'editor-one' });
  for (let i = 0; i < 120; i++) expect((await write(app)).status).toBe(400);
  expect((await write(app)).status).toBe(429);
  mocks.auth.mockResolvedValue({ wcaId: 'editor-two' });
  expect((await write(app)).status).toBe(400);
  vi.setSystemTime(60_001);
  mocks.auth.mockResolvedValue({ wcaId: 'editor-one' });
  expect((await write(app)).status).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
});

it('still bounds unauthenticated attempts before authentication and never reaches the DB', async () => {
  vi.useFakeTimers(); vi.setSystemTime(120_000);
  mocks.ip = 'alg-unauthenticated-network';
  mocks.auth.mockClear();
  mocks.auth.mockRejectedValue(new HTTPException(401, { message: 'Unauthorized' }));
  const app = server();
  for (let i = 0; i < 600; i++) expect((await write(app)).status).toBe(401);
  expect((await write(app)).status).toBe(429);
  expect(mocks.auth).toHaveBeenCalledTimes(600);
  expect(mocks.query).not.toHaveBeenCalled();
});
