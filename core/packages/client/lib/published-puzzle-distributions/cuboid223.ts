/** Jaap Scherphuis's complete 223 QTM distribution:
 * https://www.jaapsch.net/puzzles/cube223.htm
 * One middle-layer piece fixes the reference: 8! × 3! = 241,920 states.
 * Only U2/D2 cost two; mandatory side-face half turns still cost one.
 * Checked every joint-table row sum; all HTM column sums also match the
 * project's existing 223 full-space report. No state/solution records included. */

export const CUBOID223_QTM_EXACT_HISTOGRAM = [
  1, 6, 24, 93, 341, 1_130, 3_336, 8_749, 18_822, 32_562, 44_832,
  49_276, 44_228, 28_352, 9_376, 792,
] as const;
