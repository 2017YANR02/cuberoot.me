/** Batch 2x2 metric filtering kept off the timer's pointer/keyboard thread. */

/// <reference lib="webworker" />

import { cube222MetricOfScramble } from '@cuberoot/puzzle-solvers/cube222';
import type {
  Timer222StepMetric,
} from '@cuberoot/shared/timer/by-steps';
import type { TimerWorkerRpcResponse } from '@cuberoot/shared/timer/worker-rpc';

interface Request {
  id: number;
  scrambles: string[];
  metric: Timer222StepMetric;
  lo: number;
  hi: number;
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
workerScope.addEventListener('message', (event: MessageEvent<Request>) => {
  const { id, scrambles, metric, lo, hi } = event.data;
  try {
    const value = scrambles.map((scramble) => {
      const measured = cube222MetricOfScramble(scramble, metric);
      return measured !== null && measured >= lo && measured <= hi;
    });
    workerScope.postMessage({ id, ok: true, value } satisfies TimerWorkerRpcResponse<boolean[]>);
  } catch (error) {
    workerScope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies TimerWorkerRpcResponse<boolean[]>);
  }
});

export {};
