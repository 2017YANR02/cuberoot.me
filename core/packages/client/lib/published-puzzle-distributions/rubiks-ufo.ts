/** Jaap Scherphuis's complete Rubik's UFO distributions:
 * https://www.jaapsch.net/puzzles/rubufo.htm
 * Two six-segment discs, with relative 60-degree disc turns and 180-degree flips
 * of any three-segment half. Fix one segment to remove the 12 whole-puzzle
 * orientations: 11! = 39,916,800 states.
 * FTM: any nonzero disc turn or half flip costs one. Sixth-turn metric: disc
 * turns cost min(k, 6-k) for k sixty-degree steps; half flips still cost one.
 * Both marginals checked against every joint-table row/column and OEIS
 * A079819 / A079820. This is independent of the site's 60,480-state UFO model.
 * No state/solution records or simulator adapter included. */

export const RUBIKS_UFO_FTM_EXACT_HISTOGRAM = [
  1, 8, 36, 189, 870, 4_182, 19_502, 89_508, 390_114, 1_623_294,
  6_100_151, 16_424_349, 14_501_714, 762_762, 120,
] as const;

export const RUBIKS_UFO_STM_EXACT_HISTOGRAM = [
  1, 5, 20, 79, 306, 1_185, 4_550, 17_240, 64_582, 236_713, 841_951,
  2_825_790, 7_998_476, 14_330_740, 11_028_854, 2_546_648, 19_660,
] as const;
