/** Mobile host for the shared 2x2 by-steps engine and queue policy. */

import {
  createTimerAsyncScramblePool,
  createTimerWorkerRpc,
  isTimer222StepMetric,
  timerByStepsFilter,
  timerByStepsIdentity,
  type Scramble222Mode,
  type Timer222StepMetric,
  type TimerByStepsSettings,
  type TimerWorkerPort,
} from '@cuberoot/shared/timer';

interface Request {
  key: string;
  metric: Timer222StepMetric;
  lo: number;
  hi: number;
  mode: Scramble222Mode;
}

const requests = new Map<string, Request>();
const rpc = createTimerWorkerRpc<Request, string>({
  createWorker: () => new Worker(
    new URL('./cube222-steps.worker.ts', import.meta.url),
    { type: 'module' },
  ) as unknown as TimerWorkerPort,
  makeRequest: (id, request) => ({ id, ...request }),
  label: '2x2 by-steps worker',
});
const pool = createTimerAsyncScramblePool<string>({
  generate: (key, signal) => {
    const request = requests.get(key);
    if (!request) return Promise.reject(new Error(`missing 2x2 by-steps request: ${key}`));
    return rpc.request(request, signal);
  },
  targetSize: 3,
  requestTimeoutMs: 60_000,
  onError: (error, key) => console.warn(`[timer] ${key} scramble failed:`, error),
});

export function nextMobileCube222ByStepsScramble(
  settings: TimerByStepsSettings,
  mode: Scramble222Mode,
  signal?: AbortSignal,
): Promise<string> {
  const filter = timerByStepsFilter('222', 'random', settings);
  if (!filter || !isTimer222StepMetric(filter.metric)) {
    return Promise.reject(new Error('invalid 2x2 by-steps request'));
  }
  const key = timerByStepsIdentity('222', 'random', settings, mode);
  requests.set(key, { key, metric: filter.metric, lo: filter.lo, hi: filter.hi, mode });
  pool.prefetch(key);
  return pool.next(key, signal);
}

export function _resetMobileCube222ByStepsPool(): void {
  pool.reset();
  rpc.reset();
  requests.clear();
}
