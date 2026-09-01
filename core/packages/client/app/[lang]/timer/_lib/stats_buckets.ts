/** Compatibility path. Runtime-neutral implementation lives in shared. */
export {
  bucketBoundaries,
  bucketStats,
  dayKeyOf,
  filterSolvesByStatsDateRange,
  groupSolvesByLocalDay,
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
  TimerHistoryDayGroup,
} from '@cuberoot/shared/timer';
