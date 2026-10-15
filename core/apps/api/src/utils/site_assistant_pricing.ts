// Snapshot checked against the Beijing public list price on 2026-10-15.
// Full input price intentionally ignores cache/free-tier/contract discounts: a gross estimate, never an invoice.
export const ASSISTANT_PRICE_SOURCE = 'https://help.aliyun.com/zh/model-studio/model-pricing';
export function assistantPrice(model: string, origin: string, input: number | null, output: number | null = 0) {
  const beijing = origin === 'https://dashscope.aliyuncs.com' || /^https:\/\/ws-[a-z0-9]+\.cn-beijing\.maas\.aliyuncs\.com$/.test(origin);
  const rates = beijing ? ({ 'qwen3.8-flash': [0.8, 2.7], 'text-embedding-v4': [0.5, 0] } as Record<string, number[]>)[model] : undefined;
  const grossCny = rates && input != null && output != null ? (input * rates[0] + output * rates[1]) / 1_000_000 : null;
  return { grossCny, tariff: rates ? { version: 'bailian-beijing-2026-10-15', inputPerMillion: rates[0], outputPerMillion: rates[1], source: ASSISTANT_PRICE_SOURCE } : null };
}
