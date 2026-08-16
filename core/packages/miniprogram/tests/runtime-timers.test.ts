import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearRuntimeTimeout,
  scheduleRuntimeTimeout,
  type RuntimeTimer,
} from '../src/lib/runtime-timers';

describe('runtime timers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('schedules and clears a normal timeout', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const timer = scheduleRuntimeTimeout(callback, 100);

    expect(timer).not.toBeNull();
    clearRuntimeTimeout(timer);
    vi.advanceTimersByTime(100);

    expect(callback).not.toHaveBeenCalled();
  });

  it('reports a synchronously fired timeout as unavailable', () => {
    const callback = vi.fn();
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((handler) => {
      if (typeof handler === 'function') handler();
      return 1 as unknown as RuntimeTimer;
    });

    expect(scheduleRuntimeTimeout(callback, 100)).toBeNull();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('reports timer creation failures without running the callback', () => {
    const callback = vi.fn();
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
      throw new Error('timer unavailable');
    });

    expect(scheduleRuntimeTimeout(callback, 100)).toBeNull();
    expect(callback).not.toHaveBeenCalled();
  });

  it('ignores missing timers and timer cleanup failures', () => {
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(() => {
      throw new Error('timer cleanup unavailable');
    });

    expect(() => clearRuntimeTimeout(undefined)).not.toThrow();
    expect(() => clearRuntimeTimeout(null)).not.toThrow();
    expect(() => clearRuntimeTimeout(1 as unknown as RuntimeTimer)).not.toThrow();
  });
});
