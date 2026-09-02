import {
  createTimerRandomDifficultyPool,
  type TimerRandomDifficultyResult,
  type TimerRandomDifficultyStatus,
} from '@cuberoot/shared/timer';
import type { TrainerSpec } from '@cuberoot/puzzle-solvers/cross-trainer';

import { generateMobileRandomDifficultyBatch } from '../smart-cube/fixup';

const pool = createTimerRandomDifficultyPool(generateMobileRandomDifficultyBatch);

export const awaitMobileRandomDifficulty = pool.wait;
export const prefetchMobileRandomDifficulty = pool.prefetch;
export const releaseMobileRandomDifficulty = pool.release;
export const retryMobileRandomDifficulty = pool.retry;

export function peekMobileRandomDifficulty(
  spec: TrainerSpec,
): TimerRandomDifficultyResult | null {
  return pool.peek(spec);
}

export type MobileRandomDifficultyStatus = TimerRandomDifficultyStatus;
