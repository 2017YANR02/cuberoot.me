import { afterEach, expect, it, vi } from 'vitest';
import { fetchCubingPrRanks } from '@/lib/wca-results-api';

vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => path }));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('refreshes corrected live ranks after 15 seconds and retries failed lookups immediately', async () => {
  vi.useFakeTimers();
  const data = { users: { '3': { wcaid: '2023LIUY04' } }, resultsByRound: { 'clock:f': [{ n: 3, b: 281, a: 369, pS: 2, pA: 3 }] } };
  const fetcher = vi.fn(async () => Response.json(data));
  vi.stubGlobal('fetch', fetcher);
  const read = (id = 'LiveCache2026') => fetchCubingPrRanks(id, 'clock', 'f', '2023LIUY04', 281, 369);
  expect(await read()).toEqual({ pS: 2, pA: 3 });
  data.resultsByRound['clock:f'][0].pS = 1;
  expect(await read()).toEqual({ pS: 2, pA: 3 });
  expect(fetcher).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(15_001);
  expect(await read()).toEqual({ pS: 1, pA: 3 });
  fetcher.mockRejectedValueOnce(new Error('offline'));
  expect(await read('FailedLive2026')).toBeNull();
  expect(await read('FailedLive2026')).toEqual({ pS: 1, pA: 3 });
  expect(fetcher).toHaveBeenCalledTimes(4);
});
