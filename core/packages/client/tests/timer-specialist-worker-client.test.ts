import { afterEach, expect, it, vi } from 'vitest';
import { generateRandomDifficultyBatch, solveRandomDifficultyCase, resetRandomDifficulty } from '@cuberoot/timer-ui/scramble/trainer';
import { nextCube222ByStepsScramble, resetCube222ByStepsPool } from '@cuberoot/timer-ui/scramble/cube222-steps';
import { DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS, trainerSpecOf } from '@cuberoot/shared/timer';

class WorkerFixture {
  static all: WorkerFixture[] = [];
  listeners = new Map<string, (event: { data: unknown }) => void>();
  messages: { id: number; mode?: string }[] = [];
  terminate = vi.fn();
  constructor() { WorkerFixture.all.push(this); }
  addEventListener(type: string, callback: (event: { data: unknown }) => void) { this.listeners.set(type, callback); }
  postMessage(message: { id: number }) { this.messages.push(message); }
  answer(index: number, value: unknown) { this.listeners.get('message')?.({ data: { id: this.messages[index]!.id, ok: true, value } }); }
}
afterEach(() => {
  resetRandomDifficulty(); resetCube222ByStepsPool();
  vi.unstubAllGlobals(); WorkerFixture.all = [];
});
it('cancels difficulty generation without losing the displayed answer, including zero moves', async () => {
  vi.stubGlobal('Worker', WorkerFixture);
  const spec = trainerSpecOf('333', { ...DEFAULT_TIMER_RANDOM_DIFFICULTY_SETTINGS, genDiffOn: true })!;
  const state = { cp: Array.from({ length: 8 }, (_, i) => i), co: Array(8).fill(0), ep: Array.from({ length: 12 }, (_, i) => i), eo: Array(12).fill(0) };
  const abort = new AbortController();
  const generation = generateRandomDifficultyBatch(spec, 1, 3000, abort.signal).catch(() => 'cancelled');
  const answer = solveRandomDifficultyCase(spec, state, false);
  const [generator, solver] = WorkerFixture.all;
  expect(WorkerFixture.all).toHaveLength(2);
  abort.abort();
  expect(await generation).toBe('cancelled');
  expect(generator.terminate).toHaveBeenCalledOnce();
  expect(solver.terminate).not.toHaveBeenCalled();
  solver.answer(0, { kind: 'trainer-solution', notation: '', frame: 'White' });
  expect(await answer).toEqual({ notation: '', frame: 'White' });
});
it('a cancelled 2x2 waiter cannot consume the next slot, and mode queues stay isolated', async () => {
  vi.stubGlobal('Worker', WorkerFixture);
  const settings = { genByStepsOn: true, genStepsMetric: 'htm', genSteps: [0] };
  const abort = new AbortController();
  const old = nextCube222ByStepsScramble(settings, 'optimal', abort.signal);
  abort.abort();
  expect(await old).toBe('');
  const current = nextCube222ByStepsScramble(settings, 'optimal');
  const wca = nextCube222ByStepsScramble(settings, 'wca');
  const worker = WorkerFixture.all[0];
  const optimalIndex = worker.messages.findIndex(m => m.mode === 'optimal');
  const wcaIndex = worker.messages.findIndex(m => m.mode === 'wca');
  worker.answer(wcaIndex, 'WCA fixture');
  expect(await wca).toBe('WCA fixture');
  worker.answer(optimalIndex, "U U'");
  expect(await current).toBe("U U'");
});
