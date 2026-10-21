// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe('algorithm library snapshots', () => {
  it('deduplicates first loads and immediately returns a cached snapshot during revalidation', async () => {
    const { readAlgLibrary, subscribeAlgLibrary } = await import('@/lib/alg-library-cache');
    const first = deferred<{ revision: number }>();
    const fetcher = vi.fn(() => first.promise);
    const a = readAlgLibrary('file:3x3/zbll', fetcher);
    const b = readAlgLibrary('file:3x3/zbll', fetcher);
    first.resolve({ revision: 1 });
    expect(await a).toEqual({ revision: 1 });
    expect(await b).toBe(await a);
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(6000);
    const next = deferred<{ revision: number }>();
    const changed = vi.fn();
    const unsubscribe = subscribeAlgLibrary('file:3x3/zbll', changed);
    expect(await readAlgLibrary('file:3x3/zbll', () => next.promise)).toEqual({ revision: 1 });
    const refreshed = readAlgLibrary('file:3x3/zbll', fetcher, true);
    next.resolve({ revision: 2 });
    await refreshed;
    expect(changed).toHaveBeenCalledTimes(1);
    expect(await readAlgLibrary('file:3x3/zbll', fetcher)).toEqual({ revision: 2 });
    unsubscribe();
  });

  it('restores a public snapshot on reload and keeps it when the network is unavailable', async () => {
    const first = await import('@/lib/alg-library-cache');
    await first.readAlgLibrary('file:3x3/oll', async () => ({ cases: [1] }));
    vi.resetModules();
    const reloaded = await import('@/lib/alg-library-cache');
    expect(await reloaded.readAlgLibrary('file:3x3/oll', async () => { throw new Error('offline'); })).toEqual({ cases: [1] });
  });

  it('invalidates edited sets and rejects stale in-flight cache writes', async () => {
    const { readAlgLibrary, invalidateAlgLibrary } = await import('@/lib/alg-library-cache');
    const old = deferred<{ revision: number }>();
    const staleRead = readAlgLibrary('file:3x3/zbll', () => old.promise);
    await Promise.resolve();
    invalidateAlgLibrary('3x3', 'zbll');
    expect(await readAlgLibrary('file:3x3/zbll', async () => ({ revision: 2 }))).toEqual({ revision: 2 });
    old.resolve({ revision: 1 });
    await staleRead;
    expect(await readAlgLibrary('file:3x3/zbll', async () => ({ revision: 3 }))).toEqual({ revision: 2 });
  });

  it('evicts only library snapshots when quota prevents persisting an invalidation', async () => {
    const { invalidateAlgLibrary } = await import('@/lib/alg-library-cache');
    localStorage.setItem('alg-library:v1:file:3x3/pll', JSON.stringify({ value: { cases: [] }, saved: 1 }));
    localStorage.setItem('timer-session', 'keep');
    const setItem = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    }).mockImplementation(setItem);
    try {
      invalidateAlgLibrary('3x3', 'zbll');
      expect(write).toHaveBeenCalledTimes(3);
      expect(localStorage.getItem('alg-library:v1:file:3x3/pll')).toBeNull();
      expect(localStorage.getItem('timer-session')).toBe('keep');
      expect(JSON.parse(localStorage.getItem('alg-library:v1:catalog:3x3')!)).toEqual({ invalidated: true, saved: Date.now() });
      expect(JSON.parse(localStorage.getItem('alg-library:v1:file:3x3/zbll')!)).toEqual({ invalidated: true, saved: Date.now() });
    } finally { write.mockRestore(); }
  });

  it('keeps identity and does not notify when the server data is unchanged', async () => {
    const { readAlgLibrary, subscribeAlgLibrary } = await import('@/lib/alg-library-cache');
    const first = await readAlgLibrary('file:3x3/pll', async () => ({ cases: [1] }));
    const changed = vi.fn();
    const unsubscribe = subscribeAlgLibrary('file:3x3/pll', changed);
    vi.advanceTimersByTime(6000);
    const next = await readAlgLibrary('file:3x3/pll', async () => ({ cases: [1] }), true);
    expect(next).toBe(first);
    expect(changed).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe('cold-start site snapshots', () => {
  it('paints the site snapshot while the live API is pending, then publishes the newer revision', async () => {
    const { readAlgLibrary, subscribeAlgLibrary } = await import('@/lib/alg-library-cache');
    const live = deferred<{ revision: number }>();
    const bootstrap = vi.fn(async () => ({ revision: 1 }));
    const changed = vi.fn();
    const unsubscribe = subscribeAlgLibrary('file:3x3/1lll', changed);
    const a = readAlgLibrary('file:3x3/1lll', () => live.promise, false, bootstrap);
    const b = readAlgLibrary('file:3x3/1lll', () => live.promise, false, bootstrap);
    expect(await a).toEqual({ revision: 1 });
    expect(await b).toBe(await a);
    expect(bootstrap).toHaveBeenCalledTimes(1);
    const refreshed = readAlgLibrary('file:3x3/1lll', () => live.promise, true);
    live.resolve({ revision: 2 });
    await refreshed;
    expect(changed).toHaveBeenCalledTimes(1);
    expect(await readAlgLibrary('file:3x3/1lll', () => live.promise)).toEqual({ revision: 2 });
    unsubscribe();
  });
  it('does not restore an older site snapshot after a successful edit, even after reload', async () => {
    const { invalidateAlgLibrary } = await import('@/lib/alg-library-cache');
    invalidateAlgLibrary('3x3', 'zbll');
    vi.resetModules();
    const { readAlgLibrary } = await import('@/lib/alg-library-cache');
    const bootstrap = vi.fn(async () => ({ revision: 1 }));
    expect(await readAlgLibrary('file:3x3/zbll', async () => ({ revision: 2 }), false, bootstrap)).toEqual({ revision: 2 });
    expect(bootstrap).not.toHaveBeenCalled();
  });
  it('does not persist CMLL provenance as lossy JSON', async () => {
    const { readAlgLibrary } = await import('@/lib/alg-library-cache');
    const value = { cases: [] };
    await readAlgLibrary('file:3x3/cmll', async () => value);
    expect(localStorage.getItem('alg-library:v1:file:3x3/cmll')).toBeNull();
    expect(await readAlgLibrary('file:3x3/cmll', async () => value)).toBe(value);
  });
});
