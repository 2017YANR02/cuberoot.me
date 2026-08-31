/** Mobile worker/buffer adapter for the shared csTimer non-WCA engine. */

import type { CstimerNonWcaTimerEvent } from '@cuberoot/puzzle-solvers/cstimer-nonwca';
import {
  createTimerAsyncScramblePool,
  createTimerWorkerRpc,
  timerScrambleCapability,
  type EventId,
  type TimerWorkerPort,
} from '@cuberoot/shared/timer';

const rpc = createTimerWorkerRpc<CstimerNonWcaTimerEvent, string>({
  createWorker: () => new Worker(
    new URL('./cstimer-nonwca.worker.ts', import.meta.url),
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

export function nextMobileCstimerNonWcaScramble(
  event: EventId,
  signal?: AbortSignal,
): Promise<string> {
  const capability = timerScrambleCapability(event);
  if (capability?.kind !== 'shared' || capability.provider !== 'cstimer-nonwca') {
    return Promise.reject(new Error(`invalid shared csTimer non-WCA event: ${event}`));
  }
  const exactEvent = event as CstimerNonWcaTimerEvent;
  pool.prefetch(exactEvent);
  return pool.next(exactEvent, signal);
}

export function _resetMobileCstimerNonWcaPool(): void {
  pool.reset();
  rpc.reset();
}
