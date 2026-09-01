/** Mobile scheduling adapter for the shared 2x2 by-steps contract. */

/// <reference lib="webworker" />

import {
  cube222MetricOfScramble,
  generate222ByMetric,
} from '@cuberoot/puzzle-solvers/cube222';
import {
  generateTimer222ByStepsScramble,
  type Timer222ByStepsEngine,
  type Timer222StepMetric,
} from '@cuberoot/shared/timer/by-steps';
import type { Scramble222Mode } from '@cuberoot/shared/timer';
import type { TimerWorkerRpcResponse } from '@cuberoot/shared/timer/worker-rpc';

interface Request {
  id: number;
  metric: Timer222StepMetric;
  lo: number;
  hi: number;
  mode: Scramble222Mode;
}

const engine: Timer222ByStepsEngine = {
  generate: (metric, lo, hi, random) => generate222ByMetric(metric, lo, hi, random),
  measure: cube222MetricOfScramble,
};
const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener('message', (event: MessageEvent<Request>) => {
  const { id, metric, lo, hi, mode } = event.data;
  try {
    workerScope.postMessage({
      id,
      ok: true,
      value: generateTimer222ByStepsScramble({
        genByStepsOn: true,
        genStepsMetric: metric,
        genSteps: Array.from({ length: hi - lo + 1 }, (_, index) => lo + index),
      }, engine, Math.random, mode),
    } satisfies TimerWorkerRpcResponse<string>);
  } catch (error) {
    workerScope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies TimerWorkerRpcResponse<string>);
  }
});

export {};
