/** Compatibility path. Runtime-neutral implementation lives in shared. */
export {
  bucketBoundaries,
  bucketStats,
  dayKeyOf,
  filterSolvesByStatsDateRange,
  longestSolveDayStreak,
  solveDayKeys,
  TIMER_STATS_DATE_RANGES,
} from '@cuberoot/shared/timer';
export type {
  BucketBoundaries,
  BucketStats,
  TimerBucketBoundaries,
  TimerBucketStats,
  TimerStatsDateRange,
} from '@cuberoot/shared/timer';
