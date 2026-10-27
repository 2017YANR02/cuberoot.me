// Official CNY list-price snapshots checked on 2026-10-15; rerank on 2026-10-26.
// Full input and peak price intentionally ignore discounts: a conservative gross estimate, never an invoice.
export const ASSISTANT_PRICE_SOURCE = 'https://help.aliyun.com/zh/model-studio/model-pricing';
export function assistantPrice(model: string, origin: string, input: number | null, output: number | null = 0, cached: number | null = null) {
  const beijing = origin === 'https://dashscope.aliyuncs.com' || /^https:\/\/ws-[a-z0-9]+\.cn-beijing\.maas\.aliyuncs\.com$/.test(origin);
  const deepseek = origin === 'https://api.deepseek.com';
  const rates = beijing ? ({ 'qwen3.8-flash': [0.8, 2.7], 'text-embedding-v4': [0.5, 0], 'qwen3-rerank': [0.5, 0] } as Record<string, number[]>)[model]
    : deepseek ? ({ 'deepseek-flash': [2, 8], 'deepseek-v4-flash': [2, 8], 'deepseek-v4-flash-vision-exp': [2, 8], 'deepseek-v4-pro': [9, 27] } as Record<string, number[]>)[model] : undefined;
  const grossCny = rates && input != null && output != null ? (input * rates[0] + output * rates[1]) / 1_000_000 : null;
  const cacheRate=deepseek && rates ? (model==='deepseek-v4-pro'?.3:.04) : beijing && model==='qwen3.8-flash'?.1:undefined;
  const validCache=cached!=null && Number.isSafeInteger(cached) && cached>=0 && input!=null && cached<=input;
  const adjusted=grossCny!=null && rates && input!=null && output!=null && (cacheRate==null || validCache)
    ? ((input-(cacheRate==null?0:cached!))*rates[0]+(cacheRate==null?0:cached!*cacheRate)+output*rates[1])/1e6:null;
  // A range avoids guessing China's holiday calendar or claiming an invoice.
  const cacheAdjustedCny=adjusted==null?null:{min:deepseek?adjusted*.5:adjusted,max:adjusted};
  return { grossCny, cacheAdjustedCny, tariff: rates ? { version: deepseek ? 'deepseek-cny-peak-2026-10-15' : model === 'qwen3-rerank' ? 'bailian-rerank-beijing-2026-10-26' : 'bailian-beijing-2026-10-15', inputPerMillion: rates[0], outputPerMillion: rates[1], ...(cacheRate==null?{}:{cachedInputPerMillion:cacheRate,cacheVersion:'cache-adjusted-range-2026-10-26'}), source: deepseek ? 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/' : ASSISTANT_PRICE_SOURCE } : null };
}
