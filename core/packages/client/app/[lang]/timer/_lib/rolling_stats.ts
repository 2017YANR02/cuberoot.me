/** Compatibility path. Runtime-neutral implementation lives in shared. */
export {
  DEFAULT_ROLLING_STAT_COLUMNS,
  MAX_AO_WINDOW,
  MAX_ROLLING_STAT_COLUMNS,
  MIN_AO_WINDOW,
  ROLLING_STAT_PRESETS,
  normalizeRollingStatColumns,
  parseRollingStatKey,
  projectRollingStats,
  replaceRollingStatColumn,
  rollingStatBest,
  rollingStatColumnsFromLegacy,
  rollingStatCurrent,
  rollingStatColumnsForEvent,
  rollingStatReplacementOptions,
  rollingStatSeries,
  sanitizeRollingStatColumns,
} from '@cuberoot/shared/timer';
export type {
  RollingStatDefinition,
  RollingStatKey,
  RollingStatPoint,
  RollingStatProjection,
} from '@cuberoot/shared/timer';
