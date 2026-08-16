import {
  clearRuntimeTimeout,
  scheduleRuntimeTimeout,
  type RuntimeTimer,
} from './runtime-timers';

export const PLATFORM_ACTION_LOCK_TIMEOUT_MS = 5_000;

export interface PlatformActionGuard {
  begin(owner: object): number | null;
  cancel(owner: object): void;
  settle(owner: object, attempt: number): boolean;
}

export function createPlatformActionGuard(
  lockTimeoutMs = PLATFORM_ACTION_LOCK_TIMEOUT_MS,
): PlatformActionGuard {
  const activeOwners = new WeakSet<object>();
  const attemptSequences = new WeakMap<object, number>();
  const currentAttempts = new WeakMap<object, number>();
  const timers = new WeakMap<object, RuntimeTimer>();

  function release(owner: object, attempt: number): void {
    if (currentAttempts.get(owner) !== attempt) return;
    activeOwners.delete(owner);
    const timer = timers.get(owner);
    timers.delete(owner);
    clearRuntimeTimeout(timer);
  }

  return {
    begin(owner: object): number | null {
      if (activeOwners.has(owner)) return null;
      const attempt = (attemptSequences.get(owner) ?? 0) + 1;
      attemptSequences.set(owner, attempt);
      currentAttempts.set(owner, attempt);
      activeOwners.add(owner);
      const timer = scheduleRuntimeTimeout(
        () => release(owner, attempt),
        lockTimeoutMs,
      );
      if (timer === null) {
        activeOwners.delete(owner);
        currentAttempts.delete(owner);
        return null;
      }
      timers.set(owner, timer);
      return attempt;
    },

    cancel(owner: object): void {
      const attempt = currentAttempts.get(owner);
      if (attempt === undefined) return;
      release(owner, attempt);
      currentAttempts.delete(owner);
    },

    settle(owner: object, attempt: number): boolean {
      if (currentAttempts.get(owner) !== attempt) return false;
      release(owner, attempt);
      currentAttempts.delete(owner);
      return true;
    },
  };
}
