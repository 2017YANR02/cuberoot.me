/**
 * Retry policy for a temporarily unavailable real-scramble source.
 *
 * Attempt zero starts immediately. A transient result then waits for the delay
 * at the same index before starting the next attempt, so this table preserves
 * the Timer's established n=0..6 behavior exactly: seven attempts and six
 * waits. A confirmed-empty source is a terminal data result, not a failure to
 * retry. Hosts must never turn either branch into a generated 3x3 scramble.
 */
export const TIMER_REAL_SCRAMBLE_RETRY_DELAYS_MS: readonly number[] = Object.freeze([
  1_000,
  2_500,
  4_000,
  5_500,
  6_000,
  6_000,
]);

export const TIMER_REAL_SCRAMBLE_ATTEMPT_COUNT =
  TIMER_REAL_SCRAMBLE_RETRY_DELAYS_MS.length + 1;

/** Delay after a transient attempt, or null when the retry budget is spent. */
export function timerRealScrambleRetryDelayMs(attemptIndex: number): number | null {
  if (!Number.isInteger(attemptIndex) || attemptIndex < 0) return null;
  return TIMER_REAL_SCRAMBLE_RETRY_DELAYS_MS[attemptIndex] ?? null;
}

export type TimerRealScrambleAttemptResult<T> =
  | { readonly kind: 'ready'; readonly value: T }
  | { readonly kind: 'confirmed-empty' }
  | { readonly kind: 'transient-error' };

export type TimerRealScrambleRetryOutcome<T> =
  | { readonly kind: 'ready'; readonly value: T; readonly attemptIndex: number }
  | { readonly kind: 'confirmed-empty'; readonly attemptIndex: number }
  | { readonly kind: 'exhausted'; readonly attemptIndex: number }
  | { readonly kind: 'cancelled' };

export const TIMER_REAL_SCRAMBLE_CONFIRMED_EMPTY = Object.freeze({
  kind: 'confirmed-empty',
} as const satisfies TimerRealScrambleAttemptResult<never>);

export const TIMER_REAL_SCRAMBLE_TRANSIENT_ERROR = Object.freeze({
  kind: 'transient-error',
} as const satisfies TimerRealScrambleAttemptResult<never>);

export function timerRealScrambleReady<T>(value: T): TimerRealScrambleAttemptResult<T> {
  return { kind: 'ready', value };
}

/**
 * Runtime-neutral timer seam. Returning a cancellation function keeps browser,
 * Capacitor and tests independent of their timeout-handle types.
 */
export type TimerRealScrambleRetrySchedule = (
  callback: () => void,
  delayMs: number,
) => () => void;

export interface TimerRealScrambleRetryOptions {
  readonly schedule?: TimerRealScrambleRetrySchedule;
}

export interface TimerRealScrambleRetryRun<T> {
  readonly result: Promise<TimerRealScrambleRetryOutcome<T>>;
  /** Idempotent. In-flight I/O may finish, but its result is ignored. */
  cancel(): void;
}

const defaultSchedule: TimerRealScrambleRetrySchedule = (callback, delayMs) => {
  const handle = setTimeout(callback, delayMs);
  return () => clearTimeout(handle);
};

/**
 * Start one immediate attempt and coordinate transient retries without overlap.
 *
 * A thrown/rejected attempt is treated as transient. Only an explicit
 * `confirmed-empty` result terminates with that status; this prevents network
 * failures and authoritative empty data from collapsing into the same UI.
 */
export function startTimerRealScrambleRetry<T>(
  attempt: (attemptIndex: number) => Promise<TimerRealScrambleAttemptResult<T>>,
  options: TimerRealScrambleRetryOptions = {},
): TimerRealScrambleRetryRun<T> {
  const schedule = options.schedule ?? defaultSchedule;
  let active = true;
  let cancelScheduled: (() => void) | null = null;
  let scheduledAttemptIndex: number | null = null;
  let settle!: (outcome: TimerRealScrambleRetryOutcome<T>) => void;
  const result = new Promise<TimerRealScrambleRetryOutcome<T>>((resolve) => {
    settle = resolve;
  });

  const finish = (outcome: TimerRealScrambleRetryOutcome<T>): void => {
    if (!active) return;
    active = false;
    scheduledAttemptIndex = null;
    cancelScheduled?.();
    cancelScheduled = null;
    settle(outcome);
  };

  const onAttemptResult = (
    attemptIndex: number,
    attemptResult: TimerRealScrambleAttemptResult<T>,
  ): void => {
    if (!active) return;
    if (attemptResult.kind === 'ready') {
      finish({ kind: 'ready', value: attemptResult.value, attemptIndex });
      return;
    }
    if (attemptResult.kind === 'confirmed-empty') {
      finish({ kind: 'confirmed-empty', attemptIndex });
      return;
    }

    const delayMs = timerRealScrambleRetryDelayMs(attemptIndex);
    if (delayMs === null) {
      finish({ kind: 'exhausted', attemptIndex });
      return;
    }

    const nextAttemptIndex = attemptIndex + 1;
    scheduledAttemptIndex = nextAttemptIndex;
    let fired = false;
    const cancel = schedule(() => {
      fired = true;
      // A scheduler callback is single-use even if a host invokes it twice.
      if (!active || scheduledAttemptIndex !== nextAttemptIndex) return;
      scheduledAttemptIndex = null;
      cancelScheduled = null;
      runAttempt(nextAttemptIndex);
    }, delayMs);
    if (!fired && active && scheduledAttemptIndex === nextAttemptIndex) {
      cancelScheduled = cancel;
    } else {
      // Covers a synchronous test scheduler or a run that settled while the
      // scheduler was registering the callback.
      cancel();
    }
  };

  const runAttempt = (attemptIndex: number): void => {
    if (!active) return;
    let pending: Promise<TimerRealScrambleAttemptResult<T>>;
    try {
      pending = attempt(attemptIndex);
    } catch {
      onAttemptResult(attemptIndex, TIMER_REAL_SCRAMBLE_TRANSIENT_ERROR);
      return;
    }
    void pending.then(
      (attemptResult) => onAttemptResult(attemptIndex, attemptResult),
      () => onAttemptResult(attemptIndex, TIMER_REAL_SCRAMBLE_TRANSIENT_ERROR),
    );
  };

  runAttempt(0);

  return {
    result,
    cancel() {
      if (!active) return;
      active = false;
      scheduledAttemptIndex = null;
      cancelScheduled?.();
      cancelScheduled = null;
      settle({ kind: 'cancelled' });
    },
  };
}
