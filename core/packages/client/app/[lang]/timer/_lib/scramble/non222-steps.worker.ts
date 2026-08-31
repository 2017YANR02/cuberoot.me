/** Browser transport for the runtime-neutral non-2x2 Timer by-steps engine. */

/// <reference lib="webworker" />

import {
  filterTimerNon222Scrambles,
  generateTimerNon222ByStepsScramble,
} from '@cuberoot/puzzle-solvers/timer-by-steps';
import type {
  TimerNon222WorkerRequest,
  TimerNon222WorkerResponse,
} from '@cuberoot/shared/timer';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener('message', (event: MessageEvent<TimerNon222WorkerRequest>) => {
  const request = event.data;
  try {
    const value = request.kind === 'generate'
      ? generateTimerNon222ByStepsScramble(request.filter)
      : filterTimerNon222Scrambles(request.scrambles, request.filter);
    workerScope.postMessage({
      id: request.id,
      ok: true,
      value,
    } satisfies TimerNon222WorkerResponse);
  } catch (error) {
    workerScope.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies TimerNon222WorkerResponse);
  }
});

export {};
