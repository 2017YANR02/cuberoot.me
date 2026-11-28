import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

it('expires competition-only protection even inside the status cache window', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_800_000_000_000);
  const fetcher = vi.fn().mockResolvedValue(Response.json({ enabled: 0, competitionOnlyUntil: 1_800_000_002 }));
  vi.stubGlobal('fetch', fetcher);
  const { trafficDefenseEnabled, competitionOnlyVerificationEnabled } = await import('@/lib/traffic-defense');
  expect(await competitionOnlyVerificationEnabled()).toBe(true);
  expect(await trafficDefenseEnabled()).toBe(false);
  await vi.advanceTimersByTimeAsync(2000);
  expect(await competitionOnlyVerificationEnabled()).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('shares reads and switches both ways after five seconds', async () => {
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
  fetcher.mockResolvedValue(Response.json({ enabled: 0 }));
  expect(await trafficDefenseEnabled()).toBe(false);
});

it.each(['offline', 'http-error', 'invalid-json', 'missing-mode', 'null-mode'])(
  'keeps public access open on %s, including cold starts and recovery from protected mode', async (failure) => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementation(async () => {
      if (failure === 'offline') throw new Error('offline');
      if (failure === 'http-error') return new Response(null, { status: 503 });
      if (failure === 'invalid-json') return new Response('not json');
      return Response.json(failure === 'null-mode' ? null : {});
    });
    vi.stubGlobal('fetch', fetcher);
    const { trafficDefenseEnabled, competitionVerificationOpen } = await import('@/lib/traffic-defense');
    expect(await trafficDefenseEnabled()).toBe(false);
    expect(await competitionVerificationOpen()).toBe(false);
    await vi.advanceTimersByTimeAsync(5001);
    fetcher.mockResolvedValueOnce(Response.json({ enabled: 1 }));
    expect(await trafficDefenseEnabled()).toBe(true);
    await vi.advanceTimersByTimeAsync(5001);
    expect(await trafficDefenseEnabled()).toBe(false);
    await vi.advanceTimersByTimeAsync(5001);
    fetcher.mockResolvedValueOnce(Response.json({ enabled: 0 }));
    expect(await trafficDefenseEnabled()).toBe(false);
    expect(await competitionVerificationOpen()).toBe(true);
  },
);
