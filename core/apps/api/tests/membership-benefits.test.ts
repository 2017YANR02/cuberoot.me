import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { benefitCopy, DEFAULT_MEMBERSHIP_BENEFITS, validateMembershipBenefits } from '@cuberoot/shared/membership-benefits';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query }));
import { membershipBenefitsRoutes } from '../src/routes/membership_benefits.js';

const app = new Hono().route('/v1', membershipBenefitsRoutes);
app.onError((error, c) => c.json({ error: error.message }, 403));
const key = 'membership-benefits-test-key';
const item = DEFAULT_MEMBERSHIP_BENEFITS[0];
function save(body: unknown, admin = true) {
  return app.request('/v1/membership/admin/benefits', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...(admin ? { 'X-Admin-Key': key } : {}) }, body: JSON.stringify(body),
  });
}
beforeEach(() => { query.mockReset(); vi.stubEnv('ADMIN_API_KEY', key); });
afterEach(() => vi.unstubAllEnvs());

describe('membership benefit publishing', () => {
  it('rejects unauthenticated writes before database access', async () => {
    const response = await save({ revision: 1, items: [item] }, false);
    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects blank Chinese and duplicate identifiers while allowing empty English', async () => {
    expect(validateMembershipBenefits([{ ...item, en: '' }])).toEqual([{ ...item, en: '' }]);
    expect(benefitCopy({ ...item, en: ' ' }).en).toBe(item.zh);
    expect((await save({ revision: 1, items: [{ ...item, zh: ' ' }] })).status).toBe(400);
    expect((await save({ revision: 1, items: [item, item] })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  it('invalidates stale English when Chinese changes and keeps order and visibility', async () => {
    const edited = { ...item, zh: '更新后的中文', enabled: false };
    query.mockResolvedValueOnce([{ revision: 2, items: [item] }]).mockResolvedValueOnce([{ revision: 3, items: [{ ...edited, en: '' }] }]);
    const response = await save({ revision: 2, items: [edited] });
    expect(response.status).toBe(200);
    expect(query.mock.calls[1][1]).toEqual([[{ ...edited, en: '' }], 2]);
    expect(await response.json()).toEqual({ revision: 3, items: [{ ...edited, en: '' }] });
  });
  it('rejects both stale editors and a concurrent write after reading', async () => {
    query.mockResolvedValueOnce([{ revision: 4, items: [item] }]);
    expect((await save({ revision: 3, items: [item] })).status).toBe(409);
    expect(query).toHaveBeenCalledTimes(1);
    query.mockResolvedValueOnce([{ revision: 4, items: [item] }]).mockResolvedValueOnce([]);
    expect((await save({ revision: 4, items: [item] })).status).toBe(409);
  });
  it('serves the stored catalog without stale browser caching', async () => {
    query.mockResolvedValueOnce([{ revision: 8, items: [{ ...item, en: '' }] }]);
    const response = await app.request('/v1/membership/benefits');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ revision: 8, items: [{ ...item, en: '' }] });
  });
});
