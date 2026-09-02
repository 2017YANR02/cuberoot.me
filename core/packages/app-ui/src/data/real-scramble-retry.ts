import {
  TIMER_REAL_SCRAMBLE_CONFIRMED_EMPTY,
  TIMER_REAL_SCRAMBLE_TRANSIENT_ERROR,
  startTimerRealScrambleRetry,
  timerRealScrambleReady,
  timerSupportsRealWcaScrambles,
  type TimerRealScrambleRetryOptions,
  type TimerRealScrambleRetryRun,
} from '@cuberoot/shared/timer';

import {
  fetchRealScrambles,
  normalizeRealScrambleSourceSpec,
  RealScrambleFetchError,
  type RealScramble,
  type RealScrambleSourceInput,
} from './real-scramble-pool';

export interface RealScrambleFetchRetryOptions extends TimerRealScrambleRetryOptions {
  readonly fetcher?: typeof fetch;
  readonly examplesFetcher?: typeof fetch;
  readonly onClosedSet?: (scrambles: readonly RealScramble[]) => void;
  readonly requestTimeoutMs?: number;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Mobile's thin transport adapter over the canonical shared retry policy.
 *
 * The adapter only classifies this host's fetch result. It owns no attempt
 * count or delay constants, and it never substitutes a generated scramble.
 */
export function startRealScrambleFetchRetry(
  input: RealScrambleSourceInput,
  options: RealScrambleFetchRetryOptions = {},
): TimerRealScrambleRetryRun<RealScramble[]> {
  const spec = normalizeRealScrambleSourceSpec(input);
  if (!timerSupportsRealWcaScrambles(spec.event)) {
    throw new Error(`real WCA scrambles unsupported for timer event ${spec.event}`);
  }
  let activeController: AbortController | null = null;
  let activeTimeout: ReturnType<typeof setTimeout> | null = null;
  const sharedRun = startTimerRealScrambleRetry(async () => {
    const controller = new AbortController();
    activeController = controller;
    const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    activeTimeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      return timerRealScrambleReady(await fetchRealScrambles(
        spec,
        options.fetcher,
        controller.signal,
        options.examplesFetcher ?? (options.fetcher ? undefined : fetch),
        options.onClosedSet,
      ));
    } catch (error) {
      return error instanceof RealScrambleFetchError && error.kind === 'confirmed-empty'
        ? TIMER_REAL_SCRAMBLE_CONFIRMED_EMPTY
        : TIMER_REAL_SCRAMBLE_TRANSIENT_ERROR;
    } finally {
      if (activeController === controller) activeController = null;
      if (activeTimeout !== null) clearTimeout(activeTimeout);
      activeTimeout = null;
    }
  }, { schedule: options.schedule });
  return {
    result: sharedRun.result,
    cancel() {
      sharedRun.cancel();
      activeController?.abort();
      activeController = null;
      if (activeTimeout !== null) clearTimeout(activeTimeout);
      activeTimeout = null;
    },
  };
}
