import type { CubieCube } from '@cuberoot/puzzle-solvers/kociemba/cube';
import type { TrainerSpec } from '@cuberoot/puzzle-solvers/cross-trainer';
import { createTimerWorkerRpc, createTimerRandomDifficultyPool,
  type TimerRandomDifficultyBatch, type TimerRandomDifficultyResult } from '@cuberoot/shared/timer';
import type { TrainerWorkerRequest, TrainerWorkerResult } from '@cuberoot/shared/timer/random-difficulty-worker';

export type { TrainerWorkerRequest, TrainerWorkerResult } from '@cuberoot/shared/timer/random-difficulty-worker';

const createRpc = (label: string) => createTimerWorkerRpc<TrainerWorkerRequest, TrainerWorkerResult>({
  createWorker: () => new Worker(new URL('./trainer.worker.ts', import.meta.url), { type: 'module' }),
  makeRequest: (id, request) => ({ id, request }), label,
});
// Cancelling a generation must not abort the displayed case's answer.
const generationRpc = createRpc('trainer generation worker');
const solutionRpc = createRpc('trainer solution worker');
export async function generateRandomDifficultyBatch(spec: TrainerSpec, count: number, budgetMs: number, signal: AbortSignal): Promise<TimerRandomDifficultyBatch> {
  const result = await generationRpc.request({ kind: 'difficulty-batch', spec, count, budgetMs }, signal, 90_000);
  if (result.kind !== 'difficulty-batch') throw new Error('unexpected trainer response');
  return result.batch;
}
export async function solveRandomDifficultyCase(spec: TrainerSpec, state: CubieCube, isZh: boolean, signal?: AbortSignal): Promise<{ notation: string; frame: string }> {
  const result = await solutionRpc.request({ kind: 'trainer-solution', spec, state, isZh }, signal, 90_000);
  if (result.kind !== 'trainer-solution') throw new Error('unexpected trainer answer');
  return { notation: result.notation, frame: result.frame };
}
export type TrainerMeta = Pick<TimerRandomDifficultyResult, 'spec' | 'depth' | 'state'>;
export const randomDifficultyPool = createTimerRandomDifficultyPool(generateRandomDifficultyBatch);
export function resetRandomDifficulty() {
  randomDifficultyPool.reset(); generationRpc.reset(); solutionRpc.reset();
}
