import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTPException } from 'hono/http-exception';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAdmin: (c: { req: { header: (name: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'Bearer test-admin') throw new HTTPException(403);
  },
  requireAuth: vi.fn(), checkRateLimit: vi.fn(),
}));
vi.mock('../src/utils/membership.js', () => ({ hasActiveMembership: vi.fn() }));
import { membershipRoutes } from '../src/routes/membership.js';

const update = (slug: string, body: unknown, admin = true) => membershipRoutes.request(`/membership/admin/plans/${slug}`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: 'Bearer test-admin' } : {}) },
  body: JSON.stringify(body),
});

describe('auto-renewal activation safety', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue([{ slug: 'monthly', name_zh: '月度', name_en: 'Monthly', price_cents: 2999, period: 'month', period_count: 1, perks: [], active: false }]);
  });
  it.each(['monthly_auto_renew', 'yearly_auto_renew'])('blocks activation of %s before any database write', async (slug) => {
    const response = await update(slug, { active: true, priceCents: 100 });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'automatic renewal is not available' });
    expect(query).not.toHaveBeenCalled();
  });
  it.each(['false', 'true', 1, 0, {}])('rejects non-boolean active %j', async (active) => {
    expect((await update('monthly', { active })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  it.each(['monthly_auto_renew', 'yearly_auto_renew'])('still permits hiding and pricing %s', async (slug) => {
    expect((await update(slug, { active: false })).status).toBe(200);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('active = ?'), [false, slug]);
    expect((await update(slug, { priceCents: 2999 })).status).toBe(200);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('price_cents = ?'), [2999, slug]);
  });
  it('preserves one-time activation and admin authorization', async () => {
    expect((await update('monthly', { active: true })).status).toBe(200);
    expect(query).toHaveBeenCalledTimes(1);
    expect((await update('monthly', { active: false }, false)).status).toBe(403);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
