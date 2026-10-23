/** Jaap Scherphuis's complete Domino distance tables.
 * https://www.jaapsch.net/puzzles/domino.htm
 * Every bin cross-checked against the row/column sums of the published HTM × QTM joint table.
 * Ordinary centres have no visible orientation; identify the four whole-puzzle rotations
 * about U/D with the white centre on top: 8! × 8! / 4 = 406,425,600 states.
 * HTM: every legal face turn costs one. QTM: only U2/D2 cost two;
 * the mandatory 180-degree side turns still cost one.
 * These are not the fixed-frame states used by the project's 233 solver.
 * No state/solution records are included. */

export const DOMINO_HTM_EXACT_HISTOGRAM = [
  1, 7, 34, 168, 807, 3_768, 17_250, 77_696, 342_305, 1_472_169,
  6_052_497, 22_364_538, 65_693_109, 121_339_537, 127_175_987,
  58_226_238, 3_627_117, 32_344, 28,
] as const;

export const DOMINO_QTM_EXACT_HISTOGRAM = [
  1, 6, 27, 120, 529, 2_280, 9_797, 41_602, 172_877, 703_124,
  2_753_752, 9_959_476, 31_168_445, 74_084_200, 115_192_427,
  108_804_334, 53_758_865, 9_617_394, 156_080, 264,
] as const;
