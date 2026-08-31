/** Web worker/buffer adapter for the shared csTimer non-WCA puzzle engine. */

import type { CstimerNonWcaTimerEvent } from '@cuberoot/puzzle-solvers/cstimer-nonwca';
import {
  createTimerAsyncScramblePool,
  createTimerWorkerRpc,
  type TimerWorkerPort,
} from '@cuberoot/shared/timer';

const rpc = createTimerWorkerRpc<CstimerNonWcaTimerEvent, string>({
  createWorker: () => new Worker(
    new URL('./cstimer-nonwca-shared.worker.ts', import.meta.url),
    { type: 'module' },
  ) as unknown as TimerWorkerPort,
  makeRequest: (id, event) => ({ id, event }),
  label: 'shared csTimer non-WCA worker',
});

const pool = createTimerAsyncScramblePool<CstimerNonWcaTimerEvent>({
  generate: rpc.request,
  targetSize: 2,
  requestTimeoutMs: 60_000,
  onError: (error, event) => console.warn(`[timer] ${event} scramble failed:`, error),
});

export function takeSharedCstimerNonWcaScramble(
  event: CstimerNonWcaTimerEvent,
): string {
  return pool.take(event);
}

export function prefetchSharedCstimerNonWcaScramble(
  event: CstimerNonWcaTimerEvent,
): void {
  pool.prefetch(event);
}

export function nextSharedCstimerNonWcaScramble(
  event: CstimerNonWcaTimerEvent,
  signal?: AbortSignal,
): Promise<string> {
  return pool.next(event, signal);
}

export function _resetSharedCstimerNonWcaPool(): void {
  pool.reset();
  rpc.reset();
}
