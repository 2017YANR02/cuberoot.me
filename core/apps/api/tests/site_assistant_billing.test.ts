import { describe, expect, it, vi } from 'vitest';
import { createDeepSeekBalanceReader, summarizeProviderCosts } from '../src/utils/site_assistant_billing.js';
import { createAdminAssistantRoutes } from '../src/routes/admin_assistant.js';
import { HTTPException } from 'hono/http-exception';

const response = { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '86.86', granted_balance: '0.00', topped_up_balance: '86.86' }] };
describe('assistant billing', () => {
  it('validates official balances, coalesces requests, expires cached values and never returns credentials', async () => {
    let now = 0;
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ ...response, private: 'secret' }));
    const read = createDeepSeekBalanceReader(fetcher, () => now);
    const values = await Promise.all([read('test-key'), read('test-key')]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(values[0]).toEqual({ status: 'ok', updatedAt: new Date(0).toISOString(), isAvailable: true, balances: response.balance_infos });
    expect(JSON.stringify(values)).not.toContain('secret');
    expect(JSON.stringify(values)).not.toContain('test-key');
    await read('test-key'); expect(fetcher).toHaveBeenCalledTimes(1);
    now = 60_001; await read('test-key'); expect(fetcher).toHaveBeenCalledTimes(2);
    await read('rotated-key'); expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('keeps missing configuration, provider failures and malformed data separate from zero balance', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ...response, is_available: false, balance_infos: [{ ...response.balance_infos[0], total_balance: '0.00', topped_up_balance: '0.00' }] }));
    expect(await createDeepSeekBalanceReader(fetcher)('')).toEqual({ status: 'unconfigured' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await createDeepSeekBalanceReader(fetcher)('key')).toMatchObject({ status: 'ok', isAvailable: false });
    for (const result of [new Response('private-provider-error', { status: 401 }), Response.json({ ...response, balance_infos: [] }), Response.json({ ...response, balance_infos: [{ ...response.balance_infos[0], total_balance: 'NaN' }] })]) {
      expect(await createDeepSeekBalanceReader(vi.fn().mockResolvedValue(result))('key')).toEqual({ status: 'unavailable' });
    }
    expect(await createDeepSeekBalanceReader(vi.fn().mockRejectedValue(new Error('key')))('key')).toEqual({ status: 'unavailable' });
  });
  it('splits providers and counts missing cache/usage instead of treating them as free', () => {
    const ds = { source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/', inputPerMillion: 2, outputPerMillion: 8, cachedInputPerMillion: .04 };
    const bailian = { source: 'https://help.aliyun.com/zh/model-studio/model-pricing' };
    expect(summarizeProviderCosts([
      { kind: 'models', calls: 2, call: { tariff: ds, input: 1e6, output: 1e6, cached: 800000, grossCny: 10, cacheAdjustedCny: { min: 4.216, max: 8.432 } } },
      { kind: 'models', calls: 1, call: { tariff: ds, input: 1e6, output: 1e6, cached: 800000 } },
      { kind: 'models', calls: 1, call: { tariff: ds, input: 1e6, output: 1e6, cached: null, grossCny: 10 } },
      { kind: 'embeddings', calls: 2, call: { tariff: bailian, grossCny: .5 } },
      { kind: 'models', calls: 1, call: { tariff: bailian, cacheAdjustedCny: { min: 2.94, max: 2.94 } } },
      { kind: 'models', calls: 3, call: { model: 'deepseek-flash', grossCny: 1 } },
    ])).toEqual([
      { provider: 'bailian', calls: 3, pricedCalls: 3, unpricedCalls: 0, minCny: 3.94, maxCny: 3.94 },
      { provider: 'deepseek', calls: 4, pricedCalls: 3, unpricedCalls: 1, minCny: 12.648, maxCny: 25.296 },
      { provider: 'unknown', calls: 3, pricedCalls: 0, unpricedCalls: 3, minCny: 0, maxCny: 0 },
    ]);
  });
  it('authorizes before querying the provider and validates periods', async () => {
    const balance = vi.fn(), runQuery = vi.fn();
    const denied = createAdminAssistantRoutes({ balance, runQuery, authorize: async () => { throw new HTTPException(403); } });
    expect((await denied.request('/admin/assistant/billing')).status).toBe(403);
    expect(balance).not.toHaveBeenCalled(); expect(runQuery).not.toHaveBeenCalled();
    const app = createAdminAssistantRoutes({ balance, runQuery, authorize: async () => {} });
    expect((await app.request('/admin/assistant/billing?days=365')).status).toBe(400);
    expect(balance).not.toHaveBeenCalled();
    balance.mockResolvedValue({ status: 'unavailable' }); runQuery.mockResolvedValue([]);
    const result = await app.request('/admin/assistant/billing?days=7');
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await result.json()).toMatchObject({ balance: { status: 'unavailable' }, providers: [] });
    expect(runQuery.mock.calls[0][1]).toEqual([7]);
  });
});
