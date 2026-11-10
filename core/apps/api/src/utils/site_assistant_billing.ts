import { z } from 'zod';

const money = z.string().regex(/^\d+(?:\.\d+)?$/);
const balanceSchema = z.object({
  is_available: z.boolean(),
  balance_infos: z.array(z.object({
    currency: z.enum(['CNY', 'USD']), total_balance: money,
    granted_balance: money, topped_up_balance: money,
  })).min(1),
});
export type DeepSeekBalance =
  | { status: 'ok'; updatedAt: string; isAvailable: boolean; balances: z.infer<typeof balanceSchema>['balance_infos'] }
  | { status: 'unconfigured' | 'unavailable' };

/** Key stays server-side; only validated balance fields cross the admin API. */
export function createDeepSeekBalanceReader(fetcher: typeof fetch = fetch, now = Date.now) {
  let cached: { key: string; expires: number; value: DeepSeekBalance } | undefined;
  let pending: { key: string; promise: Promise<DeepSeekBalance> } | undefined;
  return async (key = process.env.DEEPSEEK_API_KEY): Promise<DeepSeekBalance> => {
    if (!key) return { status: 'unconfigured' };
    if (cached?.key === key && cached.expires > now()) return cached.value;
    if (pending?.key === key) return pending.promise;
    const promise = (async (): Promise<DeepSeekBalance> => {
      let value: DeepSeekBalance;
      try {
        const response = await fetcher('https://api.deepseek.com/user/balance', {
          headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000), redirect: 'error',
        });
        if (!response.ok) throw new Error('Balance unavailable');
        const data = balanceSchema.parse(await response.json());
        value = { status: 'ok', updatedAt: new Date(now()).toISOString(), isAvailable: data.is_available, balances: data.balance_infos };
      } catch { value = { status: 'unavailable' }; }
      cached = { key, value, expires: now() + (value.status === 'ok' ? 60_000 : 15_000) };
      return value;
    })();
    pending = { key, promise };
    try { return await promise; } finally { if (pending?.promise === promise) pending = undefined; }
  };
}
export const readDeepSeekBalance = createDeepSeekBalanceReader();

type Provider = 'deepseek' | 'bailian' | 'unknown';
export interface BillingCallGroup { kind: string; call: Record<string, unknown>; calls: number }
export interface ProviderCost { provider: Provider; calls: number; pricedCalls: number; unpricedCalls: number; minCny: number; maxCny: number }
const amount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' ? v as Record<string, unknown> : {};

/** Use the saved tariff snapshot, never reprice old calls at today's rates. */
export function summarizeProviderCosts(groups: BillingCallGroup[]): ProviderCost[] {
  const costs = new Map<Provider, ProviderCost>();
  for (const { kind, call, calls } of groups) {
    const tariff = object(call.tariff);
    const source = typeof tariff.source === 'string' ? tariff.source : '';
    const provider: Provider = source.startsWith('https://api-docs.deepseek.com/') ? 'deepseek'
      : source.startsWith('https://help.aliyun.com/') ? 'bailian' : 'unknown';
    const row = costs.get(provider) ?? { provider, calls: 0, pricedCalls: 0, unpricedCalls: 0, minCny: 0, maxCny: 0 };
    row.calls += calls;
    let min: number | null = null, max: number | null = null;
    const saved = object(call.cacheAdjustedCny);
    if (provider !== 'unknown' && amount(saved.min) && amount(saved.max) && saved.min <= saved.max) {
      min = saved.min; max = saved.max;
    } else if (kind === 'models') {
      // Old snapshots without cache prices cannot establish a discounted estimate.
      const { input, output, cached } = call;
      if (provider !== 'unknown' && amount(input) && amount(output) && amount(cached) && cached <= input
        && amount(tariff.inputPerMillion) && amount(tariff.outputPerMillion)
        && (cached === 0 || amount(tariff.cachedInputPerMillion))) {
        max = ((input - cached) * tariff.inputPerMillion + cached * (Number(tariff.cachedInputPerMillion) || 0) + output * tariff.outputPerMillion) / 1e6;
        min = provider === 'deepseek' ? max / 2 : max;
      }
    } else if (provider !== 'unknown' && amount(call.grossCny)) {
      min = max = call.grossCny;
    }
    if (min == null || max == null) row.unpricedCalls += calls;
    else { row.pricedCalls += calls; row.minCny += min * calls; row.maxCny += max * calls; }
    costs.set(provider, row);
  }
  return [...costs.values()].sort((a, b) => a.provider.localeCompare(b.provider));
}
