import { randomDifficultyPool as pool, solveRandomDifficultyCase, resetRandomDifficulty,
  type TrainerMeta } from '@cuberoot/timer-ui/scramble/trainer';
export type { TrainerMeta } from '@cuberoot/timer-ui/scramble/trainer';
export type { TimerRandomDifficultyStatus as TrainerStatus } from '@cuberoot/shared/timer';
export const onTrainerChange = pool.onChange;
export const releaseTrainer = pool.release;
export const trainerStatus = pool.status;
export const awaitTrainer = pool.wait;
export const retryTrainer = pool.retry;
export const prefetchTrainer: typeof pool.prefetch = (spec) => {
  if (typeof window !== 'undefined') pool.prefetch(spec);
};
export const peekTrainerResult = pool.peek;
export const _resetTrainerPool = resetRandomDifficulty;
export async function solveTrainerCase(meta: TrainerMeta, isZh: boolean, signal?: AbortSignal) {
  return solveRandomDifficultyCase(meta.spec, meta.state, isZh, signal).catch(() => null);
}
