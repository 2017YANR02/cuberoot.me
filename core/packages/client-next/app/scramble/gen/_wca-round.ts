/**
 * WCA round / format constants for tnoodle-style scramble sheet generation.
 *
 * `format` is the WCA attempt format (Ao5 / Mo3 / Bo3 / Bo1). `attempts(format)`
 * gives main scramble count; tnoodle additionally generates 2 extras per round
 * for sub-DNF / pop / cube damage replacements.
 */

import type { TnoodleLocale } from './_tnoodle-translate';

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

/**
 * Allowed formats per event. **First entry is the per-event default** (=WCA 标准),
 * 后续是用户可选的替代格式。下拉菜单只在 `.length > 1` 时渲染 — 给每个事件 ≥2 项
 * 默认就出下拉,用户能改 Ao5 → Bo3 / Bo2 / Bo1 等,首选不动。
 */
export const ALLOWED_FORMATS: Record<string, WcaFormat[]> = {
  '222':    ['a', '3', '2', '1'],
  '333':    ['a', '3', '2', '1'],
  '444':    ['a', '3', '2', '1'],
  '555':    ['a', '3', '2', '1'],
  '666':    ['m', '3', '2', '1'],
  '777':    ['m', '3', '2', '1'],
  '333bf':  ['5', '3', '2', '1'],
  '333fm':  ['m', '2', '1'],
  '333oh':  ['a', '3', '2', '1'],
  '333ft':  ['a', 'm', '3', '2', '1'],
  '333mbf': ['1', '2', '3'],
  '333mbo': ['1', '2', '3'],
  'clock':  ['a', '3', '2', '1'],
  'minx':   ['a', '3', '2', '1'],
  'pyram':  ['a', '3', '2', '1'],
  'skewb':  ['a', '3', '2', '1'],
  'sq1':    ['a', '3', '2', '1'],
  '444bf':  ['3', '2', '1'],
  '555bf':  ['3', '2', '1'],
  // 非 WCA (cubing.js twizzleEvents) — 跟 WCA 普通 cube 项目对齐。
  'fto':              ['a', '3', '2', '1'],
  'master_tetraminx': ['a', '3', '2', '1'],
  'kilominx':         ['a', '3', '2', '1'],
  'redi_cube':        ['a', '3', '2', '1'],
  'baby_fto':         ['a', '3', '2', '1'],
};

const DEFAULT_FORMATS: WcaFormat[] = ['a', '3', '2', '1'];

/** Safe lookup — returns a generic cubical default for any unknown event id
 *  (cstimer 31 个 / shape-mod 8 个 / 高阶 NxN 都没在静态表里)。 */
export function allowedFormats(event: string): WcaFormat[] {
  return ALLOWED_FORMATS[event] ?? DEFAULT_FORMATS;
}

/** Default extra-scramble count per round (tnoodle WCA convention). */
export const DEFAULT_EXTRA_COUNT = 2;

/** Default locales for FMC translations. Mirrors tnoodle's defaults (English only). */
export const DEFAULT_FMC_LOCALES: readonly TnoodleLocale[] = ['en'];

/** MBLD-specific: number of cubes per attempt. WCA min 2, no upper limit. tnoodle defaults to 8. */
export const MBLD_DEFAULT_CUBES = 8;

export interface RoundConfig {
  /** WCA format key; selects attempts-per-round */
  format: WcaFormat;
  /** Number of distinct scramble sets (groups). tnoodle default 1. */
  scrambleSets: number;
  /** Print copies — affects PDF only, not scramble generation. */
  copies: number;
  /**
   * FMC-only — locales for which to emit a translated solution sheet per
   * attempt. Ignored for non-FMC events (their PDFs have no localized text).
   */
  locales?: TnoodleLocale[];
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
    format: allowedFormats(event)[0],
    scrambleSets: 1,
    copies: 1,
    locales: event === '333fm' ? [...DEFAULT_FMC_LOCALES] : undefined,
  };
}

export function defaultEventConfig(event: string): EventConfig {
  const isMbld = event === '333mbf' || event === '333mbo';
  return {
    event,
    rounds: [defaultRoundConfig(event)],
    mbldCubes: isMbld ? MBLD_DEFAULT_CUBES : undefined,
  };
}

/** Map WCIF format string → our WcaFormat key. */
export function wcifFormatToWcaFormat(f: string): WcaFormat {
  if (f === 'a' || f === 'm' || f === '1' || f === '2' || f === '3' || f === '5') return f;
  return '1';
}
