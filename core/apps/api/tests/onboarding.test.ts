import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/connection.js', () => db);
vi.mock('../src/utils/app_user_auth.js', () => ({
  requireAppUserId: async (c: { req: { header: (key: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'Bearer test-user') throw new HTTPException(401);
    return 42;
  },
}));
import { onboardingRoutes } from '../src/routes/onboarding.js';
const app = new Hono().route('/v1', onboardingRoutes);
beforeEach(() => db.query.mockReset());

it('rejects unauthenticated reads and writes before accessing data', async () => {
  for (const method of ['GET', 'PUT']) {
    expect((await app.request('/v1/auth/onboarding', { method })).status).toBe(401);
  }
  expect(db.query).not.toHaveBeenCalled();
});

it('reads only the authenticated account and never caches its status', async () => {
  db.query.mockResolvedValue([{ home_onboarding_seen: true }]);
  const response = await app.request('/v1/auth/onboarding?uid=99', {
    headers: { Authorization: 'Bearer test-user' },
  });
  expect(await response.json()).toEqual({ seen: true });
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(db.query.mock.calls[0][1]).toEqual([42]);
});

it('cannot reset status or mark a different account', async () => {
  db.query.mockResolvedValue([{ id: 42 }]);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await app.request('/v1/auth/onboarding', {
      method: 'PUT', headers: { Authorization: 'Bearer test-user', 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: 99, seen: false }),
    });
    expect(await response.json()).toEqual({ seen: true });
    expect(db.query.mock.calls[attempt][1]).toEqual([42]);
    expect(db.query.mock.calls[attempt][0]).toContain('home_onboarding_seen = TRUE');
  }
});
