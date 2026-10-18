import { afterEach, expect, it, vi } from 'vitest';
import type { AlgFile } from '@cuberoot/shared/alg';
import { createReconstructionLibraryCache } from '@cuberoot/timer-ui/reconstruct/library-cache';

const file = { puzzle: '3x3', set: 'pll', cases: [] } as unknown as AlgFile;
afterEach(() => vi.useRealTimers());

it('deduplicates concurrent and consecutive solves, then refreshes after five minutes', async () => {
  let now = 1;
  const fetch = vi.fn(async () => file);
  const cache = createReconstructionLibraryCache(fetch, undefined, () => now);
  const first = cache.load('pll');
  expect(cache.load('pll')).toBe(first);
  expect(await first).toBe(file);
  expect(await cache.load('pll')).toBe(file);
  expect(fetch).toHaveBeenCalledTimes(1);
  now += 300_000;
  await cache.load('pll');
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('reuses persistent public data after worker restart without extending its expiry', async () => {
  let now = 1;
  const entries = new Map<string, Response>();
  const storage = { open: async () => ({
    match: async (key: string) => entries.get(key)?.clone(),
    put: async (key: string, response: Response) => { entries.set(key, response); },
  }) } as unknown as CacheStorage;
  const fetch = vi.fn(async () => file);
  await createReconstructionLibraryCache(fetch, storage, () => now).load('pll');
  now += 100_000;
  const restarted = createReconstructionLibraryCache(fetch, storage, () => now);
  expect(await restarted.load('pll')).toEqual(file);
  expect(fetch).toHaveBeenCalledTimes(1);
  now += 200_000;
  await restarted.load('pll');
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('retries failed or timed-out fetches and tolerates unavailable browser storage', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn<() => Promise<AlgFile>>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValue(file);
  const storage = { open: async () => { throw new Error('denied'); } } as unknown as CacheStorage;
  const cache = createReconstructionLibraryCache(fetch, storage);
  await expect(cache.load('pll')).rejects.toThrow('offline');
  const timeout = expect(cache.load('pll')).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(15_000);
  await timeout;
  expect(await cache.load('pll')).toBe(file);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it('preloads at most two libraries concurrently and shares them with report requests', async () => {
  let active = 0, peak = 0;
  const releases: (() => void)[] = [];
  const fetch = vi.fn(async () => {
    active++; peak = Math.max(peak, active);
    await new Promise<void>(resolve => releases.push(resolve));
    active--;
    return file;
  });
  const cache = createReconstructionLibraryCache(fetch);
  const warm = cache.warm();
  const report = cache.load('f2l');
  await vi.waitFor(() => {
    for (const release of releases.splice(0)) release();
    expect(fetch).toHaveBeenCalledTimes(5);
  });
  await warm;
  expect(await report).toBe(file);
  expect(active).toBe(0);
  expect(peak).toBe(2);
  expect(fetch).toHaveBeenCalledTimes(5);
});
