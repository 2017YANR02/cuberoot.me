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

// 底色子集模型(六/四/双/单 + 6 选 1)已抽到 lib/cross-color-subset.ts,两处复用。

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
