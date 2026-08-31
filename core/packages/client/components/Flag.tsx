'use client';

// Web compatibility wrapper. Rendering and the WCA Chinese Taipei special
// case live in timer-ui so Next and Capacitor cannot drift.
export {
  CHINESE_TAIPEI_FLAG_PATH,
  Flag,
  flagHtml,
  flagInfo,
} from '@cuberoot/timer-ui/country-flag';
export type {
  FlagHtmlOpts,
  FlagInfo,
  FlagProps,
} from '@cuberoot/timer-ui/country-flag';
