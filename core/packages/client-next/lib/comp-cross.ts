// Cross-step analysis for a loaded competition's 3x3 scrambles, à la XC Master.
// Pure logic on top of lib/cross-solver's optimal per-color cross lengths.

import { allCrossLengths, type CrossColor } from './cross-solver';

// Digit order for the per-scramble "C: 567766" badge — opposite-pair grouped
// (W/Y, R/O, B/G) so the white↔yellow comparison reads adjacent.
export const BADGE_ORDER: readonly CrossColor[] = ['White', 'Yellow', 'Red', 'Orange', 'Blue', 'Green'];

/** Optimal cross length per color in BADGE_ORDER, or null for non-HTM input. */
export function crossDigits(scramble: string): number[] | null {
  const r = allCrossLengths(scramble);
  if (!r) return null;
  return BADGE_ORDER.map((c) => r[c]);
}

// Which color base the distribution counts. white = U only; wy = best of
// white/yellow; cn = best of all six (full colour-neutral).
export type ColorBase = 'white' | 'wy' | 'cn';

export const COLOR_BASES: readonly ColorBase[] = ['white', 'wy', 'cn'];

export const COLOR_BASE_LABEL: Record<ColorBase, { zh: string; en: string }> = {
  white: { zh: '只看白底', en: 'White only' },
  wy: { zh: '白黄取优', en: 'White / Yellow' },
  cn: { zh: '六色底取优', en: 'Full CN' },
};

/** Reduce a 6-colour digit array (BADGE_ORDER) to the value counted under `base`. */
export function baseValue(digits: number[], base: ColorBase): number {
  if (base === 'white') return digits[0];
  if (base === 'wy') return Math.min(digits[0], digits[1]);
  return Math.min(...digits);
}

export interface Histogram {
  /** Total scrambles counted. */
  total: number;
  /** count[step] = number of scrambles whose base cross length == step. */
  count: Record<number, number>;
  min: number;
  max: number;
}

/** Build a step histogram from base cross values. */
export function histogram(values: number[]): Histogram {
  const count: Record<number, number> = {};
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    count[v] = (count[v] ?? 0) + 1;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { total: values.length, count, min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
}
