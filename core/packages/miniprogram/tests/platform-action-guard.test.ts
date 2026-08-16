import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPlatformActionGuard } from '../src/lib/platform-action-guard';

describe('platform action guard', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('allows only one active action per owner', () => {
    const guard = createPlatformActionGuard();
    const owner = {};
    const attempt = guard.begin(owner);

    expect(attempt).toBe(1);
    expect(guard.begin(owner)).toBeNull();
    expect(guard.settle(owner, attempt!)).toBe(true);
    expect(guard.begin(owner)).toBe(2);
  });

  it('releases an action when the platform swallows every callback', () => {
    vi.useFakeTimers();
    const guard = createPlatformActionGuard(5_000);
    const owner = {};

    expect(guard.begin(owner)).toBe(1);
    vi.advanceTimersByTime(5_000);

    expect(guard.begin(owner)).toBe(2);
  });

  it('does not let a stale callback settle a newer action', () => {
    vi.useFakeTimers();
    const guard = createPlatformActionGuard(100);
    const owner = {};
    const first = guard.begin(owner)!;
    vi.advanceTimersByTime(100);
    const second = guard.begin(owner)!;

    expect(guard.settle(owner, first)).toBe(false);
    expect(guard.begin(owner)).toBeNull();
    expect(guard.settle(owner, second)).toBe(true);
  });

  it('cancels an active action when its owner leaves', () => {
    const guard = createPlatformActionGuard();
    const owner = {};

    expect(guard.begin(owner)).toBe(1);
    guard.cancel(owner);

    expect(guard.begin(owner)).toBe(2);
  });

  it('does not start an action without a recovery timer', () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
      throw new Error('timer unavailable');
    });
    const guard = createPlatformActionGuard();
    const owner = {};

    expect(guard.begin(owner)).toBeNull();
  });
});
