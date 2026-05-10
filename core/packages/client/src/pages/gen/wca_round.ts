/**
 * WCA round / format constants for tnoodle-style scramble sheet generation.
 *
 * `format` is the WCA attempt format (Ao5 / Mo3 / Bo3 / Bo1). `attempts(format)`
 * gives main scramble count; tnoodle additionally generates 2 extras per round
 * for sub-DNF / pop / cube damage replacements.
 */

export type WcaFormat = 'a' | 'm' | '5' | '3' | '2' | '1';
//  a = Average of 5 (Ao5)   →  5 attempts
//  m = Mean of 3 (Mo3)      →  3 attempts (FMC, MBLD)
//  5 = Best of 5 (Bo5)      →  5 attempts (3bld 训练专用,非 WCA 标准)
//  3 = Best of 3 (Bo3)      →  3 attempts
//  2 = Best of 2 (Bo2)      →  2 attempts
//  1 = Best of 1 (Bo1)      →  1 attempt

export const FORMAT_LABEL: Record<WcaFormat, string> = {
  'a': 'Ao5',
  'm': 'Mo3',
  '5': 'Bo5',
  '3': 'Bo3',
  '2': 'Bo2',
  '1': 'Bo1',
};

export function formatAttempts(f: WcaFormat): number {
  switch (f) {
    case 'a': return 5;
    case 'm': return 3;
    case '5': return 5;
    case '3': return 3;
    case '2': return 2;
    case '1': return 1;
  }
}

/** Allowed formats per event. First entry is the per-event default. */
export const ALLOWED_FORMATS: Record<string, WcaFormat[]> = {
  '222':    ['a'],
  '333':    ['a'],
  '444':    ['a'],
  '555':    ['a'],
  '666':    ['m'],
  '777':    ['m'],
  '333bf':  ['5', '3'],
  '333fm':  ['m'],
  '333oh':  ['a'],
  '333mbf': ['1', '2', '3'],
  'clock':  ['a'],
  'minx':   ['a'],
  'pyram':  ['a'],
  'skewb':  ['a'],
  'sq1':    ['a'],
  '444bf':  ['3'],
  '555bf':  ['3'],
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
  /**
   * tnoodle-style per-part color override. Currently only `clock` reads this.
   * Absent ⇒ use the puzzle's default scheme.
   */
  colors?: Record<string, string>;
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
