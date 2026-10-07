import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

it('shares reads, switches both ways after five seconds and protects on control failure', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn().mockResolvedValue(Response.json({ enabled: 0 }));
  vi.stubGlobal('fetch', fetcher);
  const { trafficDefenseEnabled } = await import('@/lib/traffic-defense');
  expect(await Promise.all([trafficDefenseEnabled(), trafficDefenseEnabled()])).toEqual([false, false]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(5001);
  fetcher.mockResolvedValue(Response.json({ enabled: 1 }));
  expect(await trafficDefenseEnabled()).toBe(true);
  await vi.advanceTimersByTimeAsync(5001);
  fetcher.mockRejectedValue(new Error('offline'));
  expect(await trafficDefenseEnabled()).toBe(true);
});
