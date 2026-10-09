import { randomDifficultyPool as pool } from '@cuberoot/timer-ui/scramble/trainer';
export type { TimerRandomDifficultyStatus as MobileRandomDifficultyStatus } from '@cuberoot/shared/timer';
export const awaitMobileRandomDifficulty = pool.wait;
export const prefetchMobileRandomDifficulty = pool.prefetch;
export const releaseMobileRandomDifficulty = pool.release;
export const retryMobileRandomDifficulty = pool.retry;
export const peekMobileRandomDifficulty = pool.peek;
