/** Mobile host for the shared 2x2 specialist provider and async pool policy. */

import type { Cube222SpecialType } from '@cuberoot/puzzle-solvers/cube222';
import {
  createTimerAsyncScramblePool,
  createTimerWorkerRpc,
  type TimerWorkerPort,
} from '@cuberoot/shared/timer';

const rpc = createTimerWorkerRpc<Cube222SpecialType, string>({
  createWorker: () => new Worker(
    new URL('./cube222-special.worker.ts', import.meta.url),
    { type: 'module' },
  ) as unknown as TimerWorkerPort,
  makeRequest: (id, type) => ({ id, type }),
  label: '2x2 special worker',
});

const pool = createTimerAsyncScramblePool<Cube222SpecialType>({
  generate: rpc.request,
  targetSize: 3,
  requestTimeoutMs: 30_000,
  onError: (error, type) => console.warn(`[timer] 2x2 ${type} scramble failed:`, error),
});

/** Start three requests and resolve with the first correctly typed scramble. */
export function nextMobileCube222SpecialScramble(
  type: Cube222SpecialType,
  signal?: AbortSignal,
): Promise<string> {
  pool.prefetch(type);
  return pool.next(type, signal);
}

/** Test/dev hook; app code keeps the singleton pool warm across solves. */
export function _resetMobileCube222SpecialPool(): void {
  pool.reset();
  rpc.reset();
}
