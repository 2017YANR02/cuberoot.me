/**
 * WCA round / format constants for tnoodle-style scramble sheet generation.
 *
 * `format` is the WCA attempt format (Ao5 / Mo3 / Bo3 / Bo1). `attempts(format)`
 * gives main scramble count; tnoodle additionally generates 2 extras per round
 * for sub-DNF / pop / cube damage replacements.
 */

export type WcaFormat = 'a' | 'm' | '3' | '2' | '1';
//  a = Average of 5 (Ao5)   →  5 attempts
//  m = Mean of 3 (Mo3)      →  3 attempts (FMC, MBLD)
//  3 = Best of 3 (Bo3)      →  3 attempts
//  2 = Best of 2 (Bo2)      →  2 attempts
//  1 = Best of 1 (Bo1)      →  1 attempt

export const FORMAT_LABEL: Record<WcaFormat, string> = {
  'a': 'Ao5',
  'm': 'Mo3',
  '3': 'Bo3',
  '2': 'Bo2',
  '1': 'Bo1',
};

export function formatAttempts(f: WcaFormat): number {
  switch (f) {
    case 'a': return 5;
    case 'm': return 3;
    case '3': return 3;
    case '2': return 2;
    case '1': return 1;
  }
}

/** WCA-allowed formats per event (tnoodle whitelist). First entry is the per-event default. */
export const ALLOWED_FORMATS: Record<string, WcaFormat[]> = {
  '222':    ['a', '3', '2', '1'],
  '333':    ['a', '3', '2', '1'],
  '444':    ['a', '3', '2', '1'],
  '555':    ['a', '3', '2', '1'],
  '666':    ['m', '3', '2', '1'],
  '777':    ['m', '3', '2', '1'],
  '333bf':  ['3', '2', '1', 'm'],
  '333fm':  ['m', '2', '1'],
  '333oh':  ['a', '3', '2', '1'],
  '333mbf': ['1', '2', '3'],
  'clock':  ['a', '3', '2', '1'],
  'minx':   ['m', '3', '2', '1'],
  'pyram':  ['a', '3', '2', '1'],
  'skewb':  ['a', '3', '2', '1'],
  'sq1':    ['a', '3', '2', '1'],
  '444bf':  ['3', '2', '1', 'm'],
  '555bf':  ['3', '2', '1', 'm'],
};

/** Default extra-scramble count per round (tnoodle WCA convention). */
export const DEFAULT_EXTRA_COUNT = 2;

/** MBLD-specific: number of cubes per attempt. WCA min 2, no upper limit. tnoodle defaults to 8. */
export const MBLD_DEFAULT_CUBES = 8;

export interface RoundConfig {
  /** WCA format key; selects attempts-per-round */
  format: WcaFormat;
  /** Number of distinct scramble sets (groups). tnoodle default 1. */
  scrambleSets: number;
  /** Print copies — affects PDF only, not scramble generation. */
  copies: number;
}

export interface EventConfig {
  /** WCA event id (333, pyram, ...) */
  event: string;
  /** Per-round configs; length = roundCount */
  rounds: RoundConfig[];
  /** MBLD only: cubes per attempt */
  mbldCubes?: number;
}

export function defaultRoundConfig(event: string): RoundConfig {
  return {
    format: ALLOWED_FORMATS[event]?.[0] ?? '1',
    scrambleSets: 1,
    copies: 1,
  };
}

export function defaultEventConfig(event: string): EventConfig {
  return {
    event,
    rounds: [defaultRoundConfig(event)],
    mbldCubes: event === '333mbf' ? MBLD_DEFAULT_CUBES : undefined,
  };
}
