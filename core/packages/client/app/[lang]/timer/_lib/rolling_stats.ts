/** Compatibility path. Runtime-neutral implementation lives in shared. */
export {
  DEFAULT_ROLLING_STAT_COLUMNS,
  MAX_AO_WINDOW,
  MAX_ROLLING_STAT_COLUMNS,
  MIN_AO_WINDOW,
  ROLLING_STAT_PRESETS,
  normalizeRollingStatColumns,
  parseRollingStatKey,
  replaceRollingStatColumn,
  rollingStatBest,
  rollingStatColumnsFromLegacy,
  rollingStatCurrent,
  rollingStatReplacementOptions,
  sanitizeRollingStatColumns,
} from '@cuberoot/shared/timer';
export type {
  RollingStatDefinition,
  RollingStatKey,
} from '@cuberoot/shared/timer';
