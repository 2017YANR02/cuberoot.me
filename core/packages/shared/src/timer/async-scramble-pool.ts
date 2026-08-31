/**
 * Runtime-neutral async→sync scramble buffer used by timer hosts.
 *
 * Web Workers, native workers, and test fakes only provide `generate(key,
 * signal)`. Queue depth, per-key isolation, in-flight accounting, timeout,
 * cancellation, and the timer's empty-string loading convention live here so
 * every host follows one policy.
 */

export interface TimerAsyncScramblePoolOptions<Key> {
  generate: (key: Key, signal: AbortSignal) => Promise<string>;
  targetSize?: number;
  requestTimeoutMs?: number;
  describeKey?: (key: Key) => string;
  onError?: (error: Error, key: Key) => void;
}

export interface TimerAsyncScramblePool<Key> {
  /** Ready value or '' while the async transport fills this key. */
  take(key: Key): string;
  /** Fill this key up to the shared target without consuming a value. */
  prefetch(key: Key): void;
  /**
   * Ready value, or one awaited transport result; failures resolve to ''.
   * Aborting removes this consumer immediately, so it cannot swallow a later
   * same-key result that belongs to the current timer slot.
   */
  next(key: Key, signal?: AbortSignal): Promise<string>;
  /** Abort current work and clear every key while keeping the pool reusable. */
  reset(): void;
  /** Abort current work and permanently disable the pool. */
  dispose(): void;
}

const DEFAULT_TARGET_SIZE = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

class PoolResetError extends Error {
  constructor() {
    super('timer async scramble pool reset');
    this.name = 'PoolResetError';
  }
}

export function createTimerAsyncScramblePool<Key>(
  options: TimerAsyncScramblePoolOptions<Key>,
): TimerAsyncScramblePool<Key> {
  const targetSize = options.targetSize ?? DEFAULT_TARGET_SIZE;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  if (!Number.isInteger(targetSize) || targetSize < 1) {
    throw new Error('timer async scramble pool targetSize must be a positive integer');
  }
  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error('timer async scramble pool requestTimeoutMs must be positive');
  }

  const queues = new Map<Key, string[]>();
  const inFlight = new Map<Key, number>();
  interface Waiter {
    resolve: (scramble: string) => void;
    signal?: AbortSignal;
    onAbort?: () => void;
  }
  const waiters = new Map<Key, Waiter[]>();
  const controllers = new Set<AbortController>();
  let epoch = 0;
  let disposed = false;

  const keyLabel = (key: Key): string => options.describeKey?.(key) ?? String(key);
  const queueOf = (key: Key): string[] => {
    let queue = queues.get(key);
    if (!queue) {
      queue = [];
      queues.set(key, queue);
    }
    return queue;
  };
  const report = (error: unknown, key: Key): void => {
    const normalized = error instanceof Error ? error : new Error(String(error));
    if (!(normalized instanceof PoolResetError)) options.onError?.(normalized, key);
  };
  const settleWaiter = (waiter: Waiter, scramble: string): void => {
    if (waiter.signal && waiter.onAbort) {
      waiter.signal.removeEventListener('abort', waiter.onAbort);
    }
    waiter.resolve(scramble);
  };
  const deliver = (key: Key, scramble: string): void => {
    const waiting = waiters.get(key);
    const waiter = waiting?.shift();
    if (waiting?.length === 0) waiters.delete(key);
    if (waiter) settleWaiter(waiter, scramble);
    else queueOf(key).push(scramble);
  };
  const settleStrandedWaiters = (key: Key): void => {
    if ((inFlight.get(key) ?? 0) > 0 || queueOf(key).length > 0) return;
    const waiting = waiters.get(key);
    waiters.delete(key);
    for (const waiter of waiting ?? []) settleWaiter(waiter, '');
  };

  const request = (key: Key): Promise<string> => {
    if (disposed) return Promise.reject(new PoolResetError());
    const controller = new AbortController();
    controllers.add(controller);
    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', onAbort);
        controllers.delete(controller);
        callback();
      };
      const onAbort = (): void => finish(() => reject(new PoolResetError()));
      const timer = setTimeout(() => {
        finish(() => reject(new Error(
          `timer async scramble request timed out: ${keyLabel(key)}`,
        )));
        controller.abort();
      }, requestTimeoutMs);
      controller.signal.addEventListener('abort', onAbort, { once: true });
      let generated: Promise<string>;
      try {
        generated = options.generate(key, controller.signal);
      } catch (error: unknown) {
        finish(() => reject(error instanceof Error ? error : new Error(String(error))));
        return;
      }
      Promise.resolve(generated).then(
        (value) => finish(() => {
          const scramble = value.trim();
          if (scramble) resolve(scramble);
          else reject(new Error(`timer async scramble provider returned empty: ${keyLabel(key)}`));
        }),
        (error: unknown) => finish(() => reject(
          error instanceof Error ? error : new Error(String(error)),
        )),
      );
    });
  };

  const topUp = (key: Key): void => {
    if (disposed) return;
    const queue = queueOf(key);
    const want = targetSize - queue.length - (inFlight.get(key) ?? 0);
    const requestEpoch = epoch;
    for (let i = 0; i < want; i++) {
      inFlight.set(key, (inFlight.get(key) ?? 0) + 1);
      void request(key)
        .then((scramble) => {
          if (!disposed && epoch === requestEpoch) {
            deliver(key, scramble);
          }
        })
        .catch((error: unknown) => report(error, key))
        .finally(() => {
          if (epoch === requestEpoch) {
            inFlight.set(key, Math.max(0, (inFlight.get(key) ?? 1) - 1));
            settleStrandedWaiters(key);
          }
        });
    }
  };

  const clear = (): void => {
    epoch++;
    queues.clear();
    inFlight.clear();
    for (const waiting of waiters.values()) {
      for (const waiter of waiting) settleWaiter(waiter, '');
    }
    waiters.clear();
    for (const controller of [...controllers]) controller.abort();
    controllers.clear();
  };

  return {
    take(key): string {
      if (disposed) return '';
      const scramble = queueOf(key).shift() ?? '';
      topUp(key);
      return scramble;
    },
    prefetch(key): void {
      topUp(key);
    },
    async next(key, signal): Promise<string> {
      if (disposed || signal?.aborted) return '';
      const queued = queueOf(key).shift();
      if (queued) {
        topUp(key);
        return queued;
      }
      // Route even a first-call `next()` through the tracked fill. This keeps
      // concurrent callers under the same target and lets the first completed
      // provider request satisfy the visible slot; there is no untracked
      // one-off request racing the per-key queue.
      topUp(key);
      if ((inFlight.get(key) ?? 0) > 0) {
        return new Promise<string>((resolve) => {
          const waiting = waiters.get(key) ?? [];
          const waiter: Waiter = { resolve, signal };
          if (signal) {
            waiter.onAbort = () => {
              const current = waiters.get(key);
              const index = current?.indexOf(waiter) ?? -1;
              if (index < 0 || !current) return;
              current.splice(index, 1);
              if (current.length === 0) waiters.delete(key);
              settleWaiter(waiter, '');
            };
            signal.addEventListener('abort', waiter.onAbort, { once: true });
          }
          waiting.push(waiter);
          waiters.set(key, waiting);
          // Abort may have raced between the early check and registration.
          if (signal?.aborted) waiter.onAbort?.();
        });
      }
      return '';
    },
    reset(): void {
      clear();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clear();
    },
  };
}
