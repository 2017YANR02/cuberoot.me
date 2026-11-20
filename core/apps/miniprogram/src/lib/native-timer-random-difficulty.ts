import type { TrainerSpec } from '@cuberoot/puzzle-solvers/cross-trainer';
import {
  createTimerRandomDifficultyPool,
  type TimerRandomDifficultyResult,
} from '@cuberoot/shared/timer/random-difficulty-pool';
import type { TrainerWorkerRequest, TrainerWorkerResult } from '@cuberoot/shared/timer/random-difficulty-worker';
import { createTimerWorkerRpc } from '@cuberoot/shared/timer/worker-rpc';
import { openNativeTimerWorkerPort } from './native-timer-worker';

export type NativeRandomDifficultyNext =
  | { kind: 'ready'; result: TimerRandomDifficultyResult }
  | { kind: 'empty' | 'rare' | 'error' | 'cancelled' };

const timeoutMs = 90_000;

export function createNativeTimerRandomDifficulty() {
  function createRpc(label: string) {
    return createTimerWorkerRpc<TrainerWorkerRequest, TrainerWorkerResult>({
      createWorker: () => openNativeTimerWorkerPort('trainer'),
      makeRequest: (id, request) => ({ id, request }),
      label,
    });
  }
  const generation = createRpc('native random difficulty generation');
  const solution = createRpc('native random difficulty solution');
  const pool = createTimerRandomDifficultyPool(async (spec, count, budgetMs, signal) => {
    const response = await generation.request({ kind: 'difficulty-batch', spec, count, budgetMs }, signal, timeoutMs);
    if (response.kind !== 'difficulty-batch') throw new Error('unexpected trainer response');
    return response.batch;
  });
  let nextRequest = 0;

  const releaseGeneration = (): void => {
    nextRequest++;
    pool.release();
    generation.reset();
  };

  return {
    async next(spec: TrainerSpec, signal?: AbortSignal): Promise<NativeRandomDifficultyNext> {
      if (signal?.aborted) return { kind: 'cancelled' };
      const request = ++nextRequest;
      const abort = () => { if (request === nextRequest) releaseGeneration(); };
      signal?.addEventListener('abort', abort, { once: true });
      try {
        const status = await pool.wait(spec);
        if (request !== nextRequest || signal?.aborted || status === 'idle') return { kind: 'cancelled' };
        if (status === 'empty' || status === 'rare') return { kind: status };
        const result = status === 'ready' ? pool.peek(spec) : null;
        return result ? { kind: 'ready', result } : { kind: 'error' };
      } finally {
        signal?.removeEventListener('abort', abort);
      }
    },
    async solve(result: TimerRandomDifficultyResult, isZh: boolean, signal?: AbortSignal): Promise<{ notation: string; frame: string }> {
      const response = await solution.request({
        kind: 'trainer-solution', spec: result.spec, state: result.state, isZh,
      }, signal, timeoutMs);
      if (response.kind !== 'trainer-solution') throw new Error('unexpected trainer answer');
      return { notation: response.notation, frame: response.frame };
    },
    retry: pool.retry,
    release(): void {
      releaseGeneration();
      solution.reset();
    },
  };
}
