import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _resetOptimal333Pool,
  awaitOptimal333,
  canUseRandomOptimal333,
  peekOptimal333,
  prefetchOptimal333,
  retryOptimal333,
  shouldUseRandomOptimal333,
  type Optimal333Source,
} from '@/app/[lang]/timer/_lib/scramble/optimal333_pool';

beforeEach(() => _resetOptimal333Pool());
afterEach(() => _resetOptimal333Pool());

describe('timer optimal 3x3 pool', () => {
  it('enables only authenticated, unseeded 3x3 random-state generation', () => {
    expect(canUseRandomOptimal333('333', 'random', true, null)).toBe(true);
    expect(canUseRandomOptimal333('444', 'random', true, null)).toBe(false);
    expect(canUseRandomOptimal333('333', 'wca', true, null)).toBe(false);
    expect(canUseRandomOptimal333('333', 'random', false, null)).toBe(false);
    expect(canUseRandomOptimal333('333', 'random', true, 'shared-seed')).toBe(false);
    expect(shouldUseRandomOptimal333(false, '333', 'random', true, null)).toBe(false);
    expect(shouldUseRandomOptimal333(true, '333', 'random', true, null)).toBe(true);
  });

  it('serves the first result, then keeps three future scrambles buffered', async () => {
    let n = 0;
    const optimize = vi.fn(async (base: string) => `optimal-${base}`);
    const source: Optimal333Source = {
      key: 'owner|normal',
      generateBase: () => `base-${n++}`,
      optimize,
    };

    prefetchOptimal333(source);
    expect(await awaitOptimal333(source)).toBe('ready');
    expect(peekOptimal333(source)).toBe('optimal-base-0');

    await vi.waitFor(() => expect(optimize).toHaveBeenCalledTimes(4));
    expect(peekOptimal333(source)).toBe('optimal-base-1');
    expect(peekOptimal333(source)).toBe('optimal-base-2');
    expect(peekOptimal333(source)).toBe('optimal-base-3');
  });

  it('never runs more than one cloud solve at a time', async () => {
    let n = 0;
    let active = 0;
    let maxActive = 0;
    const source: Optimal333Source = {
      key: 'owner|serial',
      generateBase: () => `base-${n++}`,
      optimize: async (base) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return `optimal-${base}`;
      },
    };

    prefetchOptimal333(source);
    await vi.waitFor(() => expect(n).toBe(3));
    expect(maxActive).toBe(1);
  });

  it('aborts stale work when the generation context changes', async () => {
    let staleStarted = false;
    let staleAborted = false;
    const stale: Optimal333Source = {
      key: 'owner|old',
      generateBase: () => 'old-base',
      optimize: (_base, signal) => new Promise((_resolve, reject) => {
        staleStarted = true;
        signal.addEventListener('abort', () => {
          staleAborted = true;
          reject(new Error('aborted'));
        }, { once: true });
      }),
    };
    const fresh: Optimal333Source = {
      key: 'owner|new',
      generateBase: () => 'new-base',
      optimize: async () => 'new-optimal',
    };

    prefetchOptimal333(stale);
    await vi.waitFor(() => expect(staleStarted).toBe(true));
    prefetchOptimal333(fresh);
    expect(await awaitOptimal333(fresh)).toBe('ready');
    expect(staleAborted).toBe(true);
    expect(peekOptimal333(fresh)).toBe('new-optimal');
  });

  it('latches failures until the explicit retry action', async () => {
    let fail = true;
    const optimize = vi.fn(async () => {
      if (fail) throw new Error('offline');
      return 'optimal';
    });
    const source: Optimal333Source = {
      key: 'owner|retry',
      generateBase: () => 'base',
      optimize,
    };

    prefetchOptimal333(source);
    expect(await awaitOptimal333(source)).toBe('error');
    expect(optimize).toHaveBeenCalledTimes(1);

    fail = false;
    retryOptimal333(source);
    expect(await awaitOptimal333(source)).toBe('ready');
    expect(peekOptimal333(source)).toBe('optimal');
  });
});
