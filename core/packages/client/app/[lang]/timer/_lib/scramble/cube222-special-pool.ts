/**
 * Async Web buffer for the shared 2x2 special-scramble provider.
 *
 * The worker imports @cuberoot/puzzle-solvers/cube222; this file only bridges
 * its asynchronous responses into the timer's synchronous scramble hand-off.
 * Queue identity is the semantic type, so EG/CLL/TCLL/etc. can never cross.
 */

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

/** Synchronous hand-off: a blank string means the worker is still filling. */
export function takeCube222SpecialScramble(type: Cube222SpecialType): string {
  return pool.take(type);
}

/** Start the shared provider worker and keep this type's queue warm. */
export function prefetchCube222SpecialScramble(type: Cube222SpecialType): void {
  pool.prefetch(type);
}

/** Await one correct-type result to replace a visible loading placeholder. */
export async function nextCube222SpecialScramble(
  type: Cube222SpecialType,
  signal?: AbortSignal,
): Promise<string> {
  return pool.next(type, signal);
}

/** Test/dev hook; production callers never need to reset the warm worker. */
export function _resetCube222SpecialPool(): void {
  pool.reset();
  rpc.reset();
}
