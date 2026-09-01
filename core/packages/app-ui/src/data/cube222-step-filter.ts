import {
  createTimerWorkerRpc,
  type Timer222StepMetric,
  type TimerWorkerPort,
} from '@cuberoot/shared/timer';

interface Request {
  scrambles: string[];
  metric: Timer222StepMetric;
  lo: number;
  hi: number;
}

const rpc = createTimerWorkerRpc<Request, boolean[]>({
  createWorker: () => new Worker(
    new URL('./cube222-step-filter.worker.ts', import.meta.url),
    { type: 'module' },
  ) as unknown as TimerWorkerPort,
  makeRequest: (id, request) => ({ id, ...request }),
  label: '2x2 step-filter worker',
});

export async function filterMobileCube222BySteps<T extends { scramble: string }>(
  rows: readonly T[],
  filter: { metric: Timer222StepMetric; lo: number; hi: number },
  signal: AbortSignal,
): Promise<T[]> {
  if (rows.length === 0) return [];
  const matches = await rpc.request({
    scrambles: rows.map((row) => row.scramble),
    ...filter,
  }, signal);
  if (matches.length !== rows.length) throw new Error('2x2 step-filter worker returned wrong length');
  return rows.filter((_row, index) => matches[index]);
}

export function _resetMobileCube222StepFilter(): void {
  rpc.reset();
}
