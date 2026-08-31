/** Browser Worker adapter; queue, identity, cancellation and metrics are shared. */

import {
  createTimerNon222ByStepsWorkerHost,
  type TimerByStepsFilter,
  type TimerByStepsSettings,
  type TimerNon222StepPuzzle,
  type TimerWorkerPort,
} from '@cuberoot/shared/timer';

const host = createTimerNon222ByStepsWorkerHost({
  createWorker: () => new Worker(
    new URL('./non222-steps.worker.ts', import.meta.url),
    { type: 'module' },
  ) as unknown as TimerWorkerPort,
  targetSize: 3,
  requestTimeoutMs: 60_000,
  onError: (error, identity) => console.warn(`[timer] ${identity} scramble failed:`, error),
});

export function takeWebNon222ByStepsScramble(
  event: TimerNon222StepPuzzle,
  settings: TimerByStepsSettings,
): string {
  return host.take(event, settings);
}

export function nextWebNon222ByStepsScramble(
  event: TimerNon222StepPuzzle,
  settings: TimerByStepsSettings,
  signal?: AbortSignal,
): Promise<string> {
  return host.next(event, settings, signal);
}

export async function filterWebNon222BySteps<T extends { scramble: string }>(
  event: TimerNon222StepPuzzle,
  rows: readonly T[],
  filter: TimerByStepsFilter,
  signal: AbortSignal,
): Promise<T[]> {
  const matches = await host.filterScrambles(
    event,
    rows.map((row) => row.scramble),
    filter,
    signal,
  );
  return rows.filter((_row, index) => matches[index]);
}

export function _resetWebNon222ByStepsPool(): void {
  host.reset();
}
