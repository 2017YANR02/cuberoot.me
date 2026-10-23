/** Jaap Scherphuis's complete Bicube QTM table.
 * https://www.jaapsch.net/puzzles/bandage.htm
 * Cross-checked against every row sum of the full-state HTM × QTM joint table;
 * column sums also match the project's existing exact Bicube HTM report.
 * 440 shapes × 7!/2 even permutations = 1,108,800 coloured states, with the
 * fixed bandage frame retained. This is not the separate 440-shape distance table.
 * A legal quarter turn costs one; a half turn costs two. No state/solution records. */

export const BICUBE_QTM_EXACT_HISTOGRAM = [
  1, 6, 17, 31, 60, 106, 161, 274, 469, 758, 1_232, 2_046, 3_361,
  5_464, 8_762, 14_206, 22_350, 34_777, 52_727, 76_825, 104_094,
  131_580, 147_969, 148_384, 128_153, 95_646, 61_508, 33_900, 18_270,
  8_308, 4_635, 1_873, 620, 211, 11, 5,
] as const;
